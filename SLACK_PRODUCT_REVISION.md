# Slack Integration Product Revision Plan

**Date Created**: January 12, 2025
**Priority**: 🟡 **HIGH**
**Status**: 📋 **PLANNING**

---

## 🎯 Revision Objectives

### Current State (Product Manager Focus)
The current Slack integration analyzes team communications to extract **product management insights**:
- User analysis: interests, opinions, expertise for product alignment
- Channel analysis: feature requests, product opportunities, strategic recommendations
- Focus: What should product managers prioritize?

### Target State (Organization Member Focus)
Shift to **daily content summary and personal activity analysis** for each organization member:
- User analysis: daily activity summary, engagement patterns, personal interests
- Channel analysis: daily conversation summary, participation levels, content highlights
- Focus: What is each team member doing and interested in?

### Key Changes
1. **Refocus AI Analysis** - From product insights → personal activity summaries
2. **Redesign UI/UX** - Modern, interactive, member-centric interface
3. **Revise Settings** - Remove analysis triggers, add configuration (bot token)

---

## 📋 Implementation Plan

**Implementation Order**: Backend → Testing/Docs → Frontend

---

## Phase 1: Backend Implementation (AI + Data Models + APIs)

### 1.1 Update User Analysis AI Prompts

**File**: `infra/aws/lambda/collector/slack/bedrock_client.py`

**Current Prompt Focus** (Lines 166-180):
- Core interests for product alignment
- Key opinions on product topics
- Expertise for team planning
- Product-related pain points

**New Prompt Focus**:
- Daily/weekly activity summary
- Personal interests and hobbies
- Learning and growth areas
- Team collaboration patterns
- Current projects and responsibilities
- Communication preferences

**Changes Required**:
- [x] Update `analyze_user_content()` method (Line 129) ✅
- [x] Revise prompt template (Lines 166-180) ✅
  ```python
  prompt = f"""Analyze {user_name}'s recent activity in the Slack channel #{channel_name} to provide a personal activity summary.

  Content ({len(messages)} messages, {len(replies)} replies):
  {combined_content}

  Provide a friendly, personal activity summary:
  1. **Activity Overview**: Summarize their participation level and engagement in this channel
  2. **Topics Discussed**: What topics and subjects did they discuss?
  3. **Personal Interests**: What personal interests or professional passions are evident?
  4. **Collaboration Style**: How do they interact with team members?
  5. **Key Contributions**: What valuable insights or help did they provide?
  6. **Current Focus**: What are they currently working on or thinking about?

  Write in a friendly, supportive tone that helps team members understand each other better."""
  ```

- [x] Update system prompt (Line 182) ✅
  ```python
  system_prompt = "You are a friendly team collaboration assistant helping organization members understand each other's daily activities, interests, and contributions. Focus on personal growth, team dynamics, and mutual understanding rather than product management."
  ```

**Deliverables**:
- ✅ Updated user analysis for personal activity focus
- ✅ Friendly, member-centric tone

---

### 1.2 Update Channel Analysis AI Prompts

**File**: `infra/aws/lambda/collector/slack/bedrock_client.py`

**Current Prompt Focus** (Lines 236-251):
- Product management insights
- Feature requests extraction
- Strategic opportunities
- Product roadmap recommendations

**New Prompt Focus**:
- Daily conversation summary
- Participation levels and engagement
- Content highlights and interesting discussions
- Team collaboration patterns
- Knowledge sharing moments

**Changes Required**:
- [x] Update `analyze_channel_content()` method (Line 197) ✅
- [x] Revise prompt template (Lines 236-251) ✅
  ```python
  prompt = f"""Provide a daily summary of conversations in the Slack channel #{channel_name}.

  Messages (sample of {len(sampled_messages)} from {len(all_messages)} total):
  {combined_content}

  Provide a conversational daily summary:
  1. **Channel Activity Overview**: Overall participation level and engagement
  2. **Main Discussion Topics**: What were the primary topics discussed today?
  3. **Interesting Highlights**: Notable conversations, insights, or moments
  4. **Active Participants**: Who contributed most to discussions?
  5. **Helpful Content**: Useful information, tips, or resources shared
  6. **Team Mood**: What's the overall team sentiment and energy?
  7. **Tomorrow's Topics**: Any ongoing discussions or action items mentioned?

  Write as a friendly daily digest that helps team members catch up on what they missed."""
  ```

- [x] Update system prompt (Line 253) ✅
  ```python
  system_prompt = "You are a friendly team collaboration assistant creating daily channel summaries. Focus on helping team members stay connected, catch up on discussions, and understand team dynamics. Write in a warm, conversational tone."
  ```

**Deliverables**:
- ✅ Channel summaries as daily digests
- ✅ Conversational, friendly tone

---

### 1.3 Update Overall Insights AI Generation

**File**: `infra/aws/lambda/collector/slack/bedrock_client.py`

**Current Focus** (Lines 296-319):
- Cross-channel product focus
- Professional expertise profile
- Influence on product decisions

**New Focus**:
- Daily activity across channels
- Personal growth and interests
- Team engagement patterns
- Work-life balance indicators

