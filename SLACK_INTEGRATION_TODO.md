# Slack Integration Implementation Plan

**Project**: CommProbe - Slack Internal Team Analysis Integration
**Purpose**: Add Slack workspace analysis capabilities for user engagement tracking, channel insights, and team communication patterns
**Approach**: Migrate existing prototype (`infra/prototype/slack/slack_user_analyzer.py`) into production infrastructure

---

## Overview

This document provides a phase-by-phase implementation plan to integrate Slack as a third data source into the CommProbe platform. The integration will enable internal team analysis capabilities including:

- **User-Level Analysis**: Individual team member interests, opinions, focus areas, and engagement patterns
- **Channel-Level Analysis**: Channel summaries, product insights, feature requests, and sentiment analysis
- **Workspace-Level Analysis**: Cross-channel strategic insights and organizational health metrics

**Key Components**:
- Slack SDK integration with Lambda (migrate from prototype)
- New DynamoDB table (`supio-slack-profiles`) for user/channel data
- AI-powered analysis using Amazon Bedrock (Claude Sonnet 4.5)
- 6 new REST API endpoints for Slack operations
- Frontend UI for Slack insights visualization

---

## Phase 1: Prerequisites & Setup

### 1.1 Slack App Configuration ✅ COMPLETE

**Status**: The Slack Bot Token (`SLACK_BOT_TOKEN`) is already obtained and functional as demonstrated by the working prototype.

**Existing Setup**:
- Slack App created with Bot User OAuth Token (`xoxb-...`)
- Required OAuth scopes already configured:
  - `channels:history` - Read public channel messages
  - `channels:read` - List public channels
  - `groups:history` - Read private channel messages (when invited)
  - `groups:read` - List private channels
  - `users:read` - View people in workspace
  - `users:read.email` - View email addresses
- Bot already invited to relevant channels
- Token to be passed as CDK context parameter (following Reddit/Twitter pattern)

**Next Steps**:
- [ ] Pass `SLACK_BOT_TOKEN` as CDK context parameter during deployment
- [ ] Document token parameter in deployment configuration
- [ ] Update CDK stack to read token from context

## Phase 2: Backend Documentation & Implementation

### 2.1 Update API Documentation

**Objective**: Document new Slack endpoints in existing API documentation files.

**Tasks**:

- [ ] **Update `infra/aws/API_INTEGRATION.md`**
  - Add Section: "Slack API Endpoints"
  - Document all 6 new Slack endpoints:
    - `POST /v1/slack/analyze/user`
    - `GET /v1/slack/users/{user_id}`
    - `GET /v1/slack/users`
    - `POST /v1/slack/analyze/channel`
    - `GET /v1/slack/channels/{channel_id}`
    - `GET /v1/slack/channels`
  - Include request/response examples
  - Document Slack-specific query parameters
  - Add platform filtering examples for Slack data

  **Example Addition**:
  ```markdown
  ## Slack API Endpoints

  ### 1. POST /slack/analyze/user - Trigger User Analysis

  Analyze a Slack user's interests, opinions, and engagement patterns.

  **Request Body:**
  ```json
  {
    "user_email": "user@example.com",
    "user_id": "U123456789",  // Alternative to email
    "days": 30,
    "workspace_id": "T123456789"  // Optional
  }
  ```

  **Response:** `202 Accepted`
  ```json
  {
    "message": "User analysis started",
    "request_id": "abc-123",
    "estimated_completion": "2-5 minutes"
  }
  ```
  ```

- [ ] **Update `infra/aws/LAMBDA_CONNECTOR.md`**
  - Add new section: "Slack Collector Lambda"
  - Document migration from prototype to Lambda
  - Key differences from prototype:
    - Environment variables instead of CLI args
    - S3 + DynamoDB storage instead of local files
    - Lambda handler event/response format
    - CloudWatch logging integration
  - Document dependencies: `slack-sdk`, `boto3`, `botocore`

  **Example Addition**:
  ```markdown
  ## Slack Collector Lambda

  **Purpose**: Analyze Slack workspace data for user engagement and channel insights.

  **Location**: `lambda/collector/slack/index.py`

  **Input Event Schema**:
  ```json
  {
    "analysis_type": "user" | "channel" | "workspace",
    "user_email": "user@example.com",
    "channel_name": "general",
    "days": 30,
    "workspace_id": "T123456789"
  }
  ```

  **Output Schema**:
  ```json
  {
    "platform": "slack",
    "analysis_type": "user",
    "s3_location": "s3://bucket/slack/2025-01-16/USER_U123.json",
    "workspace_id": "T123456789",
    "status": "success",
    "metadata": {
      "messages_analyzed": 150,
      "ai_tokens_used": 12500
    }
  }
  ```
  ```

- [ ] **Update `infra/aws/OpenAPISchema.yaml`**
  - Add Slack endpoint definitions following existing pattern
  - Add Slack-specific schema components:
    - `SlackAnalysisRequest`
    - `SlackUserProfileResponse`
    - `SlackChannelSummaryResponse`
    - `SlackAnalysisResponse`
  - Add security requirements (API key auth)
  - Add examples for each endpoint

  **Example Schema Addition**:
  ```yaml
  paths:
    /slack/analyze/user:
      post:
        summary: Analyze Slack User
        description: Trigger async analysis of user's Slack activity
        operationId: analyzeSlackUser
        tags:
          - Slack
        requestBody:
          required: true
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SlackUserAnalysisRequest'
        responses:
          '202':
            description: Analysis started
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/SlackAnalysisResponse'

  components:
    schemas:
      SlackUserAnalysisRequest:
        type: object
        properties:
          user_email:
            type: string
            format: email
          user_id:
            type: string
          days:
            type: integer
            default: 30
          workspace_id:
            type: string
  ```

