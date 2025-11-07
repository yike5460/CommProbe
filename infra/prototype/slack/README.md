# Slack AI Analyzer - Product Manager Insights

An AI-powered Slack analysis tool designed for product managers and team leads. Uses Amazon Bedrock Claude Sonnet 4.5 to extract deep insights from Slack conversations.

## 🎯 Two Powerful Analysis Modes

### MODE 1: Channel Analysis (Product Manager Focus)
Extract strategic insights from channel conversations:
- **Specific Channel Analysis**: Deep dive into a single channel's discussions
- **All-Channels Scan**: Comprehensive workspace-wide strategic analysis
- **Product Opportunities**: Identify feature requests and user feedback
- **Pain Points**: Discover blockers and frustrations
- **Strategic Recommendations**: AI-generated actionable priorities

### MODE 2: User Analysis (Individual Engagement)
Build comprehensive user profiles:
- **Interests & Opinions**: Understand what users care about
- **Focus Areas**: Identify what users are working on
- **Expertise Mapping**: Discover domain knowledge and skills
- **Communication Patterns**: Analyze engagement styles
- **Influence Assessment**: Measure impact on discussions

## 🚀 Quick Start

### Prerequisites

1. **Slack App with Bot Token**
   - Create a Slack App at https://api.slack.com/apps
   - Add OAuth scopes:
     - `channels:read` - View basic channel info
     - `channels:history` - View messages in public channels
     - `groups:read` - View basic private channel info
     - `groups:history` - View messages in private channels
     - `users:read` - View people in the workspace
     - `users:read.email` - View email addresses
   - Install the app to your workspace
   - Copy the Bot User OAuth Token (starts with `xoxb-`)

2. **AWS Account with Bedrock Access**
   - AWS account with Bedrock enabled
   - Claude Sonnet 4.5 model access
   - AWS credentials configured (via environment or ~/.aws/credentials)

3. **Python 3.7+**

### Installation

```bash
# Navigate to the prototype directory
cd infra/prototype/slack

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env.local` file:

```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
AWS_DEFAULT_REGION=us-west-2  # Optional, defaults to us-west-2
```

Or set environment variables:

```bash
export SLACK_BOT_TOKEN="xoxb-your-token-here"
export AWS_DEFAULT_REGION="us-west-2"
```

## 📖 Usage

### MODE 1: Channel Analysis

**List all accessible channels (debugging):**
```bash
# See all channels the bot can access
python slack_user_analyzer.py --list-channels
```

**Analyze a specific channel:**
```bash
# Basic channel analysis
python slack_user_analyzer.py --channel general

# With custom time period
python slack_user_analyzer.py --channel product-feedback --days 60

# Save to file
python slack_user_analyzer.py --channel general --output general_analysis.json
```

**Scan all workspace channels:**
```bash
# Comprehensive workspace analysis
python slack_user_analyzer.py --all-channels

# Limit number of channels (default: 20)
python slack_user_analyzer.py --all-channels --max-channels 30

# Adjust messages per channel (default: 100)
python slack_user_analyzer.py --all-channels --max-messages 150
```

### MODE 2: User Analysis

**Analyze a specific user:**
```bash
# By email
python slack_user_analyzer.py --user-email user@example.com

# By user ID
python slack_user_analyzer.py --user-id U123456789

# With custom time period
python slack_user_analyzer.py --user-email user@example.com --days 90

# Save to file
python slack_user_analyzer.py --user-email user@example.com --output user_profile.json
```

### Advanced Options

**AWS Region:**
```bash
python slack_user_analyzer.py --channel general --aws-region us-east-1
```

**API Rate Limiting:**
```bash
# Increase delay between API calls (for large workspaces)
python slack_user_analyzer.py --all-channels --api-delay 2.0
```

**Thread Limits (User Analysis):**
```bash
# Limit threads checked per channel (faster analysis)
python slack_user_analyzer.py --user-email user@example.com --max-threads 30
```

## 📊 Output Format

### Channel Analysis Output

```json
{
  "analysis_date": "2025-11-06T10:00:00",
  "analysis_period_days": 30,
  "channel": {
    "id": "C123456789",
    "name": "general",
    "is_private": false,
    "num_members": 50
  },
  "message_count": 200,
  "analysis": "AI-generated comprehensive analysis including:\n- Channel Purpose & Context\n- Key Discussion Topics\n- User Feedback & Feature Requests\n- Pain Points & Blockers\n- Sentiment Analysis\n- Key Contributors\n- Product Opportunities\n- Strategic Recommendations",
  "ai_usage": {
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "tokens_used": 15420
  }
}
```

### All-Channels Scan Output

```json
{
  "analysis_date": "2025-11-06T10:00:00",
  "workspace_summary": {
    "total_channels_analyzed": 20,
    "total_messages_analyzed": 2500
  },
  "strategic_insights": "Cross-channel strategic analysis including:\n- Workspace Overview\n- Cross-Channel Themes\n- Product Opportunities\n- Key Pain Points\n- User Sentiment\n- Communication Patterns\n- Strategic Priorities\n- Risk Areas",
  "channel_analyses": [
    {
      "channel_name": "general",
      "num_members": 50,
      "messages_analyzed": 150,
      "analysis": "Per-channel AI analysis..."
    }
  ],
  "ai_usage": {
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "total_tokens_used": 125000,
    "meta_analysis_tokens": 45000
  }
}
```

