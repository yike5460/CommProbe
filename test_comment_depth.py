#!/usr/bin/env python3
"""
Test script to verify comment tree crawling captures all nested comments
including author replies and full conversation context.
"""

import os
import json
from dotenv import load_dotenv
from reddit_crawler import RedditLegalCrawler
import praw

def test_specific_post():
    """Test crawling a specific post to verify all comments are captured"""
    
    # Load credentials
    load_dotenv()
    
    # Initialize crawler with test configuration
    crawler = RedditLegalCrawler(
        client_id=os.getenv("REDDIT_CLIENT_ID", ""),
        client_secret=os.getenv("REDDIT_CLIENT_SECRET", ""),
        user_agent=os.getenv("REDDIT_USER_AGENT", "test-crawler/1.0"),
        s3_bucket=None  # No S3 for testing
    )
    
    # Test post from the example: Insurance adjuster voicemail
    test_post_id = "1njn83l"
    test_subreddit = "LawFirm"
    
    print(f"\n{'='*60}")
    print(f"Testing comment depth crawling for post: {test_post_id}")
    print(f"Subreddit: r/{test_subreddit}")
    print(f"{'='*60}\n")
    
    # Get the specific post
    reddit = crawler.reddit
    submission = reddit.submission(id=test_post_id)
    
    # Refresh to get all data
    submission._fetch()
    
    print(f"Post Title: {submission.title}")
    print(f"Post Author: {submission.author}")
    print(f"Total Comments: {submission.num_comments}")
    print(f"\nFetching comment tree...\n")
    
    # Fetch all comments
    submission.comments.replace_more(limit=None)  # Get ALL comments
    
    # Count comments at each depth
    def count_comments_by_depth(comments, depth=0, counts=None):
        if counts is None:
            counts = {}
        
        for comment in comments:
            if isinstance(comment, praw.models.Comment):
                counts[depth] = counts.get(depth, 0) + 1
                
                # Count author replies
                if hasattr(comment, 'is_submitter') and comment.is_submitter:
                    counts['author_replies'] = counts.get('author_replies', 0) + 1
                
                # Recurse into replies
                if hasattr(comment, 'replies'):
                    count_comments_by_depth(comment.replies, depth + 1, counts)
        
        return counts
    
    # Get actual Reddit comment structure
    depth_counts = count_comments_by_depth(submission.comments)
    
    print("Actual Reddit Comment Structure:")
    for depth in sorted([d for d in depth_counts.keys() if isinstance(d, int)]):
        print(f"  Depth {depth}: {depth_counts[depth]} comments")
    print(f"  Author replies: {depth_counts.get('author_replies', 0)}")
    
    # Now test our crawler
    print(f"\n{'='*60}")
    print("Testing our crawler's comment fetching...")
    print(f"{'='*60}\n")
    
    # Use crawler to fetch this specific post
    # We'll need to temporarily modify keywords to ensure we capture this post
    original_keywords = crawler.keywords
    crawler.keywords = ["insurance", "adjuster", "voicemail", "demand"]  # Keywords from the post
    
    # Crawl just this subreddit
    posts = crawler.crawl_subreddit(
        subreddit_name=test_subreddit,
        days_back=30,  # Look back far enough
        incremental=False,  # Full crawl
        min_score=0  # Include all posts
    )
    
    # Restore original keywords
    crawler.keywords = original_keywords
    
    # Find our test post in the results
    test_post_data = None
    for post in posts:
        if post['id'] == test_post_id:
            test_post_data = post
            break
    
    if test_post_data:
        print("✅ Post found in crawler results")
        
        # Count comments in our crawled data
        def count_crawled_comments(comments_list, depth=0, counts=None):
            if counts is None:
                counts = {}
            
            counts[depth] = counts.get(depth, 0) + len(comments_list)
            
            for comment in comments_list:
                if comment.get('is_submitter'):
                    counts['author_replies'] = counts.get('author_replies', 0) + 1
                
                if 'replies' in comment and comment['replies']:
                    count_crawled_comments(comment['replies'], depth + 1, counts)
            
            return counts
        
        crawled_counts = count_crawled_comments(test_post_data.get('comments', []))
        
        print("\nCrawled Comment Structure:")
        for depth in sorted([d for d in crawled_counts.keys() if isinstance(d, int)]):
            print(f"  Depth {depth}: {crawled_counts[depth]} comments")
        print(f"  Author replies: {crawled_counts.get('author_replies', 0)}")
        
        # Compare
        print(f"\n{'='*60}")
        print("Comparison:")
        print(f"{'='*60}")
        
        max_depth = max(max([d for d in depth_counts.keys() if isinstance(d, int)] or [0]),
                       max([d for d in crawled_counts.keys() if isinstance(d, int)] or [0]))
        
        for depth in range(max_depth + 1):
            actual = depth_counts.get(depth, 0)
            crawled = crawled_counts.get(depth, 0)
            status = "✅" if crawled >= actual * 0.8 else "❌"  # Allow 80% capture rate
            print(f"  Depth {depth}: {status} Actual: {actual}, Crawled: {crawled}")
        
        # Check author replies
        actual_author = depth_counts.get('author_replies', 0)
        crawled_author = crawled_counts.get('author_replies', 0)
        status = "✅" if crawled_author >= actual_author else "❌"
        print(f"  Author replies: {status} Actual: {actual_author}, Crawled: {crawled_author}")
        
        # Save the crawled post for inspection
        output_file = f"test_post_{test_post_id}.json"
        with open(output_file, 'w') as f:
            json.dump(test_post_data, f, indent=2)
        print(f"\n📁 Saved crawled post data to: {output_file}")
        
    else:
        print("❌ Post not found in crawler results")
        print("This might be because:")
        print("  - Post is too old (check days_back parameter)")
        print("  - Post doesn't match keywords")
        print("  - Post score is below threshold")

if __name__ == "__main__":
    test_specific_post()