**Deliverables**:
- Updated `infra/aws/API_INTEGRATION.md` with Slack endpoints
- Updated `infra/aws/LAMBDA_CONNECTOR.md` with Slack collector details
- Updated `infra/aws/OpenAPISchema.yaml` with Slack schemas

---

### 2.2 Infrastructure as Code (CDK)

**Objective**: Update CDK stack to include Slack infrastructure components.

**Tasks**:

- [ ] **Create DynamoDB Table for Slack Data**
  - File: `infra/aws/lib/stack.ts` (or equivalent)
  - Add `supio-slack-profiles` table definition:
    ```typescript
    // Slack Profiles Table - Stores user profiles and channel summaries
    const slackProfilesTable = new dynamodb.Table(this, 'SlackProfilesTable', {
      tableName: 'supio-slack-profiles',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },  // USER#{user_id} or CHANNEL#{channel_id}
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // WORKSPACE#{workspace_id}
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',  // Auto-cleanup after 180 days

      // GSI for workspace-wide queries
      globalSecondaryIndexes: [{
        indexName: 'WorkspaceIndex',
        partitionKey: { name: 'workspace_id', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'last_updated', type: dynamodb.AttributeType.NUMBER },
      }],

      removalPolicy: RemovalPolicy.RETAIN,  // Keep data on stack deletion
    });
    ```

- [ ] **Update Lambda Layer Dependencies**
  - File: `lambda/layer/requirements.txt`
  - Add: `slack-sdk==3.27.1`
  - Rebuild layer:
    ```bash
    cd lambda/layer
    pip install -r requirements.txt -t python/ --platform manylinux2014_x86_64 --only-binary=:all:
    zip -r layer.zip python/
    ```

- [ ] **Create Slack Collector Lambda**
  - Add to CDK stack:
    ```typescript
    // Get Slack Bot Token from CDK context
    const slackBotToken = this.node.tryGetContext('slackBotToken');
    if (!slackBotToken) {
      throw new Error('slackBotToken context variable is required. Pass it via --context slackBotToken=xoxb-...');
    }

    const slackCollector = new lambda.Function(this, 'SlackCollectorFunction', {
      functionName: 'supio-slack-collector',
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector/slack')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 2048,  // Higher memory for AI analysis
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        SLACK_PROFILES_TABLE: slackProfilesTable.tableName,
        SLACK_BOT_TOKEN: slackBotToken,
        AWS_BEDROCK_REGION: 'us-west-2',
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions
    rawDataBucket.grantReadWrite(slackCollector);
    slackProfilesTable.grantReadWriteData(slackCollector);
    slackCollector.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
    ```

- [ ] **Update Step Functions State Machine**
  - Add Slack collector branch to parallel collection:
    ```typescript
    const processingStateMachine = new sfn.StateMachine(this, 'MultiSourcePipeline', {
      stateMachineName: 'supio-multi-source-insights-pipeline',
      definition: new sfn.Parallel(this, 'ParallelCollection')
        .branch(/* Reddit collector */)
        .branch(/* Twitter collector */)
        .branch(
          // NEW: Slack collector branch
          new tasks.LambdaInvoke(this, 'CollectSlackData', {
            lambdaFunction: slackCollector,
            outputPath: '$.Payload',
          })
        )
        .next(/* Analyzer Lambda */)
        .next(/* Storer Lambda */),
    });
    ```

- [ ] **Update API Lambda Function**
  - Add environment variable: `SLACK_PROFILES_TABLE_NAME`
  - Add environment variable: `SLACK_COLLECTOR_FUNCTION_NAME`
  - Grant permissions to invoke Slack collector Lambda
  - Grant read/write permissions to `supio-slack-profiles` table

- [ ] **Add API Gateway Endpoints**
  - Add `/slack` resource with sub-resources:
    ```typescript
    const slackResource = api.root.addResource('slack');

    // User analysis endpoints
    const analyzeUser = slackResource.addResource('analyze').addResource('user');
    analyzeUser.addMethod('POST', integration, { apiKeyRequired: true });

    const usersResource = slackResource.addResource('users');
    usersResource.addMethod('GET', integration, { apiKeyRequired: true });
    usersResource.addResource('{user_id}').addMethod('GET', integration, { apiKeyRequired: true });

    // Channel analysis endpoints
    const analyzeChannel = slackResource.addResource('analyze').addResource('channel');
    analyzeChannel.addMethod('POST', integration, { apiKeyRequired: true });

    const channelsResource = slackResource.addResource('channels');
    channelsResource.addMethod('GET', integration, { apiKeyRequired: true });
    channelsResource.addResource('{channel_id}').addMethod('GET', integration, { apiKeyRequired: true });
    ```

- [ ] **Deploy Updated Infrastructure**
  ```bash
  cd infra/aws
  npx cdk diff \
    --context slackBotToken=xoxb-your-token-here    # Review changes
  npx cdk synth \
    --context slackBotToken=xoxb-your-token-here    # Validate synthesis
  npx cdk deploy \
    --context redditClientId=your-reddit-client-id \
    --context redditClientSecret=your-reddit-secret \
    --context twitterBearerToken=your-twitter-token \
    --context slackBotToken=xoxb-your-slack-token   # Deploy to AWS
  ```

