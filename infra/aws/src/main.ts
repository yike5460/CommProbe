import { App, Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class LegalCrawlerStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // ===========================================
    // Get Reddit API credentials from context
    // ===========================================
    const redditClientId = this.node.tryGetContext('redditClientId');
    const redditClientSecret = this.node.tryGetContext('redditClientSecret');
    const redditUserAgent = this.node.tryGetContext('redditUserAgent') || 'legal-legal-crawler/1.0 by u/YOUR_USERNAME';

    if (!redditClientId || !redditClientSecret) {
      throw new Error(
        'Reddit API credentials are required. Please provide them using:\n' +
        'npx cdk deploy --context redditClientId=YOUR_CLIENT_ID --context redditClientSecret=YOUR_CLIENT_SECRET\n' +
        'Or set them in cdk.json under "context" section.'
      );
    }

    // ===========================================
    // Get Twitter/X API credentials from context
    // ===========================================
    const twitterBearerToken = this.node.tryGetContext('twitterBearerToken');
    const twitterApiKey = this.node.tryGetContext('twitterApiKey');
    const twitterApiSecret = this.node.tryGetContext('twitterApiSecret');

    // Twitter is optional - can deploy without Twitter enabled
    if (!twitterBearerToken) {
      console.warn(
        '⚠️  Twitter API credentials not provided. Twitter collection will be disabled.\n' +
        'To enable Twitter, provide credentials using:\n' +
        'npx cdk deploy \\\n' +
        '  --context redditClientId=iPH6UMuXs_0pFWYBHi8gOg \\\n' +
        '  --context redditClientSecret=K6LYsuo4BTkP_ILb2GpE_45dBQ6PqA \\\n' +
        '  --context twitterBearerToken=YOUR_TWITTER_BEARER_TOKEN'
      );
    }

    // ===========================================
    // Get Slack API credentials from context
    // ===========================================
    const slackBotToken = this.node.tryGetContext('slackBotToken');

    // Slack is optional - can deploy without Slack enabled
    if (!slackBotToken) {
      console.warn(
        '⚠️  Slack Bot Token not provided. Slack analysis will be disabled.\n' +
        'To enable Slack, provide credentials using:\n' +
        'npx cdk deploy \\\n' +
        '  --context redditClientId=YOUR_REDDIT_ID \\\n' +
        '  --context redditClientSecret=YOUR_REDDIT_SECRET \\\n' +
        '  --context twitterBearerToken=YOUR_TWITTER_TOKEN \\\n' +
        '  --context slackBotToken=xoxb-YOUR-SLACK-BOT-TOKEN'
      );
    }

    // ===========================================
    // S3 Buckets
    // ===========================================
    const rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
      bucketName: `supio-raw-data-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldData',
          expiration: Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY, // For dev - change to RETAIN for production
      autoDeleteObjects: true, // For dev - remove for production
    });

    // ===========================================
    // DynamoDB Tables
    // ===========================================

    // Insights Table
    const insightsTable = new dynamodb.Table(this, 'SupioInsights', {
      tableName: 'supio-insights',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY, // For dev - change to RETAIN for production
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Add GSI for priority access
    insightsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // System Configuration Table
    const configTable = new dynamodb.Table(this, 'SystemConfigTable', {
      tableName: 'supio-system-config',
      partitionKey: {
        name: 'config_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN, // Keep configuration even if stack is deleted
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Slack Profiles Table
    const slackProfilesTable = new dynamodb.Table(this, 'SlackProfilesTable', {
      tableName: 'supio-slack-profiles',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // Auto-cleanup after 180 days
      removalPolicy: RemovalPolicy.RETAIN, // Keep Slack data even if stack is deleted
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Add GSI for workspace-wide queries
    slackProfilesTable.addGlobalSecondaryIndex({
      indexName: 'WorkspaceIndex',
      partitionKey: {
        name: 'workspace_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'last_updated',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Slack Jobs Table - Tracks async analysis job status
    const slackJobsTable = new dynamodb.Table(this, 'SlackJobsTable', {
      tableName: 'supio-slack-jobs',
      partitionKey: {
        name: 'job_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl', // Auto-cleanup after 7 days
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Add GSI for user lookups (find jobs by user_id)
    slackJobsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // ===========================================
    // Lambda Layer for Python Dependencies
    // ===========================================
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/layer'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output/python && cp -au . /asset-output/',
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Dependencies for Reddit crawler Lambda functions',
    });

    // ===========================================
    // Lambda Functions
    // ===========================================

    // Reddit Collector Lambda
    const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        REDDIT_CLIENT_ID: redditClientId,
        REDDIT_CLIENT_SECRET: redditClientSecret,
        REDDIT_USER_AGENT: redditUserAgent,
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant S3 permissions to Reddit collector
    rawDataBucket.grantReadWrite(collectorFunction);

    // Twitter/X Collector Lambda
    const twitterCollectorFunction = new lambda.Function(this, 'TwitterCollectorFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector/twitter')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        TWITTER_BEARER_TOKEN: twitterBearerToken || 'DISABLED',
        TWITTER_API_KEY: twitterApiKey || 'DISABLED',
        TWITTER_API_SECRET: twitterApiSecret || 'DISABLED',
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant S3 permissions to Twitter collector
    rawDataBucket.grantReadWrite(twitterCollectorFunction);

    // Slack Collector Lambda
    const slackCollectorFunction = new lambda.Function(this, 'SlackCollectorFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector/slack')),
      handler: 'index.handler',
      timeout: Duration.minutes(15), // Higher timeout for AI analysis
      memorySize: 2048, // Higher memory for Bedrock AI analysis
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        SLACK_BOT_TOKEN: slackBotToken || 'DISABLED',
        SLACK_PROFILES_TABLE: slackProfilesTable.tableName,
        SLACK_JOBS_TABLE: slackJobsTable.tableName,
        CONFIG_TABLE_NAME: configTable.tableName,
        AWS_BEDROCK_REGION: this.region,
        MODEL_ID: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant S3 permissions to Slack collector
    rawDataBucket.grantReadWrite(slackCollectorFunction);

    // Grant DynamoDB permissions to Slack collector
    slackProfilesTable.grantReadWriteData(slackCollectorFunction);
    slackJobsTable.grantWriteData(slackCollectorFunction);
    configTable.grantReadData(slackCollectorFunction);

    // Grant Bedrock permissions to Slack collector (inline AI analysis)
    slackCollectorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    );

    // Analyzer Lambda (Bedrock integration)
    const analyzerFunction = new lambda.Function(this, 'AnalyzerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/analyzer')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 2048,
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        MODEL_ID: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        BEDROCK_REGION: this.region,
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Bedrock permissions to analyzer
    analyzerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    );

    // Grant S3 permissions to analyzer (needs write access to save analysis results)
    rawDataBucket.grantReadWrite(analyzerFunction);

    // Storer Lambda (DynamoDB writer)
    const storerFunction = new lambda.Function(this, 'StorerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/storer')),
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      memorySize: 512,
      environment: {
        TABLE_NAME: insightsTable.tableName,
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to storer
    insightsTable.grantReadWriteData(storerFunction);

    // Grant S3 read permissions to storer (needs to read analysis results)
    rawDataBucket.grantRead(storerFunction);

    // ===========================================
    // Step Functions State Machine
    // ===========================================

    // Task definitions for Reddit collection
    const collectRedditTask = new sfnTasks.LambdaInvoke(this, 'CollectRedditPosts', {
      lambdaFunction: collectorFunction,
      outputPath: '$.Payload',
    });

    // Task definitions for Twitter collection
    const collectTwitterTask = new sfnTasks.LambdaInvoke(this, 'CollectTwitterPosts', {
      lambdaFunction: twitterCollectorFunction,
      outputPath: '$.Payload',
    });

    // NOTE: Slack collector is NOT part of the Step Functions pipeline
    // Slack has a different event structure and is only invoked directly by API Lambda
    // via dedicated endpoints: POST /slack/analyze/user and POST /slack/analyze/channel

    const analyzeTask = new sfnTasks.LambdaInvoke(this, 'AnalyzePosts', {
      lambdaFunction: analyzerFunction,
      outputPath: '$.Payload',
    });

    const storeTask = new sfnTasks.LambdaInvoke(this, 'StoreInsights', {
      lambdaFunction: storerFunction,
      outputPath: '$.Payload',
    });

    // Create parallel collection state for Reddit + Twitter
    // NOTE: Slack is NOT included here - it's invoked separately via API endpoints
    const parallelCollection = new sfn.Parallel(this, 'ParallelCollection', {
      comment: 'Collect from Reddit and Twitter in parallel',
      resultPath: '$.collectionResults',
    });

    // Add Reddit and Twitter collection branches
    parallelCollection.branch(collectRedditTask);
    parallelCollection.branch(collectTwitterTask);

    // Chain: Parallel collection -> Analyze -> Store
    const definition = parallelCollection
      .next(analyzeTask)
      .next(storeTask);

    // Create state machine
    const stateMachine = new sfn.StateMachine(this, 'MultiSourceInsightsPipeline', {
      definition,
      timeout: Duration.hours(1),
      stateMachineName: 'supio-multi-source-insights-pipeline',
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          retention: logs.RetentionDays.ONE_WEEK,
        }),
        level: sfn.LogLevel.ALL,
      },
    });

    // ===========================================
    // EventBridge Scheduling
    // ===========================================

    // Weekly schedule for multi-source (Reddit + Twitter + Slack) collection
    new events.Rule(this, 'WeeklyMultiSourceCollection', {
      ruleName: 'supio-weekly-multi-source-insights',
      description: 'Trigger Reddit, Twitter, and Slack collection every Monday morning',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        weekDay: 'MON',
      }),
      targets: [new eventsTargets.SfnStateMachine(stateMachine)],
    });

    // ===========================================
    // Manual Trigger Lambda (optional)
    // ===========================================
    
    const triggerFunction = new lambda.Function(this, 'TriggerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromInline(`
import boto3
import json
import os

def handler(event, context):
    """Manually trigger the Step Functions state machine"""
    sfn = boto3.client('stepfunctions')
    
    response = sfn.start_execution(
        stateMachineArn=os.environ['STATE_MACHINE_ARN'],
        input=json.dumps({
            'manual_trigger': True,
            'trigger_time': context.aws_request_id
        })
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'executionArn': response['executionArn'],
            'startDate': str(response['startDate'])
        })
    }
      `),
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permission to trigger state machine
    stateMachine.grantStartExecution(triggerFunction);

    // ===========================================
    // API Gateway for External Access
    // ===========================================

    // API Lambda with dedicated code file
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/api')),
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
        INSIGHTS_TABLE_NAME: insightsTable.tableName,
        CONFIG_TABLE_NAME: configTable.tableName,
        SLACK_PROFILES_TABLE_NAME: slackProfilesTable.tableName,
        SLACK_JOBS_TABLE_NAME: slackJobsTable.tableName,
        SLACK_COLLECTOR_FUNCTION_NAME: slackCollectorFunction.functionName,
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to API function
    stateMachine.grantStartExecution(apiFunction);
    stateMachine.grantRead(apiFunction);

    // Grant permissions to invoke Slack collector Lambda
    slackCollectorFunction.grantInvoke(apiFunction);

    // Grant DynamoDB permissions for Slack profiles and jobs
    slackProfilesTable.grantReadWriteData(apiFunction);
    slackJobsTable.grantReadWriteData(apiFunction);

    // Grant explicit Step Functions execution management permissions
    // Note: Execution ARN pattern is different from state machine ARN pattern
    // State machine: arn:aws:states:REGION:ACCOUNT:stateMachine:NAME
    // Execution:      arn:aws:states:REGION:ACCOUNT:execution:NAME:EXECUTION_ID
    const executionArnPattern = stateMachine.stateMachineArn.replace(':stateMachine:', ':execution:') + ':*';

    apiFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'states:DescribeExecution',
        'states:StopExecution',
        'states:GetExecutionHistory',
      ],
      resources: [
        executionArnPattern, // All executions of this state machine
      ],
    }));

    // Grant DynamoDB read permissions for insights endpoints
    insightsTable.grantReadData(apiFunction);

    // Grant DynamoDB read/write permissions for configuration endpoints
    configTable.grantReadWriteData(apiFunction);

    // Create REST API
    const api = new apigateway.RestApi(this, 'CrawlerApi', {
      restApiName: 'Supio Reddit Crawler API',
      description: 'API for triggering and monitoring Reddit crawl jobs',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': `{ "statusCode": "200" }` },
      allowTestInvoke: false,  // Disable test-invoke-stage permissions to reduce policy size by 50%
    });

    // API routes
    api.root.addMethod('GET', lambdaIntegration); // GET / - Documentation

    const triggerResource = api.root.addResource('trigger');
    triggerResource.addMethod('POST', lambdaIntegration); // POST /trigger

    const statusResource = api.root.addResource('status');
    const statusByIdResource = statusResource.addResource('{executionName}');
    statusByIdResource.addMethod('GET', lambdaIntegration); // GET /status/{executionName}

    const executionsResource = api.root.addResource('executions');
    executionsResource.addMethod('GET', lambdaIntegration); // GET /executions

    // Priority 1: Essential Data Access Endpoints
    const insightsResource = api.root.addResource('insights');
    insightsResource.addMethod('GET', lambdaIntegration); // GET /insights

    const insightByIdResource = insightsResource.addResource('{insightId}');
    insightByIdResource.addMethod('GET', lambdaIntegration); // GET /insights/{insightId}

    const analyticsResource = api.root.addResource('analytics');
    const analyticsSummaryResource = analyticsResource.addResource('summary');
    analyticsSummaryResource.addMethod('GET', lambdaIntegration); // GET /analytics/summary

    // Priority 3: Enhanced Analytics Endpoints
    const analyticsTrendsResource = analyticsResource.addResource('trends');
    analyticsTrendsResource.addMethod('GET', lambdaIntegration); // GET /analytics/trends

    const analyticsCompetitorsResource = analyticsResource.addResource('competitors');
    analyticsCompetitorsResource.addMethod('GET', lambdaIntegration); // GET /analytics/competitors

    // Priority 4: Operational Endpoints
    const executionByIdResource = executionsResource.addResource('{executionName}');
    executionByIdResource.addMethod('DELETE', lambdaIntegration); // DELETE /executions/{executionName}

    const logsResource = api.root.addResource('logs');
    const logsByIdResource = logsResource.addResource('{executionName}');
    logsByIdResource.addMethod('GET', lambdaIntegration); // GET /logs/{executionName}

    // Priority 2: Configuration & Management Endpoints
    const configResource = api.root.addResource('config');
    configResource.addMethod('GET', lambdaIntegration); // GET /config
    configResource.addMethod('PUT', lambdaIntegration); // PUT /config

    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', lambdaIntegration); // GET /health

    // Slack API Endpoints
    const slackResource = api.root.addResource('slack');

    // User analysis endpoints
    const slackAnalyzeResource = slackResource.addResource('analyze');
    const slackAnalyzeUserResource = slackAnalyzeResource.addResource('user');
    slackAnalyzeUserResource.addMethod('POST', lambdaIntegration); // POST /slack/analyze/user

    const slackUsersResource = slackResource.addResource('users');
    slackUsersResource.addMethod('GET', lambdaIntegration); // GET /slack/users

    const slackUserByIdResource = slackUsersResource.addResource('{user_id}');
    slackUserByIdResource.addMethod('GET', lambdaIntegration); // GET /slack/users/{user_id}

    // Channel analysis endpoints
    const slackAnalyzeChannelResource = slackAnalyzeResource.addResource('channel');
    slackAnalyzeChannelResource.addMethod('POST', lambdaIntegration); // POST /slack/analyze/channel

    const slackChannelsResource = slackResource.addResource('channels');
    slackChannelsResource.addMethod('GET', lambdaIntegration); // GET /slack/channels

    const slackChannelByIdResource = slackChannelsResource.addResource('{channel_id}');
    slackChannelByIdResource.addMethod('GET', lambdaIntegration); // GET /slack/channels/{channel_id}

    // Job status endpoint
    const slackJobsResource = slackResource.addResource('jobs');
    const slackJobByIdResource = slackJobsResource.addResource('{job_id}');
    const slackJobStatusResource = slackJobByIdResource.addResource('status');
    slackJobStatusResource.addMethod('GET', lambdaIntegration); // GET /slack/jobs/{job_id}/status

    // Configuration endpoints
    const slackConfigResource = slackResource.addResource('config');
    slackConfigResource.addMethod('GET', lambdaIntegration); // GET /slack/config
    slackConfigResource.addMethod('PUT', lambdaIntegration); // PUT /slack/config

    // Output the API URL
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the Multi-Source Intelligence API (Reddit + Twitter + Slack)',
      exportName: 'MultiSourceInsightsApiUrl',
    });

    // Output the API Key for external access (if needed)
    const apiKey = api.addApiKey('CrawlerApiKey', {
      apiKeyName: 'supio-reddit-crawler-key',
      description: 'API Key for Reddit Crawler API',
    });

    const usagePlan = api.addUsagePlan('CrawlerUsagePlan', {
      name: 'supio-reddit-crawler-usage',
      description: 'Usage plan for Reddit Crawler API',
      throttle: {
        rateLimit: 10,  // 10 requests per second
        burstLimit: 20, // 20 concurrent requests
      },
      quota: {
        limit: 1000,    // 1000 requests per month
        period: apigateway.Period.MONTH,
      },
      apiStages: [
        {
          api: api,
          stage: api.deploymentStage,
        },
      ],
    });

    usagePlan.addApiKey(apiKey);

    new CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID for Reddit Crawler API',
      exportName: 'RedditCrawlerApiKeyId',
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-west-2',
};

const app = new App();

new LegalCrawlerStack(app, 'legal-crawler-dev', { env: devEnv });

app.synth();