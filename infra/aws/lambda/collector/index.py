"""
AWS Lambda handler for Reddit Legal Communities Crawler
Adapted from prototype/reddit_crawler.py for serverless execution
"""

import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import boto3
import praw
from praw.models import Submission, Comment
from prawcore.exceptions import ResponseException, RequestException

s3 = boto3.client('s3')

# Configuration constants from prototype
MAX_REQUESTS_PER_MINUTE = 30
POSTS_PER_LISTING = 25
COMMENTS_PER_POST = 20
SEARCH_LIMIT = 10
SEARCH_COMMENTS_LIMIT = 10
MAX_COMMENT_DEPTH = 4
MAX_REPLIES_PER_COMMENT = 10
MIN_COMMENT_SCORE = -5
PRESERVE_CONTEXT = True
ALWAYS_INCLUDE_AUTHOR = True


def handler(event, context):
    """
    Lambda handler for Reddit data collection
    Implements the core logic from RedditLegalCrawler
    """
    print(f"Starting Reddit collection with event: {json.dumps(event)}")
    
    # Validate Reddit credentials from environment
    reddit_client_id = os.environ.get('REDDIT_CLIENT_ID')
    reddit_client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
    reddit_user_agent = os.environ.get('REDDIT_USER_AGENT', 'legal-crawler/1.0')
    
    if not reddit_client_id or not reddit_client_secret:
        raise ValueError(
            "Reddit API credentials not configured. "
            "Please redeploy the stack with --context redditClientId=XXX --context redditClientSecret=YYY"
        )
    
    # Initialize Reddit client with rate limit handling
    reddit = praw.Reddit(
        client_id=reddit_client_id,
        client_secret=reddit_client_secret,
        user_agent=reddit_user_agent,
        check_for_async=False,
        ratelimit_seconds=300  # Wait up to 5 minutes when rate limited
    )
    reddit.read_only = True  # Enable read-only mode for better rate limits
    
    # Configuration from event or defaults
    config = {
        'subreddits': event.get('subreddits', ['LawFirm', 'Lawyertalk', 'legaltech']),
        'keywords': event.get('keywords', [
            'Supio', 'Harvey', 'Casetext', 'Lexis+', 'Westlaw',
            'AI', 'automation', 'document review', 'contract analysis'
        ]),
        'days_back': event.get('days_back', 3),
        'min_score': event.get('min_score', 10),
        'incremental': event.get('incremental', False),  # Lambda is stateless by default
        'crawl_type': event.get('crawl_type', 'both')  # 'crawl', 'search', or 'both'
    }
    
    # Initialize tracking (simplified for Lambda - no persistent state)
    record = {
        'posts': {},
        'comments': {},
        'last_crawl': {}
    }
    
    all_posts = []
    
    try:
        for subreddit_name in config['subreddits']:
            # Crawl subreddit listings (hot, new, rising, top)
            if config['crawl_type'] in ['crawl', 'both']:
                posts = crawl_subreddit(
                    reddit,
                    subreddit_name,
                    config,
                    record
                )
                all_posts.extend(posts)
            
            # Search for keywords
            if config['crawl_type'] in ['search', 'both']:
                posts = search_keywords(
                    reddit,
                    subreddit_name,
                    config,
                    record
                )
                all_posts.extend(posts)
        
        # Save to S3
        bucket_name = os.environ['BUCKET_NAME']
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        s3_key = f"reddit/{datetime.utcnow().strftime('%Y-%m-%d')}/crawl_{timestamp}.json"
        
        # Count total comments including nested
        def count_comments(comments_list):
            count = len(comments_list)
            for comment in comments_list:
                if "replies" in comment:
                    count += count_comments(comment["replies"])
            return count
        
        total_comments = sum(count_comments(post.get("comments", [])) for post in all_posts)
        
        s3.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps({
                'collected_at': datetime.utcnow().isoformat(),
                'config': config,
                'posts_count': len(all_posts),
                'comments_count': total_comments,
                'posts': all_posts
            }),
            ContentType='application/json'
        )
        
        print(f"Successfully collected {len(all_posts)} posts and {total_comments} comments")
        print(f"Saved to s3://{bucket_name}/{s3_key}")
        
        return {
            'statusCode': 200,
            'posts_collected': len(all_posts),
            'comments_collected': total_comments,
            's3_location': f"s3://{bucket_name}/{s3_key}",
            'timestamp': timestamp
        }
        
    except Exception as e:
        print(f"Error in Reddit collection: {str(e)}")
        raise