- [ ] **Verify Deployment**
  - Confirm Lambda functions created
  - Confirm DynamoDB table exists
  - Confirm API Gateway endpoints added
  - Verify SLACK_BOT_TOKEN environment variable set in Lambda

**Deliverables**:
- Updated CDK stack with all Slack components
- `supio-slack-profiles` DynamoDB table created
- Slack Collector Lambda deployed
- 6 new API endpoints available
- Updated Lambda layer with `slack-sdk`

---

### 2.3 Lambda Implementation

**Objective**: Migrate prototype Slack analyzer into production Lambda function.

**Tasks**:

- [ ] **Create Lambda Directory Structure**
  ```
  lambda/collector/slack/
  ├── index.py                 # Main Lambda handler
  ├── slack_analyzer.py        # Migrated from prototype
  ├── bedrock_client.py        # Migrated from prototype
  ├── data_storage.py          # S3 and DynamoDB utilities
  ├── models.py                # Data models (Pydantic)
  └── utils.py                 # Helper functions
  ```

- [ ] **Implement Lambda Handler** (`index.py`)
  - Accept event parameters: `analysis_type`, `user_email`, `user_id`, `channel_name`, `channel_id`, `days`
  - Route to appropriate analysis function
  - Save raw data to S3: `s3://bucket/slack/{date}/{type}_{id}.json`
  - Save processed data to DynamoDB `supio-slack-profiles`
  - Return standardized response matching other collectors

  **Handler Pattern** (follow Reddit/Twitter collector pattern):
  ```python
  def handler(event, context):
      """
      Lambda handler for Slack analysis.

      Input event:
      {
          "analysis_type": "user|channel|workspace",
          "user_email": "user@example.com",
          "user_id": "U123",
          "channel_name": "general",
          "channel_id": "C123",
          "days": 30,
          "workspace_id": "T123"
      }

      Output:
      {
          "platform": "slack",
          "analysis_type": "user",
          "s3_location": "s3://...",
          "workspace_id": "T123",
          "status": "success",
          "metadata": {...}
      }
      """
      # Implementation
  ```

- [ ] **Refactor `SlackUserAnalyzer` Class**
  - File: `lambda/collector/slack/slack_analyzer.py`
  - Extract from `infra/prototype/slack/slack_user_analyzer.py`
  - Remove CLI/argparse code
  - Replace print statements with `logger.info()` for CloudWatch
  - Make configuration injectable via constructor
  - Keep all analysis logic identical to prototype

- [ ] **Refactor `BedrockContentAnalyzer` Class**
  - File: `lambda/collector/slack/bedrock_client.py`
  - Extract from prototype
  - Add retry logic with exponential backoff
  - Add token usage tracking
  - Use Claude Sonnet 4.5: `us.anthropic.claude-sonnet-4-20250514-v1:0`

- [ ] **Implement Data Storage Utilities**
  - File: `lambda/collector/slack/data_storage.py`
  - S3 storage: Save raw analysis results
  - DynamoDB storage: Save `SlackUserProfile` and `SlackChannelSummary`
  - TTL calculation: 180 days for Slack data
  - Query utilities: Get profiles, list by workspace

- [ ] **Create Data Models**
  - File: `lambda/collector/slack/models.py`
  - Use Pydantic for type safety
  - Models matching DynamoDB schema:
    - `SlackUserProfile`
    - `SlackChannelSummary`
    - `LambdaInput`
    - `LambdaOutput`

**Deliverables**:
- Complete Lambda function implementation
- All prototype functionality preserved
- CloudWatch logging integrated
- S3 and DynamoDB storage working

---

### 2.4 API Lambda Integration

**Objective**: Add Slack endpoint handlers to existing API Lambda function.

**Tasks**:

- [ ] **Update API Lambda Handler**
  - File: `lambda/api/index.py`
  - Add route handler functions:

  ```python
  def handle_slack_analyze_user(event, context):
      """POST /slack/analyze/user - Trigger user analysis"""
      body = json.loads(event['body'])

      # Invoke Slack collector Lambda asynchronously
      lambda_client.invoke(
          FunctionName=os.environ['SLACK_COLLECTOR_FUNCTION_NAME'],
          InvocationType='Event',  # Async
          Payload=json.dumps({
              'analysis_type': 'user',
              'user_email': body.get('user_email'),
              'user_id': body.get('user_id'),
              'days': body.get('days', 30)
          })
      )

      return {
          'statusCode': 202,
          'body': json.dumps({'message': 'User analysis started'})
      }

  def handle_slack_get_user_profile(event, context):
      """GET /slack/users/{user_id} - Get user profile"""
      user_id = event['pathParameters']['user_id']
      workspace_id = event['queryStringParameters'].get('workspace_id', 'default')

      table = dynamodb.Table(os.environ['SLACK_PROFILES_TABLE_NAME'])
      response = table.get_item(
          Key={'PK': f'USER#{user_id}', 'SK': f'WORKSPACE#{workspace_id}'}
      )

      if 'Item' not in response:
          return {'statusCode': 404, 'body': json.dumps({'error': 'Not found'})}

      return {'statusCode': 200, 'body': json.dumps(response['Item'])}

  def handle_slack_list_users(event, context):
      """GET /slack/users - List all user profiles"""
      workspace_id = event['queryStringParameters'].get('workspace_id', 'default')
      limit = int(event['queryStringParameters'].get('limit', 50))

      table = dynamodb.Table(os.environ['SLACK_PROFILES_TABLE_NAME'])
      response = table.query(
          IndexName='WorkspaceIndex',
          KeyConditionExpression='workspace_id = :wid',
          ExpressionAttributeValues={':wid': workspace_id},
          Limit=limit
      )

      users = [item for item in response['Items'] if item.get('entity_type') == 'user_profile']
      return {'statusCode': 200, 'body': json.dumps({'users': users, 'count': len(users)})}

  # Similar implementations for:
  # - handle_slack_analyze_channel()
  # - handle_slack_get_channel_summary()
  # - handle_slack_list_channels()
  ```