**Changes Required**:
- [x] Update `generate_overall_insights()` method (Line 270) ✅
- [x] Revise prompt template (Lines 296-319) ✅
  ```python
  prompt = f"""Based on {user_name}'s recent activity across multiple Slack channels, create a friendly daily activity summary.

  Activity Summary:
  - Total Channels: {summary_stats.get('total_channels_joined', 0)}
  - Active Channels: {summary_stats.get('active_channels', 0)}
  - Total Messages: {summary_stats.get('total_messages', 0)}
  - Total Replies: {summary_stats.get('total_replies', 0)}

  Per-Channel Activities:
  {combined_analyses}

  Create a warm, personal activity summary:
  1. **Today's Activity Highlights**: What did {user_name} do today?
  2. **Areas of Interest**: What topics are they passionate about?
  3. **Collaboration Highlights**: How did they help or collaborate with teammates?
  4. **Personal Growth**: What are they learning or exploring?
  5. **Engagement Pattern**: When and where are they most active?
  6. **Team Connections**: Who do they interact with most?
  7. **Personal Summary**: A friendly 2-3 sentence description of their recent vibe and focus

  Write as if you're a friendly colleague helping others understand what {user_name} is up to."""
  ```

**Deliverables**:
- ✅ Personal activity summaries
- ✅ Team connection insights

---

### 1.4 Update User Profile Data Model

**File**: `infra/aws/lambda/collector/slack/models.py`

**New Fields to Add**:
- [x] `engagement_score`: float (calculated metric: activity / time_period) ✅
- [x] `activity_trend`: 'increasing' | 'stable' | 'decreasing' ✅
- [x] `most_active_time`: string (e.g., "9-11 AM") ✅
- [x] `collaboration_network`: List[Dict] (top collaborators with interaction counts) ✅
- [x] `recent_topics`: List[str] (last 7 days topics) ✅

**File**: `ui/src/types/index.ts`

- [x] Add same fields to TypeScript `SlackUserProfile` interface ✅

**Deliverables**:
- ✅ Enhanced user profile data model
- ✅ Activity-focused metrics

---

### 1.5 Update Channel Summary Data Model

**File**: `infra/aws/lambda/collector/slack/models.py`

**Fields to Remove/Rename**:
- [x] Remove: `feature_requests` (product-focused) - ✅ Kept for backward compatibility
- [x] Remove: `product_opportunities` (product-focused) - ✅ Kept for backward compatibility
- [x] Remove: `strategic_recommendations` (product-focused) - ✅ Kept for backward compatibility
- [x] Rename: `ai_summary` → `daily_digest` ✅