def crawl_subreddit(reddit, subreddit_name: str, config: Dict, record: Dict) -> List[Dict]:
    """
    Crawl a specific subreddit using listing endpoints (hot, new, rising, top)
    Follows prototype's crawl_subreddit implementation
    """
    print(f"\nCrawling r/{subreddit_name}...")
    subreddit = reddit.subreddit(subreddit_name)
    
    # Calculate time threshold
    time_threshold = datetime.now(timezone.utc) - timedelta(days=config['days_back'])
    time_threshold_unix = time_threshold.timestamp()
    
    collected_posts = []
    
    # Track subreddit-specific records
    post_records = record["posts"].setdefault(subreddit_name, {})
    comment_records = record["comments"].setdefault(subreddit_name, {})
    
    # Fetch posts from different listing types
    for listing_type in ['hot', 'new', 'rising', 'top']:
        print(f"  Fetching {listing_type} posts...")
        
        try:
            # Get appropriate listing
            if listing_type == 'top':
                listing = subreddit.top(limit=POSTS_PER_LISTING, time_filter='day')
            elif listing_type == 'hot':
                listing = subreddit.hot(limit=POSTS_PER_LISTING)
            elif listing_type == 'new':
                listing = subreddit.new(limit=POSTS_PER_LISTING)
            else:  # rising
                listing = subreddit.rising(limit=POSTS_PER_LISTING)
            
            for submission in listing:
                # Filter by time and relevance
                if submission.created_utc < time_threshold_unix:
                    continue
                
                # Check keyword relevance
                if not is_relevant(f"{submission.title} {submission.selftext}", config['keywords']):
                    continue
                
                # Check minimum score
                if submission.score < config['min_score']:
                    continue
                
                # Extract post data
                post_data = extract_post_data(submission)
                post_hash = get_content_hash(post_data)
                
                # Check if already processed (simplified for Lambda)
                if config['incremental'] and submission.id in post_records:
                    if post_records[submission.id].get("hash") == post_hash:
                        continue
                
                # Initialize comments list
                post_data["comments"] = []
                
                # Fetch comment forest
                submission.comments.replace_more(limit=0)
                
                # Process top-level comments and their nested replies
                top_comments = submission.comments[:COMMENTS_PER_POST]
                
                for comment in top_comments:
                    if isinstance(comment, Comment):
                        # Recursively fetch comment tree
                        comment_tree = fetch_comment_tree(
                            comment,
                            comment_records,
                            config,
                            depth=0,
                            incremental=config['incremental']
                        )
                        if comment_tree:
                            post_data["comments"].append(comment_tree)
                
                # Update record
                post_records[submission.id] = {
                    "hash": post_hash,
                    "last_seen": datetime.now(timezone.utc).isoformat()
                }
                collected_posts.append(post_data)
                
                # Rate limiting
                time.sleep(0.5)
                
        except (ResponseException, RequestException) as e:
            print(f"    Error fetching {listing_type}: {str(e)}")
            if "429" in str(e) or "rate limit" in str(e).lower():
                time.sleep(60)  # Back off for 1 minute
                break
            continue
        except Exception as e:
            print(f"    Unexpected error fetching {listing_type}: {e}")
            continue
    
    print(f"  Collected {len(collected_posts)} posts from r/{subreddit_name}")
    return collected_posts


def search_keywords(reddit, subreddit_name: str, config: Dict, record: Dict) -> List[Dict]:
    """
    Search for specific keywords in a subreddit
    Follows prototype's search_keywords implementation
    """
    print(f"\nSearching keywords in r/{subreddit_name}...")
    subreddit = reddit.subreddit(subreddit_name)
    
    collected_posts = []
    
    post_records = record["posts"].setdefault(f"{subreddit_name}_search", {})
    comment_records = record["comments"].setdefault(f"{subreddit_name}_search", {})
    
    for keyword in config['keywords']:
        print(f"  Searching for '{keyword}'...")
        
        try:
            # Search posts with reduced limit
            for submission in subreddit.search(
                query=keyword,
                time_filter='week',
                sort='relevance',
                limit=SEARCH_LIMIT
            ):
                post_data = extract_post_data(submission)
                post_hash = get_content_hash(post_data)
                
                # Check if already processed
                if config['incremental'] and submission.id in post_records:
                    if post_records[submission.id].get("hash") == post_hash:
                        continue
                
                # Initialize comments list
                post_data["comments"] = []
                
                # Fetch comment forest
                submission.comments.replace_more(limit=0)
                
                # Process top-level comments with limited depth for search
                top_comments = submission.comments[:SEARCH_COMMENTS_LIMIT]
                
                for comment in top_comments:
                    if isinstance(comment, Comment):
                        # Fetch comment tree with shallower depth for search
                        comment_tree = fetch_comment_tree(
                            comment,
                            comment_records,
                            config,
                            depth=0,
                            incremental=config['incremental'],
                            max_depth=1  # Limit to 1 level for search
                        )
                        
                        if comment_tree:
                            comment_tree["matched_keyword"] = keyword
                            post_data["comments"].append(comment_tree)
                
                # Store post
                post_records[submission.id] = {
                    "hash": post_hash,
                    "keyword": keyword,
                    "last_seen": datetime.now(timezone.utc).isoformat()
                }
                collected_posts.append(post_data)
                
                time.sleep(1.0)  # Conservative rate limiting
                
        except (ResponseException, RequestException) as e:
            print(f"    Error searching '{keyword}': {str(e)}")
            if "429" in str(e) or "rate limit" in str(e).lower():
                time.sleep(60)  # Back off for 1 minute
                break
            continue
        except Exception as e:
            print(f"    Unexpected error searching '{keyword}': {e}")
            continue
    
    print(f"  Found {len(collected_posts)} posts via keyword search")
    return collected_posts