- [ ] **Update Route Handler**
  - Add Slack routes to main router:
  ```python
  def route_request(event, context):
      path = event['path']
      method = event['httpMethod']

      routes = {
          # ... existing routes ...
          ('POST', '/slack/analyze/user'): handle_slack_analyze_user,
          ('GET', '/slack/users/{user_id}'): handle_slack_get_user_profile,
          ('GET', '/slack/users'): handle_slack_list_users,
          ('POST', '/slack/analyze/channel'): handle_slack_analyze_channel,
          ('GET', '/slack/channels/{channel_id}'): handle_slack_get_channel_summary,
          ('GET', '/slack/channels'): handle_slack_list_channels,
      }

      # Match and invoke handler
  ```

- [ ] **Add Environment Variables**
  - Update API Lambda environment in CDK:
    ```typescript
    environment: {
      // ... existing vars ...
      SLACK_PROFILES_TABLE_NAME: slackProfilesTable.tableName,
      SLACK_COLLECTOR_FUNCTION_NAME: slackCollector.functionName,
    }
    ```

- [ ] **Grant Permissions**
  - API Lambda needs permission to:
    - Invoke Slack Collector Lambda
    - Read/write to `supio-slack-profiles` DynamoDB table
  - Update IAM roles in CDK

**Deliverables**:
- Updated API Lambda with 6 new Slack endpoints
- Route handling implemented
- Proper permissions configured
- Environment variables set

---

### 2.5 Update Analyzer and Storer Lambdas

**Objective**: Ensure Analyzer and Storer Lambdas handle Slack data correctly.

**Tasks**:

- [ ] **Update Analyzer Lambda**
  - File: `lambda/analyzer/index.py`
  - Add Slack data handling to existing multi-platform logic:
    ```python
    def process_collection_results(collection_results):
        """Process results from Reddit, Twitter, and Slack collectors"""

        for result in collection_results:
            platform = result['platform']

            if platform == 'slack':
                # Slack data is already analyzed by collector Lambda
                # Just validate and pass through
                yield {
                    'platform': 'slack',
                    'analysis_type': result['analysis_type'],
                    's3_location': result['s3_location'],
                    # No additional AI analysis needed
                }
            elif platform == 'reddit':
                # Existing Reddit analysis
            elif platform == 'twitter':
                # Existing Twitter analysis
    ```

- [ ] **Update Storer Lambda**
  - File: `lambda/storer/index.py`
  - Add Slack storage logic:
    ```python
    def store_insights(insights):
        """Store insights from all platforms"""

        for insight in insights:
            if insight['platform'] == 'slack':
                # Slack data already stored by collector Lambda
                # Just log and skip
                logger.info(f"Slack data already stored: {insight['s3_location']}")
                continue

            # Store Reddit and Twitter insights to supio-insights table
            # (existing logic)
    ```

**Deliverables**:
- Analyzer Lambda handles Slack data
- Storer Lambda correctly processes Slack results
- No duplicate storage issues

---

## Phase 3: Testing & Validation (Backend)

### 3.1 Update Validation Script

**Objective**: Extend existing `scripts/validate-api.sh` to test Slack endpoints.

**Tasks**:

- [ ] **Add Slack Test Functions**
  - File: `scripts/validate-api.sh`
  - Add test functions following existing pattern:

  ```bash
  # Test 20: Slack User Analysis Trigger
  test_slack_user_analysis() {
      log_info "Testing Slack user analysis trigger..."

      local trigger_data='{"user_email": "test@example.com", "days": 30}'
      local response
      response=$(api_request "POST" "/slack/analyze/user" "$trigger_data")

      if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
          add_result "PASS" "Slack User Analysis" "Analysis triggered successfully"
          log_success "Slack user analysis endpoint working"
      else
          if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
              local error_msg
              error_msg=$(echo "$response" | jq -r '.error')
              add_result "PASS" "Slack User Analysis" "Expected error: $error_msg"
              log_warning "Slack user analysis: $error_msg"
          else
              add_result "FAIL" "Slack User Analysis" "Invalid response"
              log_error "Slack user analysis failed"
              return 1
          fi
      fi
  }

  # Test 21: Slack Get User Profile
  test_slack_get_user_profile() {
      log_info "Testing Slack get user profile..."

      local response
      response=$(api_request "GET" "/slack/users/U123456789?workspace_id=default")

      if echo "$response" | jq -e '.user_id' > /dev/null 2>&1; then
          local user_name
          user_name=$(echo "$response" | jq -r '.user_name')
          add_result "PASS" "Slack Get User Profile" "Profile retrieved: $user_name"
          log_success "Slack user profile endpoint working"
      else
          if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
              local error_msg
              error_msg=$(echo "$response" | jq -r '.error')
              add_result "PASS" "Slack Get User Profile" "Expected 404: $error_msg"
              log_success "Slack user profile validation working"
          else
              add_result "FAIL" "Slack Get User Profile" "Invalid response"
              log_error "Slack user profile endpoint failed"
              return 1
          fi
      fi
  }

  # Test 22: Slack List Users
  test_slack_list_users() {
      log_info "Testing Slack list users..."

      local response
      response=$(api_request "GET" "/slack/users?workspace_id=default&limit=10")

      if echo "$response" | jq -e '.users' > /dev/null 2>&1; then
          local count
          count=$(echo "$response" | jq -r '.count')
          add_result "PASS" "Slack List Users" "Found $count users"
          log_success "Slack list users endpoint working"
      else
          add_result "FAIL" "Slack List Users" "Invalid response format"
          log_error "Slack list users endpoint failed"
          return 1
      fi
  }

  # Test 23: Slack Channel Analysis Trigger
  test_slack_channel_analysis() {
      log_info "Testing Slack channel analysis trigger..."

      local trigger_data='{"channel_name": "general", "days": 30}'
      local response
      response=$(api_request "POST" "/slack/analyze/channel" "$trigger_data")

      if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
          add_result "PASS" "Slack Channel Analysis" "Analysis triggered successfully"
          log_success "Slack channel analysis endpoint working"
      else
          if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
              local error_msg
              error_msg=$(echo "$response" | jq -r '.error')
              add_result "PASS" "Slack Channel Analysis" "Expected error: $error_msg"
              log_warning "Slack channel analysis: $error_msg"
          else
              add_result "FAIL" "Slack Channel Analysis" "Invalid response"
              log_error "Slack channel analysis failed"
              return 1
          fi
      fi
  }

  # Test 24: Slack Get Channel Summary
  test_slack_get_channel_summary() {
      log_info "Testing Slack get channel summary..."

      local response
      response=$(api_request "GET" "/slack/channels/C123456789?workspace_id=default")

      if echo "$response" | jq -e '.channel_id' > /dev/null 2>&1; then
          local channel_name
          channel_name=$(echo "$response" | jq -r '.channel_name')
          add_result "PASS" "Slack Get Channel" "Channel retrieved: $channel_name"
          log_success "Slack channel summary endpoint working"
      else
          if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
              add_result "PASS" "Slack Get Channel" "Expected 404 for test channel"
              log_success "Slack channel validation working"
          else
              add_result "FAIL" "Slack Get Channel" "Invalid response"
              log_error "Slack channel endpoint failed"
              return 1
          fi
      fi
  }

  # Test 25: Slack List Channels
  test_slack_list_channels() {
      log_info "Testing Slack list channels..."

      local response
      response=$(api_request "GET" "/slack/channels?workspace_id=default&limit=10")

      if echo "$response" | jq -e '.channels' > /dev/null 2>&1; then
          local count
          count=$(echo "$response" | jq -r '.count')
          add_result "PASS" "Slack List Channels" "Found $count channels"
          log_success "Slack list channels endpoint working"
      else
          add_result "FAIL" "Slack List Channels" "Invalid response format"
          log_error "Slack list channels endpoint failed"
          return 1
      fi
  }
  ```

- [ ] **Add Slack Tests to Main Execution**
  - Update `main()` function to include Slack tests:
  ```bash
  main() {
      # ... existing tests ...

      # Slack Integration tests
      if [ "$PIPELINE_ONLY" != true ]; then
          log_info "Running Slack integration tests..."
          test_slack_user_analysis || true
          test_slack_get_user_profile || true
          test_slack_list_users || true
          test_slack_channel_analysis || true
          test_slack_get_channel_summary || true
          test_slack_list_channels || true
      fi

      generate_report
  }
  ```

- [ ] **Run Validation Script**
  ```bash
  cd /home/ec2-user/CommProbe
  bash scripts/validate-api.sh
  ```

- [ ] **Fix Any Failures**
  - Review validation report
  - Fix failing tests
  - Re-run until all tests pass

**Deliverables**:
- Updated `scripts/validate-api.sh` with 6 new Slack tests
- All tests passing (including Slack endpoints)
- Validation report showing full API coverage

---

## Phase 4: UI/UX Documentation & Implementation

### 4.1 Update UI Documentation

**Objective**: Document Slack integration in existing UI design documents.

**Tasks**:

- [ ] **Update `ui/DESIGN_DOCUMENT.md`**
  - Add Section: "Slack Integration UI Components"
  - Document new pages:
    - `/slack/users` - User list page
    - `/slack/users/[user_id]` - User profile detail
    - `/slack/channels` - Channel list page
    - `/slack/channels/[channel_id]` - Channel summary detail
    - `/settings/slack` - Slack configuration page
  - Document new components:
    - `SlackUserProfileCard`
    - `SlackChannelSummaryCard`
    - `SlackAnalysisTrigger`
    - `SlackConfigForm`
  - Add to navigation structure:
    ```markdown
    ### Navigation Update

    Add new section to sidebar:
    - **Internal Analytics** (Slack)
      - User Profiles (`/slack/users`)
      - Channel Insights (`/slack/channels`)
      - Slack Settings (`/settings/slack`)
    ```

