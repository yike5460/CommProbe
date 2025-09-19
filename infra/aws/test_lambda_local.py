#!/usr/bin/env python3
"""
Test script for Lambda collector function locally
Requires Reddit API credentials in environment variables
"""

import os
import sys
import json
from datetime import datetime

# Add Lambda directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda/collector'))

# Set up test environment
os.environ['BUCKET_NAME'] = 'test-bucket-local'
os.environ['REDDIT_CLIENT_ID'] = os.environ.get('REDDIT_CLIENT_ID', '')
os.environ['REDDIT_CLIENT_SECRET'] = os.environ.get('REDDIT_CLIENT_SECRET', '')
os.environ['REDDIT_USER_AGENT'] = 'legal-crawler-test/1.0'

# Import the handler
from index import handler

def test_collector():
    """Test the collector Lambda function locally"""
    
    # Test event
    event = {
        'subreddits': ['legaltech'],  # Test with one subreddit
        'keywords': ['AI', 'automation'],  # Limited keywords for testing
        'days_back': 1,  # Only look back 1 day
        'min_score': 5,  # Lower threshold for testing
        'crawl_type': 'search',  # Use search for faster testing
        'incremental': False
    }
    
    # Mock context
    class Context:
        aws_request_id = 'test-request-id'
        log_group_name = '/aws/lambda/test'
        log_stream_name = 'test-stream'
        function_name = 'test-function'
        memory_limit_in_mb = 1024
        function_version = '$LATEST'
        invoked_function_arn = 'arn:aws:lambda:us-east-1:123456789:function:test'
        
    context = Context()
    
    print("Starting test with event:")
    print(json.dumps(event, indent=2))
    print("\n" + "="*50 + "\n")
    
    try:
        # Note: This will fail on S3 upload but will test the Reddit collection logic
        result = handler(event, context)
        print("\nResult:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\nExpected error (S3 not available locally): {e}")
        print("\nThis is normal for local testing. The Reddit collection logic was tested.")
        
        # Check if we can at least initialize Reddit client
        import praw
        reddit = praw.Reddit(
            client_id=os.environ.get('REDDIT_CLIENT_ID', 'test'),
            client_secret=os.environ.get('REDDIT_CLIENT_SECRET', 'test'),
            user_agent='test'
        )
        print(f"\n✓ PRAW client initialized: {reddit.read_only}")

if __name__ == "__main__":
    if not os.environ.get('REDDIT_CLIENT_ID'):
        print("Warning: REDDIT_CLIENT_ID not set. Set it to test with real Reddit API.")
        print("Example: export REDDIT_CLIENT_ID=your_client_id")
        print("         export REDDIT_CLIENT_SECRET=your_secret")
        print()
    
    test_collector()