def fetch_comment_tree(
    comment: Comment,
    comment_records: Dict,
    config: Dict,
    depth: int = 0,
    incremental: bool = True,
    check_relevance: bool = True,
    max_depth: Optional[int] = None
) -> Optional[Dict]:
    """
    Recursively fetch a comment and its replies up to MAX_COMMENT_DEPTH
    Follows prototype's _fetch_comment_tree implementation
    """
    # Use provided max_depth or default
    effective_max_depth = max_depth if max_depth is not None else MAX_COMMENT_DEPTH
    
    # Skip if we've reached maximum depth
    if depth > effective_max_depth:
        return None
    
    # Skip low-score comments (but be more lenient for replies)
    min_score = MIN_COMMENT_SCORE if depth == 0 else MIN_COMMENT_SCORE - 3
    if comment.score < min_score:
        return None
    
    # Relevance checking logic
    is_author_reply = ALWAYS_INCLUDE_AUTHOR and hasattr(comment, 'is_submitter') and comment.is_submitter
    
    # Skip non-relevant comments based on configuration
    if check_relevance and not is_author_reply:
        if depth == 0:
            # For top-level comments, always check relevance
            if not is_relevant(comment.body, config['keywords']):
                return None
        elif not PRESERVE_CONTEXT:
            # For nested comments, only check relevance if PRESERVE_CONTEXT is False
            if not is_relevant(comment.body, config['keywords']):
                return None
    
    # Extract comment data
    comment_data = extract_comment_data(comment, depth)
    comment_hash = get_content_hash(comment_data)
    
    # Check if unchanged in incremental mode
    if incremental and comment.id in comment_records:
        if comment_records[comment.id].get("hash") == comment_hash:
            return None
    
    # Update record
    comment_records[comment.id] = {
        "hash": comment_hash,
        "depth": depth,
        "last_seen": datetime.now(timezone.utc).isoformat()
    }
    
    # Fetch replies if not at maximum depth
    if depth < effective_max_depth and hasattr(comment, 'replies'):
        # Get limited number of replies
        replies = comment.replies[:MAX_REPLIES_PER_COMMENT]
        
        for reply in replies:
            if isinstance(reply, Comment):
                # Recursively fetch reply tree
                reply_data = fetch_comment_tree(
                    reply,
                    comment_records,
                    config,
                    depth + 1,
                    incremental,
                    check_relevance=False,  # Include all replies for context
                    max_depth=max_depth
                )
                if reply_data:
                    comment_data["replies"].append(reply_data)
                
                # Small delay to avoid rate limiting
                time.sleep(0.1)
    
    return comment_data


def is_relevant(text: str, keywords: List[str]) -> bool:
    """Check if content is relevant based on keywords"""
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in keywords)


def extract_post_data(submission: Submission) -> Dict:
    """Extract relevant data from a Reddit submission"""
    return {
        "id": submission.id,
        "subreddit": submission.subreddit.display_name,
        "title": submission.title,
        "content": submission.selftext,
        "author": str(submission.author) if submission.author else "[deleted]",
        "created_utc": int(submission.created_utc),
        "score": submission.score,
        "upvote_ratio": submission.upvote_ratio,
        "num_comments": submission.num_comments,
        "url": f"https://reddit.com{submission.permalink}",
        "flair": submission.link_flair_text,
        "edited": submission.edited,
        "collected_at": datetime.now(timezone.utc).isoformat()
    }


def extract_comment_data(comment: Comment, depth: int = 0) -> Dict:
    """
    Extract relevant data from a Reddit comment including nested replies
    """
    return {
        "id": comment.id,
        "submission_id": comment.submission.id,
        "parent_id": comment.parent_id,
        "author": str(comment.author) if comment.author else "[deleted]",
        "body": comment.body,
        "score": comment.score,
        "created_utc": int(comment.created_utc),
        "edited": comment.edited,
        "is_submitter": comment.is_submitter,
        "permalink": f"https://reddit.com{comment.permalink}",
        "depth": depth,  # Track depth for analysis
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "replies": []  # Will contain nested replies
    }


def get_content_hash(content: Dict) -> str:
    """
    Generate MD5 hash for content to detect changes
    """
    key_fields = ["id", "score", "edited", "num_comments"] if "num_comments" in content else ["id", "score", "edited"]
    content_str = json.dumps({k: content.get(k) for k in key_fields}, sort_keys=True)
    return hashlib.md5(content_str.encode()).hexdigest()