- [ ] **Update `ui/TYPES_DEFINITIONS.ts`**
  - Add Slack-specific types:

  ```typescript
  // Slack Types (NEW)
  export type SlackAnalysisType = 'user' | 'channel' | 'workspace';

  export interface SlackUserProfile {
    user_id: string;
    workspace_id: string;
    user_email: string;
    user_name: string;
    display_name?: string;
    total_channels: number;
    active_channels: number;
    total_messages: number;
    total_replies: number;
    total_activity: number;
    analysis_date: string;
    analysis_period_days: number;
    interests: string[];
    expertise_areas: string[];
    communication_style: string;
    key_opinions: string[];
    pain_points: string[];
    influence_level: 'high' | 'medium' | 'low';
    channel_breakdown: ChannelActivity[];
    ai_insights: string;
    ai_persona_summary: string;
    ai_tokens_used: number;
    last_updated: number;
  }

  export interface ChannelActivity {
    channel_id: string;
    channel_name: string;
    message_count: number;
    reply_count: number;
    last_activity: string;
    ai_summary: string;
  }

  export interface SlackChannelSummary {
    channel_id: string;
    workspace_id: string;
    channel_name: string;
    is_private: boolean;
    num_members: number;
    analysis_date: string;
    analysis_period_days: number;
    messages_analyzed: number;
    channel_purpose: string;
    key_topics: string[];
    feature_requests: string[];
    pain_points: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    key_contributors: KeyContributor[];
    product_opportunities: string[];
    strategic_recommendations: string[];
    ai_summary: string;
    ai_tokens_used: number;
    last_updated: number;
  }

  export interface KeyContributor {
    user_id: string;
    user_name: string;
    contribution_level: 'high' | 'medium' | 'low';
  }

  export interface SlackAnalysisRequest {
    analysis_type: SlackAnalysisType;
    user_email?: string;
    user_id?: string;
    channel_name?: string;
    channel_id?: string;
    days?: number;
    workspace_id?: string;
  }

  export interface SlackAnalysisResponse {
    message: string;
    request_id: string;
  }

  // Update Platform type to include Slack
  export type Platform = 'reddit' | 'twitter' | 'slack';
  ```

**Deliverables**:
- Updated `ui/DESIGN_DOCUMENT.md` with Slack sections
- Updated `ui/TYPES_DEFINITIONS.ts` with complete Slack types
- UI architecture documented

---

### 4.2 API Client Implementation

**Objective**: Create frontend API client for Slack endpoints.

**Tasks**:

- [ ] **Create Slack API Client**
  - File: `ui/src/lib/api/slack.ts`

  ```typescript
  import { apiClient } from './client';  // Existing API client
  import type {
    SlackUserProfile,
    SlackChannelSummary,
    SlackAnalysisRequest,
    SlackAnalysisResponse
  } from '@/types';

  export const slackApi = {
    // User operations
    analyzeUser: async (request: SlackAnalysisRequest): Promise<SlackAnalysisResponse> => {
      const response = await apiClient.post('/api/proxy/slack/analyze/user', request);
      return response.data;
    },

    getUserProfile: async (
      userId: string,
      workspaceId: string = 'default'
    ): Promise<SlackUserProfile> => {
      const response = await apiClient.get(`/api/proxy/slack/users/${userId}`, {
        params: { workspace_id: workspaceId }
      });
      return response.data;
    },

    listUsers: async (
      workspaceId: string = 'default',
      limit: number = 50
    ): Promise<{ users: SlackUserProfile[]; count: number }> => {
      const response = await apiClient.get('/api/proxy/slack/users', {
        params: { workspace_id: workspaceId, limit }
      });
      return response.data;
    },

    // Channel operations
    analyzeChannel: async (request: SlackAnalysisRequest): Promise<SlackAnalysisResponse> => {
      const response = await apiClient.post('/api/proxy/slack/analyze/channel', request);
      return response.data;
    },

    getChannelSummary: async (
      channelId: string,
      workspaceId: string = 'default'
    ): Promise<SlackChannelSummary> => {
      const response = await apiClient.get(`/api/proxy/slack/channels/${channelId}`, {
        params: { workspace_id: workspaceId }
      });
      return response.data;
    },

    listChannels: async (
      workspaceId: string = 'default',
      limit: number = 50
    ): Promise<{ channels: SlackChannelSummary[]; count: number }> => {
      const response = await apiClient.get('/api/proxy/slack/channels', {
        params: { workspace_id: workspaceId, limit }
      });
      return response.data;
    }
  };
  ```

- [ ] **Create React Query Hooks**
  - File: `ui/src/hooks/useSlackApi.ts`

  ```typescript
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { slackApi } from '@/lib/api/slack';
  import type { SlackAnalysisRequest } from '@/types';

  export const useSlackUserProfile = (userId: string, workspaceId?: string) => {
    return useQuery({
      queryKey: ['slack', 'user', userId, workspaceId],
      queryFn: () => slackApi.getUserProfile(userId, workspaceId),
      enabled: !!userId,
      staleTime: 5 * 60 * 1000,  // 5 minutes
    });
  };

  export const useSlackUsers = (workspaceId?: string, limit?: number) => {
    return useQuery({
      queryKey: ['slack', 'users', workspaceId, limit],
      queryFn: () => slackApi.listUsers(workspaceId, limit),
      staleTime: 5 * 60 * 1000,
    });
  };

  export const useSlackChannelSummary = (channelId: string, workspaceId?: string) => {
    return useQuery({
      queryKey: ['slack', 'channel', channelId, workspaceId],
      queryFn: () => slackApi.getChannelSummary(channelId, workspaceId),
      enabled: !!channelId,
      staleTime: 5 * 60 * 1000,
    });
  };

  export const useSlackChannels = (workspaceId?: string, limit?: number) => {
    return useQuery({
      queryKey: ['slack', 'channels', workspaceId, limit],
      queryFn: () => slackApi.listChannels(workspaceId, limit),
      staleTime: 5 * 60 * 1000,
    });
  };

  export const useAnalyzeSlackUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (request: SlackAnalysisRequest) => slackApi.analyzeUser(request),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['slack', 'users'] });
      },
    });
  };

  export const useAnalyzeSlackChannel = () => {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (request: SlackAnalysisRequest) => slackApi.analyzeChannel(request),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['slack', 'channels'] });
      },
    });
  };
  ```

