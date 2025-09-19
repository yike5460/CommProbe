# Deployment Guide

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ and npm installed
3. Reddit API credentials from https://www.reddit.com/prefs/apps

## Deployment Options

### Option 1: Deploy with Command Line Parameters (Recommended)

```bash
# Install dependencies
npm install

# Deploy with Reddit credentials
npx cdk deploy \
  --context redditClientId=YOUR_REDDIT_CLIENT_ID \
  --context redditClientSecret=YOUR_REDDIT_CLIENT_SECRET
```

### Option 2: Configure in cdk.json

1. Edit `cdk.json` and add your credentials to the context section:
```json
{
  "context": {
    "redditClientId": "YOUR_CLIENT_ID",
    "redditClientSecret": "YOUR_CLIENT_SECRET",
    "redditUserAgent": "legal-crawler/1.0"
  }
}
```

2. Deploy:
```bash
npm install
npx cdk deploy
```

## Additional CDK Commands

```bash
# Synthesize CloudFormation template (dry run)
npx cdk synth \
  --context redditClientId=YOUR_CLIENT_ID \
  --context redditClientSecret=YOUR_CLIENT_SECRET

# Show stack differences
npx cdk diff \
  --context redditClientId=YOUR_CLIENT_ID \
  --context redditClientSecret=YOUR_CLIENT_SECRET

# Deploy without approval prompts
npx cdk deploy \
  --context redditClientId=YOUR_CLIENT_ID \
  --context redditClientSecret=YOUR_CLIENT_SECRET \
  --require-approval never

# Destroy stack
npx cdk destroy \
  --context redditClientId=YOUR_CLIENT_ID \
  --context redditClientSecret=YOUR_CLIENT_SECRET
```

## Verification

After deployment:

1. Check CloudFormation stack in AWS Console
2. Verify Step Functions state machine: `supio-reddit-insights-pipeline`
3. Check EventBridge rule: `supio-weekly-reddit-insights`
4. Test manual trigger via Lambda function: `legal-crawler-dev-TriggerFunction`

## Troubleshooting

### Error: Reddit API credentials are required
Solution: Ensure you're passing the context parameters correctly:
```bash
npx cdk deploy --context redditClientId=XXX --context redditClientSecret=YYY
```

### Error: Stack already exists
Solution: Either update the existing stack or destroy and recreate:
```bash
npx cdk destroy --context redditClientId=XXX --context redditClientSecret=YYY
npx cdk deploy --context redditClientId=XXX --context redditClientSecret=YYY
```

### Error: Bedrock model not available
Solution: Ensure you're deploying to us-east-1 region where Claude Sonnet is available:
```bash
export AWS_REGION=us-east-1
npx cdk deploy --context redditClientId=XXX --context redditClientSecret=YYY
```