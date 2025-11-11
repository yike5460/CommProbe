import json
import os
import boto3
from datetime import datetime
from typing import Dict, List, Any
import time

s3 = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime', region_name='us-west-2')
PRIORITY_SCORE_THRESHOLD = 5

def handler(event, context):
    """
    Lambda handler for analyzing posts from multiple sources (Reddit + Twitter + Slack) using Amazon Bedrock

    Supports both:
    - Legacy single-source: event = {s3_location: "..."}
    - Multi-source parallel: event = {collectionResults: [{platform: "reddit", s3_location: "..."}, ...]}

    Note: Slack data is skipped here since it's already analyzed inline by the Slack Collector Lambda
    """
    print(f"Starting analysis with event: {json.dumps(event)}")

    # Debug bedrock region
    bedrock_region = os.environ.get('BEDROCK_REGION', 'us-west-2')
    print(f"BEDROCK_REGION environment variable: {bedrock_region}")
    print(f"Bedrock client region: {bedrock.meta.region_name}")

    # Check if this is a parallel workflow (Reddit + Twitter) or single source (legacy)
    collection_results = event.get('collectionResults', [])

    all_posts = []

    if collection_results:
        # NEW: Multi-source parallel workflow (Reddit + Twitter)
        print(f"Processing {len(collection_results)} collection results from parallel workflow")

        for result in collection_results:
            # Extract platform and s3_location from result
            # Step Functions wraps Lambda response in Payload
            result_body = result.get('Payload', result)

            platform = result_body.get('platform', 'unknown')
            s3_location = result_body.get('s3_location')

            # Skip Slack data - it's already analyzed and stored by the collector Lambda
            if platform == 'slack':
                print(f"Skipping Slack data (already analyzed): {s3_location}")
                continue

            if not s3_location:
                print(f"Warning: No s3_location in result for platform {platform}, skipping")
                continue

            print(f"Loading {platform} data from {s3_location}")

            # Load posts from S3 and add platform tag
            posts = load_posts_from_s3(s3_location, platform)
            all_posts.extend(posts)

            print(f"Loaded {len(posts)} posts from {platform}")
    else:
        # LEGACY: Single-source workflow (backward compatible)
        print("Using legacy single-source mode")
        s3_location = event.get('body', {}).get('s3_location') or event.get('s3_location')

        if not s3_location:
            raise ValueError("No s3_location or collectionResults provided in event")

        # Load posts with platform defaulting to 'reddit' for backward compatibility
        posts = load_posts_from_s3(s3_location, platform='reddit')
        all_posts.extend(posts)

    print(f"Total posts to analyze: {len(all_posts)}")


    # Analyze posts in batches
    analyzed_posts = []  # High priority insights only
    all_analysis_results = []  # All analysis results for compliance/debugging
    batch_size = 10

    for i in range(0, len(all_posts), batch_size):
        batch = all_posts[i:i + batch_size]
        for post in batch:
            try:
                analysis = analyze_post(post)
                if analysis:
                    # Store all analysis results for compliance/debugging
                    all_analysis_results.append({
                        'post': post,
                        'analysis': analysis
                    })

                    # Only include high priority insights in main results
                    if analysis.get('priority_score', 0) >= PRIORITY_SCORE_THRESHOLD:
                        analyzed_posts.append({
                            'post': post,
                            'analysis': analysis
                        })
                time.sleep(0.2)  # Rate limiting for Bedrock
            except Exception as e:
                print(f"Error analyzing post {post.get('id')}: {str(e)}")
    
    # Save analyzed results back to S3
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    date_str = datetime.utcnow().strftime('%Y-%m-%d')

    # Save high-priority insights (existing behavior)
    filtered_analysis_key = f"analyzed/{date_str}/filtered_analysis_{timestamp}.json"
    s3.put_object(
        Bucket=os.environ['BUCKET_NAME'],
        Key=filtered_analysis_key,
        Body=json.dumps({
            'analyzed_at': datetime.utcnow().isoformat(),
            'posts_analyzed': len(all_posts),
            'insights_generated': len(analyzed_posts),
            'insights': analyzed_posts
        }),
        ContentType='application/json'
    )

    # Save all analysis results for compliance/debugging
    full_analysis_key = filtered_analysis_key.replace('filtered_', 'full_')
    s3.put_object(
        Bucket=os.environ['BUCKET_NAME'],
        Key=full_analysis_key,
        Body=json.dumps({
            'analyzed_at': datetime.utcnow().isoformat(),
            'posts_analyzed': len(all_posts),
            'total_analysis_results': len(all_analysis_results),
            'high_priority_insights': len(analyzed_posts),
            'priority_threshold': PRIORITY_SCORE_THRESHOLD,
            'all_analysis_results': all_analysis_results
        }),
        ContentType='application/json'
    )
    
    print(f"Analysis complete. Generated {len(analyzed_posts)} high-priority insights, {len(all_analysis_results)} total analysis results")
    print(f"High-priority insights saved to: {filtered_analysis_key}")
    print(f"All analysis results saved to: {full_analysis_key}")
    
    return {
        'statusCode': 200,
        'posts_analyzed': len(all_posts),
        'insights_generated': len(analyzed_posts),
        's3_location': f"s3://{os.environ['BUCKET_NAME']}/{filtered_analysis_key}",
        'timestamp': timestamp
    }


