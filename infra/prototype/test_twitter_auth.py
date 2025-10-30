"""
Quick Twitter API Authentication Test
Tests that the Bearer Token is valid without exhausting rate limits
"""

import tweepy
import sys

def test_twitter_auth(bearer_token):
    """
    Test Twitter API authentication with Bearer Token

    Args:
        bearer_token: X API v2 Bearer Token

    Returns:
        bool: True if authentication successful
    """
    print("="*60)
    print("Testing Twitter API Authentication")
    print("="*60)

    try:
        # Initialize client with Bearer Token
        print("\n1️⃣  Initializing Tweepy client...")
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=False  # Don't wait for rate limits in test
        )
        print("   ✅ Client initialized")

        # Test with minimal search (uses only 1 API call)
        print("\n2️⃣  Testing API access with minimal search...")
        print("   Query: 'twitter' (last 24h, max 10 results)")

        from datetime import datetime, timedelta, timezone
        start_time = datetime.now(timezone.utc) - timedelta(days=1)

        response = client.search_recent_tweets(
            query="twitter",
            start_time=start_time,
            max_results=10,
            tweet_fields=['created_at', 'public_metrics']
        )

        print(f"   ✅ API call successful!")

        # Check response
        if response.data:
            print(f"\n3️⃣  Response validation:")
            print(f"   ✅ Received {len(response.data)} tweets")
            print(f"\n   Sample tweet:")
            sample = response.data[0]
            print(f"   - ID: {sample.id}")
            print(f"   - Text: {sample.text[:80]}...")
            print(f"   - Created: {sample.created_at}")
            print(f"   - Likes: {sample.public_metrics['like_count']}")
        else:
            print(f"\n3️⃣  Response validation:")
            print(f"   ⚠️  No tweets returned (query may be too restrictive)")
            print(f"   ℹ️  Authentication still successful!")

        # Check rate limit status
        if hasattr(response, 'meta'):
            remaining = response.meta.get('x-rate-limit-remaining', 'N/A')
            limit = response.meta.get('x-rate-limit-limit', 'N/A')
            reset = response.meta.get('x-rate-limit-reset', 'N/A')

            print(f"\n4️⃣  Rate Limit Status:")
            print(f"   - Remaining: {remaining}/{limit}")
            print(f"   - Reset time: {reset}")

            if remaining == 0 or remaining == '0':
                print(f"   ⚠️  WARNING: Rate limit exhausted!")
                print(f"   ℹ️  This is likely Free tier (very low limits)")

        print("\n" + "="*60)
        print("✅ AUTHENTICATION TEST PASSED")
        print("="*60)
        print("\n💡 Your Bearer Token is valid and working!")
        print("💡 You can proceed with CDK infrastructure setup")
        print("\n⚠️  NOTE: You appear to be on Free tier (100 posts/month)")
        print("   Consider upgrading to Basic tier ($200/mo, 15K posts/month)")
        print("   for production use.")
        print("="*60)

        return True

    except tweepy.errors.Unauthorized as e:
        print("\n" + "="*60)
        print("❌ AUTHENTICATION FAILED")
        print("="*60)
        print(f"\nError: {e}")
        print("\n🔍 Troubleshooting:")
        print("   1. Check that your Bearer Token is correct")
        print("   2. Verify token hasn't expired")
        print("   3. Check X Developer Portal for app status")
        print("="*60)
        return False

    except tweepy.errors.Forbidden as e:
        print("\n" + "="*60)
        print("❌ ACCESS FORBIDDEN")
        print("="*60)
        print(f"\nError: {e}")
        print("\n🔍 Troubleshooting:")
        print("   1. Check your API tier has access to search_recent_tweets")
        print("   2. Verify app permissions in X Developer Portal")
        print("   3. Ensure app is not suspended")
        print("="*60)
        return False

    except tweepy.errors.TooManyRequests as e:
        print("\n" + "="*60)
        print("⚠️  RATE LIMIT EXCEEDED")
        print("="*60)
        print(f"\nError: {e}")
        print("\n✅ Good news: Authentication is working!")
        print("⚠️  Bad news: You've hit rate limits")
        print("\n💡 This means:")
        print("   1. Your Bearer Token is VALID ✅")
        print("   2. You're likely on Free tier (100 posts/month)")
        print("   3. Rate limit resets every 15 minutes")
        print("\n💡 For production:")
        print("   - Upgrade to Basic tier ($200/mo, 15K posts/month)")
        print("   - This will give you sufficient capacity for weekly crawls")
        print("="*60)
        return True  # Auth worked, just rate limited

    except Exception as e:
        print("\n" + "="*60)
        print("❌ UNEXPECTED ERROR")
        print("="*60)
        print(f"\nError: {e}")
        print(f"Error type: {type(e)}")
        print("="*60)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Get bearer token
    import os
    bearer_token = os.getenv(
        'TWITTER_BEARER_TOKEN',
        'AAAAAAAAAAAAAAAAAAAAADI25AEAAAAAH282Z5Gi4tdw1o12WlKP4vcpWY8%3DHgcIiWpe62ppw1ecCLdsoKFyc4ljvQTXlxEFkM67FBJMz7VsPZ'
    )

    if not bearer_token:
        print("❌ No bearer token provided!")
        sys.exit(1)

    # Run test
    success = test_twitter_auth(bearer_token)
    sys.exit(0 if success else 1)