**Deliverables**:
- Complete Slack API client
- React Query hooks for all Slack operations
- TypeScript types integrated

---

### 4.3 User Profile View

**Objective**: Create UI for viewing Slack user profiles.

**Tasks**:

- [ ] **User Profile Detail Page**
  - File: `ui/src/app/slack/users/[user_id]/page.tsx`
  - Display user engagement metrics
  - Show interests, expertise, opinions
  - Visualize channel activity breakdown (Recharts bar chart)
  - Display AI-generated insights (formatted prose)
  - Show key opinions and pain points (lists)

  **Layout**:
  ```tsx
  export default function UserProfilePage() {
    const params = useParams();
    const { data: profile, isLoading } = useSlackUserProfile(params.user_id as string);

    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header with user info */}
        <UserProfileHeader profile={profile} />

        {/* Engagement metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Channels" value={profile.total_channels} />
          <MetricCard title="Active Channels" value={profile.active_channels} />
          <MetricCard title="Messages" value={profile.total_messages} />
          <MetricCard title="Replies" value={profile.total_replies} />
        </div>

        {/* Interests & Expertise */}
        <InterestsExpertiseCard profile={profile} />

        {/* Channel Activity Chart */}
        <ChannelActivityChart channelBreakdown={profile.channel_breakdown} />

        {/* AI Insights */}
        <AIInsightsCard insights={profile.ai_insights} />

        {/* Key Opinions & Pain Points */}
        <KeyInsightsCard profile={profile} />
      </div>
    );
  }
  ```

- [ ] **User List Page**
  - File: `ui/src/app/slack/users/page.tsx`
  - Table/grid of all analyzed users
  - Filter by influence level, activity level
  - Search by name or email
  - Quick stats preview in cards

  **Features**:
  - Sort by total activity, influence level, last updated
  - Click user card to navigate to detail page
  - "Analyze New User" button to trigger analysis

**Deliverables**:
- User profile detail page
- User list page with search/filter
- Channel activity visualizations

---

### 4.4 Channel Insights View

**Objective**: Create UI for viewing channel analysis and insights.

**Tasks**:

- [ ] **Channel Summary Detail Page**
  - File: `ui/src/app/slack/channels/[channel_id]/page.tsx`
  - Display channel metrics (members, messages analyzed)
  - Show key topics and themes (badges)
  - List feature requests (with priority indicators)
  - Display sentiment analysis (colored badge)
  - Show key contributors (avatar list)
  - Product opportunities section (highlighted cards)
  - Strategic recommendations (action items)
  - Full AI summary (prose format)

  **Layout**:
  ```tsx
  export default function ChannelSummaryPage() {
    const params = useParams();
    const { data: summary, isLoading } = useSlackChannelSummary(params.channel_id as string);

    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header with channel info and sentiment */}
        <ChannelHeader summary={summary} />

        {/* Key Metrics */}
        <MetricsGrid summary={summary} />

        {/* Key Topics */}
        <TopicsCard topics={summary.key_topics} />

        {/* Feature Requests */}
        <FeatureRequestsCard requests={summary.feature_requests} />

        {/* Pain Points */}
        <PainPointsCard painPoints={summary.pain_points} />

        {/* Product Opportunities (highlighted) */}
        <ProductOpportunitiesCard opportunities={summary.product_opportunities} />

        {/* Strategic Recommendations */}
        <RecommendationsCard recommendations={summary.strategic_recommendations} />

        {/* Key Contributors */}
        <ContributorsCard contributors={summary.key_contributors} />

        {/* Full AI Summary */}
        <AISummaryCard summary={summary.ai_summary} />
      </div>
    );
  }
  ```

- [ ] **Channel List Page**
  - File: `ui/src/app/slack/channels/page.tsx`
  - Table of all analyzed channels
  - Filter by sentiment, activity level
  - Sort by members, messages analyzed, last updated
  - Quick preview cards with key metrics
  - "Analyze New Channel" button

**Deliverables**:
- Channel detail page with full insights
- Channel list page with filtering
- Product opportunities visualization

---

### 4.5 Slack Configuration & Trigger UI

**Objective**: Create UI for configuring Slack and triggering analysis.

**Tasks**:

- [ ] **Slack Settings Page**
  - File: `ui/src/app/settings/slack/page.tsx`
  - Configure workspace ID
  - Set default analysis parameters (days, message limits)
  - Test connection button
  - View bot permissions and channel access

- [ ] **Analysis Trigger Component**
  - Component: `ui/src/components/slack/AnalysisTrigger.tsx`
  - Form to trigger user analysis (email or user ID input)
  - Form to trigger channel analysis (channel name or ID input)
  - Progress indicators during analysis
  - Success notification with link to results
  - Error handling with retry button

  **Component Design**:
  ```tsx
  export function AnalysisTrigger({ type }: { type: 'user' | 'channel' }) {
    const [formData, setFormData] = useState({});
    const analyzeUser = useAnalyzeSlackUser();
    const analyzeChannel = useAnalyzeSlackChannel();

    const handleSubmit = async () => {
      try {
        if (type === 'user') {
          await analyzeUser.mutateAsync(formData);
          toast.success('User analysis started! Results will be available in 2-5 minutes.');
        } else {
          await analyzeChannel.mutateAsync(formData);
          toast.success('Channel analysis started! Results will be available in 1-3 minutes.');
        }
      } catch (error) {
        toast.error(`Analysis failed: ${error.message}`);
      }
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Analyze Slack {type === 'user' ? 'User' : 'Channel'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {type === 'user' ? <UserAnalysisForm /> : <ChannelAnalysisForm />}
          <Button onClick={handleSubmit} disabled={analyzeUser.isPending || analyzeChannel.isPending}>
            {analyzeUser.isPending || analyzeChannel.isPending ? 'Analyzing...' : 'Start Analysis'}
          </Button>
        </CardContent>
      </Card>
    );
  }
  ```

