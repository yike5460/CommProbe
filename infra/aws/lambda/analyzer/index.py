import json
import os
import boto3
from datetime import datetime
from typing import Dict, List, Any
import time

s3 = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

def handler(event, context):
    """
    Lambda handler for analyzing Reddit posts using Amazon Bedrock
    """
    print(f"Starting analysis with event: {json.dumps(event)}")
    
    # Get S3 location from previous step
    s3_location = event.get('s3_location')
    if not s3_location:
        raise ValueError("No s3_location provided in event")
    
    # Parse S3 location
    bucket_name = s3_location.replace('s3://', '').split('/')[0]
    s3_key = '/'.join(s3_location.replace('s3://', '').split('/')[1:])
    
    # Fetch data from S3
    response = s3.get_object(Bucket=bucket_name, Key=s3_key)
    data = json.loads(response['Body'].read())
    
    posts = data.get('posts', [])
    print(f"Analyzing {len(posts)} posts")
    
    # Analyze posts in batches
    analyzed_posts = []
    batch_size = 10
    
    for i in range(0, len(posts), batch_size):
        batch = posts[i:i + batch_size]
        for post in batch:
            try:
                analysis = analyze_post(post)
                if analysis and analysis.get('priority_score', 0) >= 5:
                    analyzed_posts.append({
                        'post': post,
                        'analysis': analysis
                    })
                time.sleep(0.2)  # Rate limiting for Bedrock
            except Exception as e:
                print(f"Error analyzing post {post.get('id')}: {str(e)}")
    
    # Save analyzed results back to S3
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    analysis_key = f"analyzed/{datetime.utcnow().strftime('%Y-%m-%d')}/analysis_{timestamp}.json"
    
    s3.put_object(
        Bucket=os.environ['BUCKET_NAME'],
        Key=analysis_key,
        Body=json.dumps({
            'analyzed_at': datetime.utcnow().isoformat(),
            'posts_analyzed': len(posts),
            'insights_generated': len(analyzed_posts),
            'insights': analyzed_posts
        }),
        ContentType='application/json'
    )
    
    print(f"Analysis complete. Generated {len(analyzed_posts)} insights")
    
    return {
        'statusCode': 200,
        'posts_analyzed': len(posts),
        'insights_generated': len(analyzed_posts),
        's3_location': f"s3://{os.environ['BUCKET_NAME']}/{analysis_key}",
        'timestamp': timestamp
    }


def analyze_post(post: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze a Reddit post using Claude Sonnet via Amazon Bedrock
    """
    # Prepare context with post and top comments
    comments_text = "\n".join([
        f"- {c['author']} ({c['score']} points): {c['body'][:200]}"
        for c in post.get('comments', [])[:10]
    ])
    
    prompt = f"""
    Analyze this Reddit post from the legal technology community r/{post['subreddit']}.
    
    Post Title: {post['title']}
    Post Content: {post.get('content', 'No text content')}
    Post Score: {post['score']} points
    Number of Comments: {post['num_comments']}
    
    Top Comments:
    {comments_text}
    
    Analyze this post as a Supio product analyst to extract actionable insights:
    
    1. Feature Discovery:
       - Identify specific features users are requesting that Supio could build
       - Categorize: document_automation, ai_accuracy, integration, workflow, discovery_management
       - Assign priority score (1-10) based on user pain level and market demand
       - Note if this is a quick_win, strategic_feature, or future_consideration
    
    2. Competitive Intelligence:
       - Identify mentions of competitors (Harvey, Casetext, Lexis+, Westlaw, others)
       - Assess sentiment toward each competitor (-1 to 1)
       - Extract specific strengths/weaknesses mentioned
       - Note if user is considering switching from/to any solution
    
    3. User Segmentation:
       - Identify user type: solo_practitioner, small_firm, mid_market, large_firm, in_house
       - Assess AI readiness: enthusiastic, cautious, skeptical, hostile
       - Note tech maturity level based on tools mentioned
       - Identify decision-making factors (cost, accuracy, security, ease_of_use)
    
    4. Pain Point Analysis:
       - Extract specific workflow inefficiencies or manual processes
       - Map each pain point to potential Supio solution
       - Assess implementation complexity: simple_config, new_feature, platform_change
       - Estimate ROI potential: hours_saved_weekly, error_reduction_percentage
    
    5. Action Items for PM:
       - Flag if immediate PM review needed (true/false)
       - Suggest specific product roadmap items
       - Identify potential beta testing candidates
       - Note any urgent competitive threats
    
    Return your analysis as a valid JSON object with the following structure:
    {{
        "feature_summary": "one-line description",
        "feature_category": "category",
        "priority_score": 1-10,
        "user_segment": "segment",
        "competitors_mentioned": ["list"],
        "supio_mentioned": boolean,
        "action_required": boolean,
        "suggested_action": "action",
        "pain_points": ["list of pain points"],
        "competitive_advantage": "how this helps vs competitors",
        "implementation_size": "small/medium/large",
        "ai_readiness": "enthusiastic/cautious/skeptical/hostile"
    }}
    """
    
    try:
        response = bedrock.invoke_model(
            modelId=os.environ.get('MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "top_p": 0.9
            })
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['content'][0]['text']
        
        # Parse the JSON response
        analysis = json.loads(content)
        
        # Add metadata
        analysis['post_id'] = post['id']
        analysis['analyzed_at'] = datetime.utcnow().isoformat()
        analysis['model_used'] = os.environ.get('MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')
        
        return analysis
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON response for post {post['id']}: {e}")
        return None
    except Exception as e:
        print(f"Error invoking Bedrock for post {post['id']}: {e}")
        return None