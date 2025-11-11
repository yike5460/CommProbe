import json
import os
import boto3
from datetime import datetime
import time
from typing import Dict, List, Any

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
PRIORITY_SCORE_THRESHOLD = 5

def handler(event, context):
    """
    Lambda handler for storing analyzed insights to DynamoDB

    Note: Slack data is not processed here - it's already stored by the Slack Collector Lambda
    directly to the supio-slack-profiles DynamoDB table
    """
    print(f"Starting storage with event: {json.dumps(event)}")

    # Check if this is Slack data (should be skipped)
    platform = event.get('platform', 'unknown')
    if platform == 'slack':
        print("Skipping Slack data storage - already handled by Slack Collector")
        return {
            'statusCode': 200,
            'message': 'Slack data already stored',
            'insights_stored': 0
        }

    # Get S3 location from previous step
    s3_location = event.get('s3_location')
    if not s3_location:
        raise ValueError("No s3_location provided in event")
    
    # Parse S3 location
    bucket_name = s3_location.replace('s3://', '').split('/')[0]
    s3_key = '/'.join(s3_location.replace('s3://', '').split('/')[1:])
    
    # Fetch analyzed data from S3
    response = s3.get_object(Bucket=bucket_name, Key=s3_key)
    data = json.loads(response['Body'].read())
    
    insights = data.get('insights', [])
    print(f"Storing {len(insights)} insights to DynamoDB")
    
    # Get DynamoDB table
    table = dynamodb.Table(os.environ['TABLE_NAME'])
    
    # Store insights
    stored_count = 0
    high_priority_count = 0
    alerts = []
    
    for insight_data in insights:
        post = insight_data['post']
        analysis = insight_data['analysis']
        
        # Only store insights with priority >= 5
        if analysis.get('priority_score', 0) >= PRIORITY_SCORE_THRESHOLD:
            try:
                item = create_dynamodb_item(post, analysis)
                table.put_item(Item=item)
                stored_count += 1
                
                # Track high priority items for alerting
                if analysis.get('priority_score', 0) >= 8:
                    high_priority_count += 1
                    alerts.append({
                        'post_id': post['id'],
                        'priority': analysis['priority_score'],
                        'summary': analysis.get('feature_summary', 'N/A'),
                        'action': analysis.get('suggested_action', 'Review')
                    })
                    
            except Exception as e:
                print(f"Error storing insight for post {post['id']}: {str(e)}")
    
    # Send high priority alerts (in production, this would go to SNS/Slack)
    if alerts:
        print(f"High priority alerts: {json.dumps(alerts)}")
        # In production: send_slack_alerts(alerts)
    
    print(f"Storage complete. Stored {stored_count} insights, {high_priority_count} high priority")
    
    return {
        'statusCode': 200,
        'insights_stored': stored_count,
        'high_priority_count': high_priority_count,
        'alerts': alerts,
        'timestamp': datetime.utcnow().isoformat()
    }


def create_dynamodb_item(post: Dict[str, Any], analysis: Dict[str, Any]) -> Dict:
    """
    Create a DynamoDB item from post and analysis data

    Supports both Reddit and Twitter platforms with unified schema
    """
    current_date = datetime.utcnow().strftime('%Y-%m-%d')
    current_time = int(time.time())
    ttl_time = current_time + (90 * 24 * 60 * 60)  # 90 days TTL

    # Get platform from post (defaults to 'reddit' for backward compatibility)
    platform = post.get('platform', 'reddit')

    item = {
        # Primary Key
        'PK': f"INSIGHT-{current_date}",
        'SK': f"PRIORITY-{analysis['priority_score']}-ID-{post['id']}",

        # GSI Keys
        'GSI1PK': 'PRIORITY',
        'GSI1SK': f"SCORE-{analysis['priority_score']}-DATE-{current_date}",

        # Core Attributes
        'post_id': post['id'],
        'timestamp': current_time,
        'source_type': platform,  # NEW: Track platform source (reddit/twitter)
        'subreddit': post.get('subreddit', 'N/A'),  # For Reddit or placeholder for Twitter
        'post_url': post['url'],
        'ttl': ttl_time,
        
        # User Context
        'user_segment': analysis.get('user_segment', 'unknown'),
        
        # Feature Request
        'feature_summary': analysis.get('feature_summary', ''),
        'feature_details': post.get('title', '') + ' - ' + post.get('content', '')[:500],
        'feature_category': analysis.get('feature_category', 'unknown'),
        'priority_score': analysis.get('priority_score', 0),
        'implementation_size': analysis.get('implementation_size', 'unknown'),
        
        # Competitive Context
        'competitors_mentioned': analysis.get('competitors_mentioned', []),
        'supio_mentioned': analysis.get('supio_mentioned', False),
        'competitive_advantage': analysis.get('competitive_advantage', ''),
        
        # Action Items
        'action_required': analysis.get('action_required', False),
        'suggested_action': analysis.get('suggested_action', ''),
        
        # Additional Analysis
        'pain_points': analysis.get('pain_points', []),
        'ai_readiness': analysis.get('ai_readiness', 'unknown'),
        
        # Metadata
        'analyzed_at': analysis.get('analyzed_at', datetime.utcnow().isoformat()),
        'collected_at': post.get('collected_at', datetime.utcnow().isoformat()),
        'post_score': post.get('score', 0),
        'num_comments': post.get('num_comments', 0)
    }

    # Add platform-specific metadata
    if platform == 'reddit':
        item['platform_metadata'] = {
            'subreddit': post.get('subreddit', 'unknown'),
            'post_score': post.get('score', 0),
            'upvote_ratio': post.get('upvote_ratio'),
            'flair': post.get('flair'),
        }
    elif platform == 'twitter':
        # Twitter-specific metadata
        metrics = post.get('metrics', {})
        twitter_data = post.get('twitter_data', {})
        item['platform_metadata'] = {
            'tweet_id': post.get('id'),
            'author_username': post.get('author', 'unknown'),
            'likes': metrics.get('likes', 0),
            'retweets': metrics.get('retweets', 0),
            'replies': metrics.get('replies', 0),
            'quotes': metrics.get('quotes', 0),
            'engagement_score': post.get('score', 0),  # Combined likes + retweets
            'conversation_id': twitter_data.get('conversation_id'),
            'language': twitter_data.get('lang'),
        }

    # Clean up empty strings and None values
    item = {k: v for k, v in item.items() if v is not None and v != ''}

    return item


def send_slack_alerts(alerts: List[Dict]) -> None:
    """
    Send high priority alerts to Slack (placeholder for production)
    """
    # In production, this would use SNS or direct Slack webhook
    for alert in alerts:
        message = f"🚨 High Priority Insight (Score: {alert['priority']})\n"
        message += f"Summary: {alert['summary']}\n"
        message += f"Action: {alert['action']}\n"
        message += f"Post ID: {alert['post_id']}"
        print(f"ALERT: {message}")
        # sns.publish(TopicArn=ALERT_TOPIC_ARN, Message=message)