def load_posts_from_s3(s3_location: str, platform: str) -> List[Dict]:
    """
    Load posts from S3 and convert to unified format with platform tag

    Args:
        s3_location: S3 URI (s3://bucket/key)
        platform: Source platform ('reddit' or 'twitter')

    Returns:
        List of posts in unified format with platform field
    """
    # Parse S3 location
    bucket_name = s3_location.replace('s3://', '').split('/')[0]
    s3_key = '/'.join(s3_location.replace('s3://', '').split('/')[1:])

    # Fetch data from S3
    response = s3.get_object(Bucket=bucket_name, Key=s3_key)
    data = json.loads(response['Body'].read())

    posts = []

    if platform == 'reddit':
        # Reddit posts are already in the expected format
        reddit_posts = data.get('posts', [])
        for post in reddit_posts:
            post['platform'] = 'reddit'  # Tag with platform
            posts.append(post)

    elif platform == 'twitter':
        # Convert Twitter tweets to unified post format
        tweets = data.get('tweets', [])
        for tweet in tweets:
            # Convert Twitter data structure to match Reddit format for analysis
            posts.append({
                'id': tweet.get('tweet_id', tweet.get('id')),
                'platform': 'twitter',
                'title': f"Tweet by @{tweet.get('author', {}).get('username', 'unknown')}",
                'content': tweet.get('text', ''),
                'author': tweet.get('author', {}).get('username', 'unknown'),
                'url': tweet.get('url', ''),
                'score': tweet.get('metrics', {}).get('likes', 0) + tweet.get('metrics', {}).get('retweets', 0),
                'created_utc': tweet.get('created_at', ''),
                'subreddit': 'twitter',  # Placeholder for compatibility
                'num_comments': tweet.get('metrics', {}).get('replies', 0),
                'metrics': tweet.get('metrics', {}),
                'collected_at': tweet.get('collected_at', ''),
                # Store original tweet data for reference
                'twitter_data': tweet
            })

    return posts


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
    Analyze this Reddit post from the personal injury law community r/{post['subreddit']}.

    Post Title: {post['title']}
    Post Content: {post.get('content', 'No text content')}
    Post Score: {post['score']} points
    Number of Comments: {post['num_comments']}

    Top Comments:
    {comments_text}

    Analyze this post as a Supio product analyst focusing on PI law medical records automation:

    1. PI-Specific Feature Discovery:
       - Identify medical records processing pain points (volume, organization, chronology creation)
       - Detect demand letter automation needs (medical narrative, treatment timeline, causation)
       - Note medical bill aggregation and cost calculation challenges
       - Categorize: medical_records_processing, demand_letter_automation, medical_chronology, settlement_valuation, case_management
       - Assign priority score (1-10) based on time savings potential per case and frequency of need
       - Note if quick_win (medical chronology automation), strategic_feature (demand letter AI), or future_consideration

    2. PI Competitive Intelligence:
       - Identify mentions of PI-focused competitors (EvenUp, Eve)
       - Assess sentiment toward each competitor's medical records processing features
       - Extract specific strengths/weaknesses of competitors' medical chronology tools
       - Note switching barriers from current medical records workflow
       - Identify gaps in competitor medical terminology extraction accuracy

    3. PI User Segmentation:
       - Identify user type: solo_pi_attorney, small_pi_firm, mid_size_pi_firm, large_pi_firm
       - Note case types: motor_vehicle_accidents, slip_and_fall, medical_malpractice, workers_comp, mass_torts
       - Assess medical records volume per case (pages per typical case)
       - Assess AI readiness for medical analysis: enthusiastic, cautious, skeptical, hostile
       - Identify decision factors (medical accuracy, HIPAA compliance, time savings per case, cost per chronology)

    4. Medical Records Pain Point Analysis:
       - Extract time spent on manual medical chronology creation (typical: 8-20 hours per case)
       - Identify challenges with medical terminology comprehension
       - Note difficulty organizing records from multiple providers
       - Assess demand letter drafting bottlenecks with medical narrative
       - Map each pain point to potential Supio medical AI solution
       - Estimate ROI potential: hours_saved_per_chronology, cases_handled_per_month_increase, faster_settlement_times

    5. Action Items for PI-Focused PM:
       - Flag if immediate PM review needed for high-value medical automation opportunity
       - Suggest specific medical records feature roadmap items
       - Identify potential beta testing candidates (PI firms willing to try medical AI)
       - Note any urgent competitive threats from EvenUp/Eve medical features
       - Recommend proof-of-concept medical chronology samples to demonstrate accuracy

    IMPORTANT: Return ONLY a valid JSON object with no markdown formatting, no code blocks, no explanations. Start directly with {{ and end with }}.

    {{
        "feature_summary": "one-line description emphasizing medical workflow impact",
        "feature_category": "medical_records_processing|demand_letter_automation|medical_chronology|settlement_valuation|case_management|not_applicable",
        "priority_score": 1-10,
        "user_segment": "solo_pi_attorney|small_pi_firm|mid_size_pi_firm|large_pi_firm|not_applicable",
        "competitors_mentioned": ["EvenUp", "Eve"],
        "supio_mentioned": true|false,
        "action_required": true|false,
        "suggested_action": "quick_win|strategic_feature|future_consideration|no_action",
        "pain_points": ["specific medical workflow inefficiency with time estimate"],
        "competitive_advantage": "how this helps Supio vs EvenUp/Eve in medical records processing",
        "implementation_size": "small|medium|large|not_applicable",
        "ai_readiness": "enthusiastic|cautious|skeptical|hostile|not_applicable",
        "medical_workflow_impact": "hours_saved_per_chronology|cases_per_month_increase|faster_settlement_times|not_applicable"
    }}
    """
    
    try:
        response = bedrock.invoke_model(
            modelId=os.environ.get('MODEL_ID', 'us.anthropic.claude-sonnet-4-20250514-v1:0'),
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
        analysis['model_used'] = os.environ.get('MODEL_ID', 'us.anthropic.claude-sonnet-4-20250514-v1:0')
        
        return analysis
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON response for post {post['id']}: {e}")
        return None
    except Exception as e:
        print(f"Error invoking Bedrock for post {post['id']}: {e}")
        return None