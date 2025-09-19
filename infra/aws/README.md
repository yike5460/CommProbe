# CommProbe AWS Infrastructure

AWS CDK infrastructure for the Legal Community Feedback Collector & Analyzer.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Deploy with Reddit API credentials:**
   ```bash
   npx cdk deploy \
     --context redditClientId=YOUR_REDDIT_CLIENT_ID \
     --context redditClientSecret=YOUR_REDDIT_CLIENT_SECRET
   ```

## Architecture

- **S3**: Raw data storage with lifecycle management
- **DynamoDB**: Structured insights with TTL
- **Lambda Functions**: Collector, Analyzer (Bedrock), Storer
- **Step Functions**: Orchestration pipeline
- **EventBridge**: Weekly scheduling (Mondays 2 AM UTC)

## Commands

```bash
# Synthesize (dry run)
npx cdk synth --context redditClientId=XXX --context redditClientSecret=YYY

# Deploy
npx cdk deploy --context redditClientId=XXX --context redditClientSecret=YYY

# Destroy
npx cdk destroy --context redditClientId=XXX --context redditClientSecret=YYY
```

## Reddit API Setup

1. Go to https://www.reddit.com/prefs/apps
2. Create a new app (script type)
3. Copy the client ID and secret
4. Use them in the deploy command

## Cost Estimate

~$14/month (Lambda, Bedrock, DynamoDB, S3)

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.