### User Analysis Output

```json
{
  "analysis_date": "2025-11-06T10:00:00",
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "is_admin": false
  },
  "summary": {
    "total_channels": 15,
    "total_messages": 45,
    "total_replies": 23,
    "most_active_channel": "engineering",
    "active_channels_count": 8
  },
  "ai_analysis": {
    "per_channel": [
      {
        "channel_name": "engineering",
        "analysis": "Per-channel analysis of user's:\n- Core Interests\n- Key Opinions\n- Focus Areas\n- Expertise\n- Communication Style\n- Pain Points\n- Influence Level"
      }
    ],
    "overall_summary": {
      "ai_insights": "Cross-channel user profile including:\n- Overall Interests & Focus\n- Key Opinions & Viewpoints\n- Expertise Profile\n- Communication Patterns\n- Pain Points & Concerns\n- Influence & Impact\n- Engagement Style\n- User Persona Summary"
    }
  },
  "ai_usage": {
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "total_tokens_used": 35000
  }
}
```

## 🎯 Use Cases

### For Product Managers

**Discover Feature Requests:**
```bash
python slack_user_analyzer.py --channel product-feedback --days 60 --output feedback_analysis.json
```

**Understand User Pain Points:**
```bash
python slack_user_analyzer.py --channel support --days 30
```

**Get Workspace-Wide Insights:**
```bash
python slack_user_analyzer.py --all-channels --output workspace_insights.json
```

### For Team Leads

**Understand Team Member Interests:**
```bash
python slack_user_analyzer.py --user-email teammember@example.com --days 90
```

**Identify Expertise Areas:**
```bash
python slack_user_analyzer.py --user-email expert@example.com
```

**Track Engagement Patterns:**
```bash
python slack_user_analyzer.py --user-email user@example.com --days 180
```

## ⚡ Performance

### Execution Times

- **Single Channel Analysis**: 30-60 seconds
- **User Analysis (10 channels)**: 2-5 minutes
- **All-Channels Scan (20 channels)**: 5-15 minutes

### Cost Considerations

AI analysis uses Amazon Bedrock Claude Sonnet 4.5. Approximate costs:

- **Single Channel**: ~10-20K tokens (~$0.30-$0.60)
- **User Analysis**: ~30-50K tokens (~$0.90-$1.50)
- **All-Channels Scan (20 channels)**: ~100-150K tokens (~$3-$4.50)

*Costs based on Claude Sonnet 4.5 pricing. Actual costs may vary.*

## 🔧 Troubleshooting

### "Channel #channel-name not found"
This error means the bot cannot see or access the channel. Possible causes:

1. **Channel is PRIVATE and bot not invited** (Most Common):
   - Private channels are **completely invisible** to the bot until invited
   - They won't appear in `--list-channels` output
   - Solution: Go to the channel in Slack and type:
     ```
     /invite @YourBotName
     ```
   - After invitation, the channel will appear in the list

2. **Channel is PUBLIC but bot not a member**:
   - Public channels appear in `--list-channels` but marked as not accessible
   - Solution: Invite the bot with `/invite @YourBotName`

3. **Channel is archived**: The bot cannot access archived channels

4. **Typo in channel name**: Use `--list-channels` to see available channels:
   ```bash
   python slack_user_analyzer.py --list-channels
   ```

5. **Channel is a DM or group DM**: The tool only works with public and private channels

**Important**: If a channel doesn't appear in `--list-channels` at all, it's almost certainly a **private channel** where the bot hasn't been invited yet.

### "Error: missing_scope"
Your bot token doesn't have required permissions. Add the necessary scopes in your Slack App settings and reinstall the app.

### "Error: not_in_channel"
The bot hasn't been invited to the channel. Invite the bot: `/invite @YourBotName`

### "ImportError: boto3 is required"
Install boto3: `pip install boto3`

### "Error: ratelimited"
Slack API rate limit hit. Increase API delay:
```bash
python slack_user_analyzer.py --channel general --api-delay 2.0
```

### Bedrock Access Errors
- Ensure AWS credentials are configured
- Verify Bedrock is enabled in your region
- Check Claude Sonnet 4.5 model access
- Try a different region: `--aws-region us-east-1`

## 🔒 Privacy & Security

- The tool only analyzes channels the bot has access to
- No data is stored permanently (unless you save output)
- All AI analysis happens via AWS Bedrock (not OpenAI)
- Ensure compliance with your organization's data policies

## 📈 What the AI Analyzes

### Channel Analysis
- Channel purpose and organizational role
- Key discussion topics and themes
- User feedback and feature requests
- Pain points and blockers
- Sentiment and satisfaction levels
- Key contributors and influencers
- Product opportunities
- Strategic recommendations

### User Analysis
- Core interests and focus areas
- Stated opinions and viewpoints
- Expertise and knowledge domains
- Communication style and patterns
- Pain points and challenges
- Influence on discussions
- Engagement patterns across channels
- Professional persona

## 🚀 Future Enhancements

Potential improvements:
- Real-time analysis via Slack Events API
- Multi-workspace support
- Trend analysis over time
- Automated reports and alerts
- Integration with product management tools
- Custom AI prompts and analysis templates

## 📝 License

Part of the CommProbe project.

## 🤝 Support

For issues or questions, refer to the main CommProbe repository documentation.