**Deliverables**:
- Slack settings page
- Analysis trigger components
- Form validation and error handling

---

### 4.6 Dashboard Integration

**Objective**: Integrate Slack insights into main CommProbe dashboard.

**Tasks**:

- [ ] **Add Slack Tab to Dashboard**
  - File: `ui/src/app/dashboard/page.tsx`
  - Add new tab: "Team Analytics" or "Internal Insights"
  - Show summary cards:
    - Total users analyzed
    - Total channels analyzed
    - Most active users
    - Key channels overview

- [ ] **Create Slack Insights Widget**
  - Component: `ui/src/components/dashboard/SlackInsightsWidget.tsx`
  - Show recent analyses (users and channels)
  - Highlight key findings from latest analyses
  - Quick links to detailed views
  - "Analyze New" button for quick access

- [ ] **Update Navigation**
  - File: `ui/src/components/layout/Sidebar.tsx`
  - Add "Internal Analytics" section with sub-items:
    - User Profiles (icon: Users)
    - Channel Insights (icon: Hash)
    - Slack Settings (icon: Settings)

- [ ] **Update Platform Filter**
  - Add "Slack" to platform filter dropdown (where applicable)
  - Update existing `PlatformFilter` component:
    ```tsx
    <SelectItem value="slack">
      <MessageSquare className="h-4 w-4 inline mr-2" />
      Slack Only
    </SelectItem>
    ```

**Deliverables**:
- Integrated Slack insights in main dashboard
- Navigation updated with Slack sections
- Platform filter includes Slack option

---

## Implementation Checklist Summary

### Phase 1: Prerequisites ✅
- [x] Slack App Configuration (Already complete with working token)
- [ ] Development environment setup
- [ ] Prototype validation

### Phase 2: Backend Implementation
- [ ] Update API documentation (`API_INTEGRATION.md`, `LAMBDA_CONNECTOR.md`, `OpenAPISchema.yaml`)
- [ ] Update CDK stack (DynamoDB table, Lambda function, API endpoints, IAM permissions)
- [ ] Implement Slack Collector Lambda (migrate from prototype)
- [ ] Update API Lambda with 6 new Slack endpoints
- [ ] Update Analyzer and Storer Lambdas for Slack data
- [ ] Deploy infrastructure to AWS

### Phase 3: Testing & Validation
- [ ] Update `scripts/validate-api.sh` with 6 new Slack tests
- [ ] Run validation script and fix failures
- [ ] Document test results

### Phase 4: UI/UX Implementation
- [ ] Update UI documentation (`ui/DESIGN_DOCUMENT.md`, `ui/TYPES_DEFINITIONS.ts`)
- [ ] Implement Slack API client and React Query hooks
- [ ] Build user profile views (list + detail)
- [ ] Build channel insights views (list + detail)
- [ ] Build Slack configuration and trigger UI
- [ ] Integrate into main dashboard
- [ ] Deploy frontend to Cloudflare Pages

---

## Quick Reference

### File Locations

**Backend**:
- Lambda: `lambda/collector/slack/index.py`
- API: `lambda/api/index.py`
- CDK: `infra/aws/lib/stack.ts`
- Docs: `infra/aws/API_INTEGRATION.md`, `infra/aws/LAMBDA_CONNECTOR.md`, `infra/aws/OpenAPISchema.yaml`
- Tests: `scripts/validate-api.sh`

**Frontend**:
- Pages: `ui/src/app/slack/users/`, `ui/src/app/slack/channels/`
- API Client: `ui/src/lib/api/slack.ts`
- Hooks: `ui/src/hooks/useSlackApi.ts`
- Types: `ui/src/types/index.ts`
- Docs: `ui/DESIGN_DOCUMENT.md`, `ui/TYPES_DEFINITIONS.ts`

**Prototype Reference**:
- Source: `infra/prototype/slack/slack_user_analyzer.py`
- Usage examples: `infra/prototype/slack/example_usage.sh`
- Environment: `infra/prototype/slack/.env.example`

## Notes

### Migration from Prototype

The prototype (`infra/prototype/slack/slack_user_analyzer.py`) is **fully functional** and should be migrated with minimal changes:

**Keep As-Is**:
- All analysis logic in `SlackUserAnalyzer` class
- All AI prompts in `BedrockContentAnalyzer` class
- Rate limiting and retry logic
- Data extraction and formatting

**Adapt for Lambda**:
- Remove CLI argument parsing
- Replace `print()` with `logger.info()`
- Add S3 and DynamoDB storage
- Return JSON response instead of printing
- Use environment variables for configuration

### DynamoDB Access Patterns

**Get user profile**:
```python
table.get_item(Key={'PK': 'USER#U123', 'SK': 'WORKSPACE#T123'})
```

**List users by workspace**:
```python
table.query(
    IndexName='WorkspaceIndex',
    KeyConditionExpression='workspace_id = :wid',
    ExpressionAttributeValues={':wid': 'T123'}
)
```

**Get channel summary**:
```python
table.get_item(Key={'PK': 'CHANNEL#C123', 'SK': 'WORKSPACE#T123'})
```