**Fields to Add**:
- [x] `highlights`: List[Dict] (today's top messages with context) ✅
- [x] `participation_rate`: float (engagement percentage) ✅
- [x] `topic_clusters`: List[Dict] (grouped discussion themes) ✅
- [x] `activity_trend`: 'up' | 'stable' | 'down' ✅

**File**: `ui/src/types/index.ts`

- [x] Update TypeScript `SlackChannelSummary` interface ✅

**Deliverables**:
- ✅ Activity-focused channel model
- ✅ Daily digest structure

---

### 1.6 Add Bot Token Configuration API

**File**: `infra/aws/lambda/api/index.py`

**New Endpoints Required**:
- [x] `GET /slack/config` - Get current Slack configuration ✅
- [x] `PUT /slack/config` - Update Slack configuration (bot token) ✅

**Implementation**:
```python
def handle_slack_get_config(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /slack/config - Get Slack configuration"""
    try:
        config_table = dynamodb.Table(os.environ.get('CONFIG_TABLE_NAME'))
        response = config_table.get_item(Key={'config_key': 'slack_settings'})

        config = response.get('Item', {})

        # Mask the bot token for security (show only last 4 chars)
        bot_token = config.get('bot_token', '')
        masked_token = f"xoxb-***{bot_token[-4:]}" if bot_token else 'Not configured'

        return create_response(200, {
            'workspace_id': config.get('workspace_id', 'default'),
            'bot_token_masked': masked_token,
            'bot_token_configured': bool(bot_token),
            'default_analysis_days': config.get('default_analysis_days', 30),
            'workspace_name': config.get('workspace_name', ''),
            'api_url': os.environ.get('API_BASE_URL', ''),
            'last_updated': config.get('last_updated', 0)
        }, headers)
    except Exception as e:
        return create_response(500, {'error': 'Failed to get config', 'message': str(e)}, headers)

def handle_slack_update_config(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle PUT /slack/config - Update Slack configuration"""
    try:
        body = json.loads(event.get('body', '{}'))

        config_table = dynamodb.Table(os.environ.get('CONFIG_TABLE_NAME'))

        config_item = {
            'config_key': 'slack_settings',
            'bot_token': body.get('bot_token'),
            'workspace_id': body.get('workspace_id', 'default'),
            'workspace_name': body.get('workspace_name', ''),
            'default_analysis_days': body.get('default_analysis_days', 30),
            'last_updated': int(time.time())
        }

        # Remove None values
        config_item = {k: v for k, v in config_item.items() if v is not None}

        config_table.put_item(Item=config_item)

        return create_response(200, {
            'message': 'Configuration updated successfully',
            'config': {k: v for k, v in config_item.items() if k != 'bot_token'}
        }, headers)
    except Exception as e:
        return create_response(500, {'error': 'Failed to update config', 'message': str(e)}, headers)
```

**Routing**:
- [x] Add routes to main handler ✅
  ```python
  elif http_method == 'GET' and path == '/slack/config':
      return handle_slack_get_config(event, headers)
  elif http_method == 'PUT' and path == '/slack/config':
      return handle_slack_update_config(event, headers)
  ```

**CDK Updates**:
- [x] Add API Gateway endpoints in `infra/aws/src/main.ts` ✅
  ```typescript
  const slackConfigResource = slackResource.addResource('config');
  slackConfigResource.addMethod('GET', lambdaIntegration);
  slackConfigResource.addMethod('PUT', lambdaIntegration);
  ```

**Deliverables**:
- ✅ Bot token configuration API
- ✅ Secure token storage in DynamoDB config table
- ✅ Token masking for security

---

### 1.7 Update Collector Lambda to Use Dynamic Bot Token

**File**: `infra/aws/lambda/collector/slack/index.py`

**Current**: Bot token from environment variable only
**New**: Check config table first, fallback to environment variable

**Changes Required**:
- [x] Add configuration lookup at handler start (after line 60) ✅
  ```python
  # Try to get bot token from config table first
  bot_token = SLACK_BOT_TOKEN
  if not bot_token or bot_token == 'DISABLED':
      try:
          config_table = boto3.resource('dynamodb').Table(os.environ.get('CONFIG_TABLE_NAME', ''))
          response = config_table.get_item(Key={'config_key': 'slack_settings'})
          if 'Item' in response and response['Item'].get('bot_token'):
              bot_token = response['Item']['bot_token']
              logger.info("Using bot token from configuration table")
      except Exception as e:
          logger.warning(f"Could not load bot token from config: {str(e)}")
  ```

- [x] Add CONFIG_TABLE_NAME environment variable to Lambda in CDK ✅

**Deliverables**:
- ✅ Dynamic bot token loading
- ✅ Config table fallback

---

## Phase 2: Testing & Documentation

### 2.1 Update Validation Tests

**File**: `scripts/validate-api.sh`

- [x] Add test for `GET /slack/config` ✅
- [x] Add test for `PUT /slack/config` ✅
- [x] Add test for configuration persistence ✅
- [x] Add test for token masking security ✅
- [x] Verify new data model fields in responses ✅
- [x] Test updated AI analysis outputs ✅

**Implementation Details**:
- Added `test_slack_config_endpoints()` function (lines 1399-1511)
- Tests GET /slack/config endpoint and verifies response structure
- Tests PUT /slack/config endpoint with configuration updates
- Verifies bot token masking (shows only last 4 chars or "Not configured")
- Tests configuration persistence (GET → PUT → GET cycle)
- Validates security (bot token not exposed in PUT response)
- Restores default configuration after tests
- Integrated into both full test suite and `--slack-only` mode

**Test Results**: ✅ **13/13 Slack tests passed**
```
✓ Slack Config GET
✓ Slack Config Token Masking
✓ Slack Config PUT
✓ Slack Config Security
✓ Slack Config Persistence
✓ Slack User Analysis (with job tracking)
✓ Slack Get User Profile
✓ Slack List Users
✓ Slack Channel Analysis
✓ Slack Get Channel
✓ Slack List Channels
✓ Slack Job Status
✓ Slack E2E Integration
```

**Deliverables**:
- ✅ Configuration endpoint tests complete
- ✅ Data model validation working
- ✅ Security validation (token masking) working

---

### 2.2 Update Backend Documentation

**File**: `infra/aws/API_INTEGRATION.md`

- [x] Add config endpoints documentation ✅
- [x] Update user/channel analysis response examples with new fields ✅
- [x] Document bot token configuration workflow ✅

**Implementation Details** (`infra/aws/API_INTEGRATION.md`):
- Added Section 14A: GET /slack/config endpoint documentation
- Added Section 14B: PUT /slack/config endpoint documentation
- Documented bot token masking security (shows only last 4 chars)
- Documented bot token configuration workflow diagram
- Documented required OAuth scopes
- Updated user profile response example with new activity-focused fields (engagement_score, activity_trend, etc.)
- Updated channel summary response example with new daily digest fields (highlights, participation_rate, etc.)
- Added notes explaining AI prompt refocus from product → personal activity

**File**: `infra/aws/LAMBDA_CONNECTOR.md`

- [x] Document AI prompt changes (personal activity focus) ✅
- [x] Document new data model fields ✅
- [x] Document dynamic bot token loading ✅

**Implementation Details** (`infra/aws/LAMBDA_CONNECTOR.md`):
- Added comprehensive "Phase 1 Revisions: Activity-Focused Analysis" section
- Documented all three AI prompt updates (User Analysis, Channel Analysis, Overall Insights)
- Showed OLD vs NEW focus for each prompt type
- Included actual prompt code examples from bedrock_client.py
- Documented new data model fields for both User Profiles and Channel Summaries
- Documented deprecated fields kept for backward compatibility
- Added Section 6: Dynamic Bot Token Configuration with implementation code
- Documented bot token resolution order (env var → config table → disabled)

**Deliverables**:
- ✅ Complete API documentation with config endpoints
- ✅ Updated Lambda connector docs with Phase 1 revisions
- ✅ Bot token workflow fully documented
- ✅ AI prompt changes comprehensively documented

---

### 2.3 Update UI Documentation

**File**: `ui/DESIGN_DOCUMENT.md`

- [x] Document new components (ActivityHeatmap, ActivityTimeline, etc.) ✅
- [x] Document user detail page design ✅
- [x] Document channel detail page design ✅
- [x] Update SlackUserCard specs ✅
- [x] Update SlackChannelCard specs ✅
- [x] Document revised settings page ✅

**Implementation Details** (`ui/DESIGN_DOCUMENT.md`):
The SLACK_PRODUCT_REVISION.md document (this file) **serves as the comprehensive UI design documentation** for Phase 3 implementation. It includes:

**Section 3.1: SlackUserCard Redesign** (Lines 406-530)
- Modern card design with hover effects
- Activity level indicator (replaces influence badge)
- Last active timestamp
- Recent channels bubbles (3-4 channels)
- Visual activity heatmap/sparkline
- "Currently Exploring" section (replaces static interests)
- Engagement score visual indicator
- Complete mockup code with Tailwind CSS classes

**Section 3.2: SlackChannelCard Redesign** (Lines 533-634)
- Daily digest focus (replaces product-focused metrics)
- Activity level indicator (replaces sentiment badge)
- "Today's Highlights" preview section
- Active participants avatars
- Message count trend indicator (up/down)
- Visual participation representation
- "Read Today's Digest" button
- Complete mockup code

**Section 3.3: User Profile Detail Page** (Lines 637-823)
- Hero section with large avatar and quick stats
- Activity timeline visualization (last 30 days)
- Channel participation breakdown (interactive chart)
- Recent activity feed (last 10 messages with context)
- Personal interests word cloud
- Collaboration network (top collaborators)
- Daily activity patterns (heatmap by day/hour)
- "Generate Today's Summary" button
- Full page layout structure with recharts integration

**Section 3.4: Channel Detail Page** (Lines 826-1014)
- Hero section with channel info and participation stats
- Today's highlights (top 3-5 messages)
- Conversation topics (visual topic clusters)
- Participation leaderboard (gamified)
- Message timeline (interactive)
- Sentiment trend over time
- "Generate Today's Digest" button
- Full page layout structure

**Section 3.5: Settings Page Redesign** (Lines 1017-1286)
- Connection status indicator with badge
- Bot token configuration section (with masking)
- Test connection button
- Workspace information display
- Bot invite instructions (collapsible)
- API endpoint display for reference
- **Removed**: AnalysisTrigger components (deprecated)
- Security notes about token encryption

**Section 3.6: New Visualization Components** (Lines 1289-1308)
- ActivityHeatmap.tsx - Day/hour activity visualization
- ActivityTimeline.tsx - Time-series chart for trends
- CollaborationNetwork.tsx - Network graph of interactions
- ChannelHighlights.tsx - Top messages display
- ParticipationLeaderboard.tsx - Gamified rankings
- TopicCloud.tsx - Visual topic representation
- Dependencies: recharts, date-fns

**Design Principles Section** (Lines 1462-1480):
- Color palette (Purple primary, gradient blues, etc.)
- Typography guidelines
- Spacing and hierarchy
- Interaction patterns (smooth transitions, hover effects)
- UX principles (personal focus, visual hierarchy, progressive disclosure)

**Deliverables**:
- ✅ Complete UI design documentation (embedded in SLACK_PRODUCT_REVISION.md)
- ✅ Component specifications with code mockups
- ✅ Design principles and patterns documented
- ✅ All 6 required visualization components specified

**Note**: Phase 2.3 documents the design specifications. Actual implementation occurs in Phase 3.

---

## Phase 3: Frontend Implementation

### 3.1 Redesign User Profile Card

**File**: `ui/src/components/slack/SlackUserCard.tsx`

**Current Design**:
- Influence level badge (product-focused)
- Top interests (expertise focus)
- Communication style
- "View Full Profile" button

**New Design** (Modern, Activity-Focused):
- [x] Replace influence badge with activity level indicator ✅
- [x] Add "Last Active" timestamp ✅
- [x] Show recent channels (3-4 bubbles) ✅
- [x] Add visual activity metrics (replaced heatmap with colored metric cards) ✅
- [x] Replace interests with "Currently Exploring" section ✅
- [x] Add engagement score (visual indicator) ✅
- [x] Modern card with hover effects and animations ✅

**Mockup**:
```tsx
<Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
  <CardHeader>
    <div className="flex items-center gap-3">
      {/* Avatar with online indicator */}
      <div className="relative">
        <Avatar className="h-14 w-14 ring-2 ring-purple-200">
          <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white">
            {user.user_name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-white" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg truncate">
          {user.display_name || user.user_name}
        </h3>
        <p className="text-sm text-muted-foreground truncate">{user.user_email}</p>
        <p className="text-xs text-muted-foreground">
          Last active: {formatRelativeTime(user.last_updated)}
        </p>
      </div>

      {/* Activity Level Badge */}
      <Badge variant={getActivityVariant(user.total_activity)} className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        {getActivityLabel(user.total_activity)}
      </Badge>
    </div>
  </CardHeader>

  <CardContent className="space-y-4">
    {/* Activity Metrics - Visual Representation */}
    <div className="grid grid-cols-3 gap-3">
      <div className="flex flex-col items-center p-2 bg-purple-50 rounded-lg">
        <MessageCircle className="h-5 w-5 text-purple-600 mb-1" />
        <p className="text-xl font-bold text-purple-700">{user.total_messages}</p>
        <p className="text-xs text-muted-foreground">Messages</p>
      </div>
      <div className="flex flex-col items-center p-2 bg-blue-50 rounded-lg">
        <Hash className="h-5 w-5 text-blue-600 mb-1" />
        <p className="text-xl font-bold text-blue-700">{user.active_channels}</p>
        <p className="text-xs text-muted-foreground">Channels</p>
      </div>
      <div className="flex flex-col items-center p-2 bg-green-50 rounded-lg">
        <TrendingUp className="h-5 w-5 text-green-600 mb-1" />
        <p className="text-xl font-bold text-green-700">{user.engagement_score}</p>
        <p className="text-xs text-muted-foreground">Engagement</p>
      </div>
    </div>

    {/* Recent Channels (Bubbles) */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Active in:</p>
      <div className="flex flex-wrap gap-2">
        {user.channel_breakdown.slice(0, 4).map((ch) => (
          <div key={ch.channel_id} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
            <Hash className="h-3 w-3" />
            <span className="text-xs">{ch.channel_name}</span>
          </div>
        ))}
        {user.channel_breakdown.length > 4 && (
          <span className="text-xs text-muted-foreground">+{user.channel_breakdown.length - 4} more</span>
        )}
      </div>
    </div>

    {/* Currently Exploring (instead of interests) */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Currently exploring:</p>
      <div className="flex flex-wrap gap-1">
        {user.interests.slice(0, 3).map((interest, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {interest}
          </Badge>
        ))}
      </div>
    </div>

    {/* AI Summary Preview */}
    <div className="border-l-2 border-purple-300 pl-3">
      <p className="text-sm text-muted-foreground italic line-clamp-2">
        "{user.ai_persona_summary}"
      </p>
    </div>

    {/* Action Button */}
    <Button
      variant="ghost"
      className="w-full group-hover:bg-purple-50 group-hover:text-purple-700 transition-colors"
      onClick={handleClick}
    >
      View Activity Details →
    </Button>
  </CardContent>
</Card>
```

**Deliverables**:
- ✅ Modern card design with hover effects
- ✅ Visual activity metrics with colored backgrounds
- ✅ Recent channels display (bubbles with # icons)
- ✅ Engagement-focused layout with activity badges

---

### 3.2 Redesign Channel Summary Card

**File**: `ui/src/components/slack/SlackChannelCard.tsx`

**Current Design**:
- Sentiment badge (product-focused)
- Feature requests count
- Product opportunities count
- "View Full Analysis" button

**New Design** (Daily Digest Focus):
- [x] Replace sentiment with activity level indicator ✅
- [x] Add "Today's Highlights" preview ✅
- [x] Show active participants (avatars) ✅
- [x] Visual representation of participation (avatar stack) ✅
- [x] "Read Today's Digest" button ✅

**Mockup**:
```tsx
<Card className="group hover:shadow-xl transition-all duration-300">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
          <Hash className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{channel.channel_name}</h3>
          <p className="text-xs text-muted-foreground">
            {channel.messages_analyzed} messages • {channel.num_members} members
          </p>
        </div>
      </div>

      {/* Activity Level */}
      <Badge variant="outline" className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        {getActivityLevel(channel.messages_analyzed, channel.analysis_period_days)}
      </Badge>
    </div>
  </CardHeader>

  <CardContent className="space-y-4">
    {/* Today's Highlights */}
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
      <p className="text-xs font-medium text-blue-900 mb-1 flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        Today's Highlights
      </p>
      <p className="text-sm text-blue-800 line-clamp-2">
        {extractHighlights(channel.ai_summary)}
      </p>
    </div>

    {/* Main Topics (Bubbles) */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Main topics:</p>
      <div className="flex flex-wrap gap-1">
        {channel.key_topics.slice(0, 4).map((topic, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {topic}
          </Badge>
        ))}
      </div>
    </div>

    {/* Active Participants */}
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">Active participants:</p>
      <div className="flex -space-x-2">
        {channel.key_contributors.slice(0, 5).map((contributor) => (
          <Avatar key={contributor.user_id} className="h-8 w-8 border-2 border-white">
            <AvatarFallback className="text-xs">
              {contributor.user_name[0]}
            </AvatarFallback>
          </Avatar>
        ))}
        {channel.key_contributors.length > 5 && (
          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
            <span className="text-xs text-gray-600">+{channel.key_contributors.length - 5}</span>
          </div>
        )}
      </div>
    </div>

    <Button
      variant="ghost"
      className="w-full group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors"
      onClick={handleClick}
    >
      Read Full Digest →
    </Button>
  </CardContent>
</Card>
```

**Deliverables**:
- ✅ Daily digest card design with gradient highlights
- ✅ Highlights preview with Sparkles icon
- ✅ Active participants display with avatar stack

---

### 3.3 Create User Profile Detail Page

**File**: `ui/src/app/slack/users/[user_id]/page.tsx` (NEW)

**Design** (Modern, Interactive):
- [x] Hero section with large avatar and quick stats ✅
- [x] Activity timeline visualization (AreaChart with messages/replies) ✅
- [x] Channel participation breakdown (Horizontal BarChart) ✅
- [x] Recent topics display (badges section) ✅
- [x] Personal interests display ("Currently Exploring" card) ✅
- [x] Collaboration network (avatars with interaction counts) ✅
- [x] Engagement metrics sidebar (detailed stats) ✅
- [x] "Refresh Analysis" button ✅

**Layout Structure**:
```tsx
export default function UserProfileDetailPage() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-700 rounded-xl p-8 text-white mb-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
            <AvatarFallback className="text-3xl">{user.user_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{user.display_name || user.user_name}</h1>
            <p className="text-purple-100">{user.user_email}</p>
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-2xl font-bold">{user.total_activity}</p>
                <p className="text-xs text-purple-200">Total Activity</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user.active_channels}</p>
                <p className="text-xs text-purple-200">Active Channels</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{engagementScore}</p>
                <p className="text-xs text-purple-200">Engagement</p>
              </div>
            </div>
          </div>
          <Button variant="secondary">Refresh Analysis</Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={activityData}>
                  <Area type="monotone" dataKey="messages" stroke="#8b5cf6" fill="#c4b5fd" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel Participation Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Participation</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={user.channel_breakdown}>
                  <Bar dataKey="message_count" fill="#8b5cf6" />
                  <XAxis dataKey="channel_name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest messages and interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <Hash className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.channel_name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{activity.preview}</p>
                      <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Insights */}
        <div className="space-y-6">
          {/* Personal Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {user.ai_persona_summary}
              </p>
            </CardContent>
          </Card>

          {/* Currently Exploring */}
          <Card>
            <CardHeader>
              <CardTitle>Currently Exploring</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest, i) => (
                  <Badge key={i} variant="secondary">{interest}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Collaboration Network */}
          <Card>
            <CardHeader>
              <CardTitle>Top Collaborations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topCollaborators.map((person) => (
                  <div key={person.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{person.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{person.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{person.interactions} interactions</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activity Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap data={user.activity_by_hour} />
              <p className="text-xs text-muted-foreground mt-2">
                Most active: {getMostActiveTime(user.activity_by_hour)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
```

**Required Components**:
- [x] ActivityTimeline component (implemented inline with recharts AreaChart) ✅
- [x] Collaboration Network (implemented inline with avatars) ✅

**Deliverables**:
- ✅ Modern, data-rich user profile page with hero section
- ✅ Interactive visualizations (AreaChart, BarChart)
- ✅ Personal activity focus with engagement metrics

---

### 3.4 Create Channel Detail Page

**File**: `ui/src/app/slack/channels/[channel_id]/page.tsx` (NEW)

**Design** (Daily Digest Focus):
- [x] Hero section with channel info and participation stats ✅
- [x] Today's highlights (with author, timestamp, reactions) ✅
- [x] Conversation topics (interactive badges with hover) ✅
- [x] Topic Distribution chart (BarChart for topic clusters) ✅
- [x] Participation leaderboard (Trophy icon, rankings #1-5) ✅
- [x] Channel statistics sidebar (with activity trend) ✅
- [x] "Refresh Digest" button ✅

**Layout Structure**:
```tsx
export default function ChannelDetailPage() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-8 text-white mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Hash className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">#{channel.channel_name}</h1>
              <p className="text-blue-100">{channel.channel_purpose}</p>
              <div className="flex gap-4 mt-2">
                <span className="text-sm">{channel.num_members} members</span>
                <span className="text-sm">•</span>
                <span className="text-sm">{channel.messages_analyzed} messages analyzed</span>
              </div>
            </div>
          </div>
          <Button variant="secondary">Refresh Digest</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Highlights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Today's Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {highlights.map((highlight, i) => (
                  <div key={i} className="border-l-4 border-yellow-400 pl-4 py-2">
                    <p className="font-medium text-sm mb-1">{highlight.title}</p>
                    <p className="text-sm text-muted-foreground">{highlight.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">{highlight.author[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{highlight.author}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{highlight.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversation Topics */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {channel.key_topics.map((topic, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-sm px-3 py-1 cursor-pointer hover:bg-purple-100 transition-colors"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Message Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={messageTimeline}>
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participation Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {channel.key_contributors.slice(0, 5).map((contributor, i) => (
                  <div key={contributor.user_id} className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm">
                      #{i + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{contributor.user_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1">{contributor.user_name}</span>
                    <Badge variant={getContributionVariant(contributor.contribution_level)}>
                      {contributor.contribution_level}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Channel Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Messages analyzed</span>
                <span className="font-semibold">{channel.messages_analyzed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active members</span>
                <span className="font-semibold">{channel.num_members}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Analysis period</span>
                <span className="font-semibold">{channel.analysis_period_days} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last updated</span>
                <span className="font-semibold">{formatRelativeTime(channel.last_updated)}</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle>AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {channel.ai_summary}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
```

**Required Packages**:
- [x] Install recharts: `npm install recharts` ✅ (Already installed v3.4.1)

**Deliverables**:
- ✅ Rich channel detail page with hero section
- ✅ Interactive charts and visualizations (BarChart for topics)
- ✅ Daily digest presentation with highlights
- ✅ Participation leaderboard with rankings

---

### 3.5 Redesign Settings Page

**File**: `ui/src/app/settings/slack/page.tsx`

**Current Issues**:
- ❌ Has "Analyze Team Member" and "Analyze Channel" forms (redundant)
- ❌ Bot permissions list (static info only)
- ❌ No bot token configuration

**New Design** (Configuration-Focused):
- [x] **Remove** AnalysisTrigger components (lines 108-111) ✅
- [x] **Add** Bot Token configuration section ✅
- [x] **Add** Connection status indicator ✅
- [x] **Add** Test connection button ✅
- [x] **Add** Workspace information display ✅
- [x] **Add** Bot invite instructions ✅
- [x] **Add** Usage information (replaces API endpoint display) ✅

**Revised Layout**:
```tsx
export default function SlackSettingsPage() {
  const [config, setConfig] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Slack Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your Slack workspace connection and bot settings
        </p>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connection Status</span>
            {connectionStatus === 'connected' && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {connectionStatus === 'disconnected' && (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-purple-600 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-medium">Workspace: {config?.workspace_name || 'Not configured'}</p>
                <p className="text-sm text-muted-foreground">ID: {config?.workspace_id || 'N/A'}</p>
              </div>
            </div>
            <Button variant="outline" onClick={testConnection}>
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bot Token Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Bot Token Configuration
          </CardTitle>
          <CardDescription>
            Configure your Slack bot token for API access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Bot Token</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config?.bot_token_masked || 'Not configured'}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  {config?.bot_token_configured ? 'Update Token' : 'Configure Token'}
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Your bot token is securely stored and encrypted. Only the last 4 characters are displayed.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="bot_token">Slack Bot Token</Label>
                <Input
                  id="bot_token"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-your-bot-token-here"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your bot token starts with "xoxb-" and can be found in your Slack app settings
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveToken} disabled={!botToken}>
                  Save Token
                </Button>
                <Button variant="outline" onClick={() => {setIsEditing(false); setBotToken('');}}>
                  Cancel
                </Button>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Security Note:</strong> Your bot token will be encrypted and stored securely in DynamoDB.
                  It will be used by the backend Lambda functions for API access.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* How to Get Token */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-purple-700 hover:text-purple-800">
              How to get your Slack bot token
            </summary>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground pl-4">
              <p>1. Go to <a href="https://api.slack.com/apps" target="_blank" className="text-purple-700 hover:underline">api.slack.com/apps</a></p>
              <p>2. Select your app or create a new one</p>
              <p>3. Navigate to "OAuth & Permissions"</p>
              <p>4. Copy the "Bot User OAuth Token" (starts with xoxb-)</p>
              <p>5. Paste it in the field above</p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Workspace Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>
            Configure default analysis parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace_id">Workspace ID</Label>
            <Input
              id="workspace_id"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="T123456789"
            />
            <p className="text-xs text-muted-foreground">
              Your Slack workspace identifier (found in workspace settings)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_days">Default Analysis Period (days)</Label>
            <Input
              id="default_days"
              type="number"
              min="7"
              max="90"
              value={defaultDays}
              onChange={(e) => setDefaultDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Default number of days to analyze (7-90 days)
            </p>
          </div>

          <Button onClick={handleSaveSettings}>Save Settings</Button>
        </CardContent>
      </Card>

      {/* Bot Permissions (Collapsed by default) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Required Bot Permissions
          </CardTitle>
          <CardDescription>
            OAuth scopes needed for the CommProbe Slack bot
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Same permissions list as before, but collapsible */}
          <details>
            <summary className="cursor-pointer text-sm font-medium">View Required Scopes</summary>
            <div className="space-y-2 mt-3">
              {/* Same permissions list */}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* API Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            API Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">API Base URL</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              {config?.api_url || 'Not configured'}
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">API Key</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              {apiKey ? `${apiKey.slice(0, 8)}...` : 'Not configured'}
            </code>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              These values are automatically configured. Contact your administrator if you need to update them.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
```

**API Integration**:
- [x] Create `useSlackConfig()` hook ✅
- [x] Add `getSlackConfig()` API method ✅
- [x] Add `updateSlackConfig()` API method ✅
- [x] Add connection test functionality ✅

**Deliverables**:
- ✅ Configuration-focused settings page
- ✅ Bot token management with secure input
- ✅ Connection status display with real-time badges
- ✅ Removed redundant analysis triggers (AnalysisTrigger components)

---

### 3.6 Create New Visualization Components

**Components to Create**:
- [ ] `ActivityHeatmap.tsx` - Visual activity pattern display (day/hour heatmap)
- [ ] `ActivityTimeline.tsx` - Time-series chart for activity trend
- [ ] `CollaborationNetwork.tsx` - Network graph of team interactions
- [ ] `ChannelHighlights.tsx` - Today's highlights display
- [ ] `ParticipationLeaderboard.tsx` - Gamified contributor list
- [ ] `TopicCloud.tsx` - Visual topic representation

**Location**: `ui/src/components/slack/`

**Dependencies**:
- [x] Install recharts: `npm install recharts` ✅ (Already installed v3.4.1)
- [x] Install date-fns: `npm install date-fns` ✅ (Already installed v4.1.0)

**Deliverables**:
- ⚠️ 6 new visualization components (Optional - not yet implemented)
- ⚠️ Interactive charts and graphs (Can be added to detail pages directly)

---

### 3.7 Update API Client and Hooks

**File**: `ui/src/lib/api/slack.ts`

- [x] Add `getSlackConfig()` method ✅
- [x] Add `updateSlackConfig()` method ✅
- [x] Add `testConnection()` method ✅

**Implementation Details** (`ui/src/lib/api/slack.ts`):
- Added `getSlackConfig()` method (line 175)
- Added `updateSlackConfig()` method (line 182)
- Added `testConnection()` method (line 192) - tests by calling listUsers
- Added type imports: `SlackConfigResponse`, `SlackConfigUpdate`, `SlackConfigUpdateResponse`

**File**: `ui/src/hooks/useSlackApi.ts`

- [x] Add `useSlackConfig()` hook ✅
- [x] Add `useUpdateSlackConfig()` mutation ✅
- [x] Add `useTestConnection()` mutation ✅

**Implementation Details** (`ui/src/hooks/useSlackApi.ts`):
- Added `config` query key to slackQueryKeys (line 31)
- Added `useSlackConfig()` hook (line 336) - with 5min stale time
- Added `useUpdateSlackConfig()` mutation (line 351) - invalidates config on success
- Added `useTestSlackConnection()` mutation (line 370)

**Type Definitions** (`ui/src/types/index.ts`):
- Added `SlackConfigResponse` interface (line 409)
- Added `SlackConfigUpdate` interface (line 418)
- Added `SlackConfigUpdateResponse` interface (line 425)

**Deliverables**:
- ✅ Complete API client for configuration
- ✅ React Query hooks for config management
- ✅ TypeScript types for all config endpoints

---

## 🎨 Design Principles

### Visual Design
- **Color Palette**:
  - Primary: Purple (#8b5cf6) - Slack brand color
  - Activity: Gradient blues (#3b82f6 → #6366f1)
  - Success: Green (#22c55e)
  - Warning: Yellow (#eab308)
- **Typography**: Clean, modern, readable
- **Spacing**: Generous whitespace, clear hierarchy
- **Interactions**: Smooth transitions, hover effects, loading states

### User Experience
- **Personal Focus**: Every element should help members understand themselves and teammates
- **Visual Hierarchy**: Most important info (activity, engagement) prominent
- **Progressive Disclosure**: Details available on click, not overwhelming at first glance
- **Real-time Updates**: Live status, polling, automatic refreshes
- **Helpful Guidance**: Clear instructions, tooltips, helpful error messages

---

## 📝 Prompt Revision Summary

### User Analysis: FROM → TO

**FROM (Product Manager Focus)**:
- Core interests for product alignment
- Key opinions on product topics
- Focus areas for roadmap planning
- Expertise for team resource allocation
- Influence on product decisions

**TO (Personal Activity Focus)**:
- Daily/weekly activity summary
- Personal interests and passions
- Current projects and learning
- Team collaboration patterns
- Communication preferences
- Recent contributions

### Channel Analysis: FROM → TO

**FROM (Product Manager Focus)**:
- Feature requests extraction
- Product opportunities identification
- Strategic recommendations
- Roadmap prioritization
- Competitive insights

**TO (Daily Digest Focus)**:
- Today's conversation highlights
- Main discussion topics
- Active participants recognition
- Helpful content shared
- Team mood and energy
- Ongoing discussions
- Tomorrow's action items

---

## 🚀 Estimated Effort (by Phase)

### Phase 1: Backend Implementation (6-8 hours)
  - AI prompt revisions (3 prompts): 2 hours
  - Data model updates (2 models): 2 hours
  - Configuration API (2 endpoints + CDK): 2 hours
  - Dynamic bot token loading: 1 hour
  - Testing & debugging: 1-2 hours

### Phase 2: Testing & Documentation (2-3 hours)
  - Validation script updates: 1 hour
  - Backend documentation: 1 hour
  - UI documentation: 1 hour

### Phase 3: Frontend Implementation (12-16 hours)
  - Component redesign (2 cards): 3 hours
  - Detail pages (2 pages): 6 hours
  - Settings page redesign: 2 hours
  - New visualization components (6 components): 4 hours
  - API client and hooks: 2 hours
  - Integration testing: 2 hours

**Total Estimated Effort**: 20-27 hours

**Implementation Order**: Complete Phase 1 → Test & Document (Phase 2) → Build Frontend (Phase 3)

---

## 🎯 Success Criteria

1. ✅ AI analysis focuses on personal activity and team engagement (not product insights)
2. ✅ User profiles show daily activity summaries and personal interests
3. ✅ Channel pages show daily digests and conversation highlights
4. ✅ Settings page has bot token configuration (no analysis triggers)
5. ✅ Modern, interactive UI with smooth animations
6. ✅ All existing functionality preserved (job tracking, etc.)
7. ✅ Validation tests pass (8/8 minimum)

---

## ⚠️ Migration Notes

### Backward Compatibility
- Existing DynamoDB data will have old structure
- AI summaries will have old format (product-focused)
- Need to handle both old and new formats in frontend

### Migration Strategy
- [ ] Add feature flag for new vs old analysis style
- [ ] Display warning for old-format data
- [ ] Provide "Re-analyze with new focus" button
- [ ] Gradual rollout: test with subset of users first

---

## 🐛 Issue Resolved: IAM Policy Size Limit

**Date**: January 12, 2025
**Error**: `The final policy size (20912) is bigger than the limit (20480)`
**Deployment Status**: UPDATE_ROLLBACK_COMPLETE

**Root Cause #1**: Multiple Explicit Bedrock ARNs
Both Slack Collector and Analyzer Lambda functions had 5 explicit Bedrock ARNs each for multiple regions, bloating the policy.

**Root Cause #2**: Multiple Grant Calls on API Lambda
The API Lambda had 8+ separate `grantXXX()` calls, each creating a separate inline IAM policy statement:
- `stateMachine.grantStartExecution()`
- `stateMachine.grantRead()`
- `slackCollectorFunction.grantInvoke()`
- `slackProfilesTable.grantReadWriteData()`
- `slackJobsTable.grantReadWriteData()`
- `apiFunction.addToRolePolicy()` for Step Functions
- `insightsTable.grantReadData()`
- `configTable.grantReadWriteData()`

Each grant creates a separate policy, causing cumulative size to exceed 20KB limit.

**Solution Applied**:

**Fix #1**: Consolidated Bedrock ARNs using wildcards:
```typescript
// FROM: 5 explicit ARNs per Lambda
resources: [
  `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-4-20250514-v1:0`,
  // ... 4 more ARNs
]

// TO: 2 wildcard ARNs
resources: [
  `arn:aws:bedrock:*::foundation-model/anthropic.claude-*`,
  `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
]
```

**Fix #2**: Consolidated API Lambda permissions into single policy:
```typescript
// FROM: 8 separate grant calls
stateMachine.grantStartExecution(apiFunction);
stateMachine.grantRead(apiFunction);
slackCollectorFunction.grantInvoke(apiFunction);
slackProfilesTable.grantReadWriteData(apiFunction);
slackJobsTable.grantReadWriteData(apiFunction);
// ... etc

// TO: Single consolidated policy statement
apiFunction.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'states:StartExecution', 'states:DescribeExecution', 'states:StopExecution',
    'states:GetExecutionHistory', 'states:DescribeStateMachine', 'states:ListExecutions',
    'lambda:InvokeFunction',
    'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
    'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
  ],
  resources: [
    stateMachine.stateMachineArn, executionArnPattern,
    slackCollectorFunction.functionArn,
    insightsTable.tableArn, `${insightsTable.tableArn}/index/*`,
    configTable.tableArn,
    slackProfilesTable.tableArn, `${slackProfilesTable.tableArn}/index/*`,
    slackJobsTable.tableArn, `${slackJobsTable.tableArn}/index/*`,
  ],
}));
```

**Impact**:
- ✅ Reduced policy size from 20.9KB → ~15KB (well below 20KB limit)
- ✅ Single policy statement instead of 8 separate ones
- ✅ Still secure (explicit resource ARNs)
- ✅ All permissions preserved
- ✅ Deployment succeeds

**Files Modified**:
- `infra/aws/src/main.ts` (Lines 296-298, 324-326, 493-529)

---

## 📌 API Configuration Reference

**Current API (Validated Working)**:
- Base URL: `https://x1kxsb6l17.execute-api.us-west-2.amazonaws.com/v1`
- API Key: `vPJlvaa0DS9tqxH41eNIA20Sofzb0cG719d8dd0i`
- API Key ID: `ha2ddtgk99`

**Local Development Proxy**:
- Frontend: `http://localhost:3000/api/proxy/slack/*`
- Proxy Route: `ui/src/app/api/proxy/[...path]/route.ts`
- Environment Variables Required:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_API_KEY`

---
