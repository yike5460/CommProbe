"""
AWS Lambda handler for Reddit Legal Communities Crawler
Complete migration from prototype/reddit_crawler.py for serverless execution
Includes S3-based state persistence for incremental crawling
"""

import hashlib
import json
import os
import time
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import boto3
import praw
from praw.models import Submission, Comment
from prawcore.exceptions import ResponseException, RequestException
from botocore.exceptions import ClientError

# Initialize AWS clients
s3 = boto3.client('s3')


class LambdaRedditCrawler:
    """
    Lambda-adapted Reddit Legal Communities Crawler
    Migrated from RedditLegalCrawler with S3-based state persistence
    """

    # Reddit API rate limits (conservative to avoid issues)
    MAX_REQUESTS_PER_MINUTE = 30  # Reddit allows 60, but we'll be conservative
    MAX_REQUESTS_PER_DAY = 1000   # Soft limit to avoid IP blocking

    # Crawling configuration constants
    POSTS_PER_LISTING = 25        # Number of posts to fetch per listing type
    COMMENTS_PER_POST = 20        # Maximum top-level comments to fetch per post
    RATE_CHECK_INTERVAL = 5       # Check rate limit every N posts to prevent mid-crawl blocking
    HIGH_VALUE_POST_THRESHOLD = 50  # Score threshold for high-value posts
    MIN_COLLECTED_POSTS = 5       # Minimum posts before applying stricter rate limiting
    SEARCH_LIMIT = 10             # Limit for keyword search results
    SEARCH_COMMENTS_LIMIT = 10    # Top-level comments to fetch per search result

    # Comment tree configuration
    MAX_COMMENT_DEPTH = 4         # Maximum depth to traverse comment trees (0=top-level only)
    MAX_REPLIES_PER_COMMENT = 10  # Maximum replies to fetch per comment at each level
    MIN_COMMENT_SCORE = -5        # Skip comments below this score (avoid heavily downvoted)
    PRESERVE_CONTEXT = True       # Include all replies for conversation context (not just keyword matches)
    ALWAYS_INCLUDE_AUTHOR = True  # Always include post author's comments regardless of keywords

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        user_agent: str,
        s3_bucket: str,
        record_key: str = "reddit_crawl_record.json",
        rate_limit_key: str = "reddit_rate_limit.json"
    ):
        """
        Initialize Lambda Reddit crawler with PRAW client and S3-based record keeping

        Args:
            client_id: Reddit API client ID
            client_secret: Reddit API client secret
            user_agent: User agent string for Reddit API
            s3_bucket: S3 bucket name for state storage
            record_key: S3 key for crawl record
            rate_limit_key: S3 key for rate limit tracking
        """
        # Validate credentials
        if not all([client_id, client_secret, user_agent]):
            raise ValueError("Missing required Reddit API credentials")

        # Initialize Reddit client with rate limit handling
        self.reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
            check_for_async=False,
            ratelimit_seconds=300  # Wait up to 5 minutes when rate limited
        )
        self.reddit.read_only = True  # Enable read-only mode for better rate limits

        # S3 configuration for state persistence
        self.s3_bucket = s3_bucket
        self.record_key = record_key
        self.rate_limit_key = rate_limit_key

        # Rate limiting tracking
        self.rate_limit_data = self._load_rate_limit_data()
        self.request_count = 0
        self.last_request_time = time.time()
        self.backoff_until = 0  # Timestamp until which we should back off

        # Configuration
        self.subreddits = ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"]
        self.keywords = ["Supio", "Harvey", "Casetext", "Lexis+", "Westlaw",
                        "AI", "automation", "document review", "contract analysis"]
        self.record = self._load_record()

    def _load_from_s3(self, key: str, default_value: Dict) -> Dict:
        """Load JSON data from S3 with fallback to default"""
        try:
            response = s3.get_object(Bucket=self.s3_bucket, Key=key)
            return json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchKey':
                print(f"S3 key {key} not found, using default")
                return default_value
            else:
                print(f"Error loading from S3: {e}")
                return default_value
        except Exception as e:
            print(f"Unexpected error loading from S3: {e}")
            return default_value

    def _save_to_s3(self, key: str, data: Dict):
        """Save JSON data to S3"""
        try:
            s3.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=json.dumps(data, indent=2),
                ContentType='application/json'
            )
        except Exception as e:
            print(f"Error saving to S3: {e}")

    def _load_record(self) -> Dict:
        """
        Load or initialize the record from S3 for tracking crawled content

        The record structure enables incremental crawling by tracking what content
        we've already seen and detecting when it changes.
        """
        default_record = {
            "posts": {},      # Track posts by ID with hash
            "comments": {},   # Track comments by ID with hash
            "last_crawl": {}  # Track last crawl time per subreddit
        }
        return self._load_from_s3(self.record_key, default_record)

    def _load_rate_limit_data(self) -> Dict:
        """
        Load or initialize rate limit tracking data from S3

        This persists rate limiting state across Lambda invocations to:
        - Prevent exceeding daily API limits (MAX_REQUESTS_PER_DAY)
        - Track rate limit errors for exponential backoff
        - Reset counters at day boundaries
        """
        default_data = {
            "daily_requests": 0,
            "last_reset": datetime.now(timezone.utc).isoformat(),
            "rate_limit_hits": 0
        }

        data = self._load_from_s3(self.rate_limit_key, default_data)

        # Reset daily counter if it's a new day
        try:
            last_reset = datetime.fromisoformat(data.get("last_reset", "2020-01-01"))
            if datetime.now(timezone.utc).date() > last_reset.date():
                data["daily_requests"] = 0
                data["last_reset"] = datetime.now(timezone.utc).isoformat()
        except:
            data["last_reset"] = datetime.now(timezone.utc).isoformat()

        return data

    def _save_rate_limit_data(self):
        """Save rate limit tracking data to S3"""
        self._save_to_s3(self.rate_limit_key, self.rate_limit_data)

    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits"""
        # Check if we're in backoff period
        if time.time() < self.backoff_until:
            wait_time = int(self.backoff_until - time.time())
            print(f"⏳ Rate limited. Waiting {wait_time} seconds...")
            time.sleep(wait_time)
            return True

        # Check daily limit
        if self.rate_limit_data["daily_requests"] >= self.MAX_REQUESTS_PER_DAY:
            print(f"⚠️  Daily request limit ({self.MAX_REQUESTS_PER_DAY}) reached. Try again tomorrow.")
            return False

        # Check per-minute limit
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        # If we're making requests too fast, add delay
        min_delay = 60.0 / self.MAX_REQUESTS_PER_MINUTE  # ~2 seconds between requests
        if time_since_last < min_delay:
            sleep_time = min_delay - time_since_last
            time.sleep(sleep_time)

        self.last_request_time = time.time()
        self.request_count += 1
        self.rate_limit_data["daily_requests"] += 1

        # Save every 10 requests
        if self.request_count % 10 == 0:
            self._save_rate_limit_data()

        return True

    def _handle_rate_limit_error(self, error: Exception):
        """Handle rate limit errors with exponential backoff"""
        # Note: error parameter kept for future logging/debugging purposes
        self.rate_limit_data["rate_limit_hits"] += 1

        # Exponential backoff: 30s, 60s, 120s, 240s, etc.
        backoff_base = 30
        backoff_multiplier = min(2 ** self.rate_limit_data["rate_limit_hits"], 16)  # Max 8 minutes
        backoff_seconds = backoff_base * backoff_multiplier + random.randint(0, 30)  # Add jitter

        self.backoff_until = time.time() + backoff_seconds

        print(f"🚫 Rate limited! Backing off for {backoff_seconds} seconds")
        print(f"   This is rate limit hit #{self.rate_limit_data['rate_limit_hits']} today")
        print(f"   Daily requests so far: {self.rate_limit_data['daily_requests']}/{self.MAX_REQUESTS_PER_DAY}")

        self._save_rate_limit_data()
        time.sleep(backoff_seconds)

    def _save_record(self):
        """Save the current record to S3"""
        self._save_to_s3(self.record_key, self.record)

    def _get_content_hash(self, content: Dict) -> str:
        """
        Generate MD5 hash for content to detect changes
        Similar to Highspot crawler's approach
        """
        key_fields = ["id", "score", "edited", "num_comments"] if "num_comments" in content else ["id", "score", "edited"]
        hash_content = json.dumps({k: content.get(k) for k in key_fields}, sort_keys=True)
        return hashlib.md5(hash_content.encode()).hexdigest()

    def _is_relevant(self, text: str) -> bool:
        """Check if content is relevant based on keywords"""
        text_lower = text.lower()
        return any(keyword.lower() in text_lower for keyword in self.keywords)

    def _count_comments(self, comments_list: List[Dict]) -> int:
        """Recursively count comments including nested replies"""
        count = len(comments_list)
        for comment in comments_list:
            if "replies" in comment:
                count += self._count_comments(comment["replies"])
        return count

    def _extract_post_data(self, submission: Submission) -> Dict:
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

    def _extract_comment_data(self, comment: Comment, depth: int = 0) -> Dict:
        """
        Extract relevant data from a Reddit comment including nested replies

        Args:
            comment: Reddit comment object
            depth: Current depth in comment tree (for tracking)

        Returns:
            Dictionary with comment data and nested replies
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

    def _fetch_comment_tree(
        self,
        comment: Comment,
        comment_records: Dict,
        depth: int = 0,
        incremental: bool = True,
        check_relevance: bool = True
    ) -> Optional[Dict]:
        """
        Recursively fetch a comment and its replies up to MAX_COMMENT_DEPTH

        Args:
            comment: Reddit comment object
            comment_records: Dictionary to track processed comments
            depth: Current depth in the tree
            incremental: Whether to skip unchanged comments
            check_relevance: Whether to check keyword relevance (only for top-level)

        Returns:
            Comment data with nested replies or None if skipped
        """
        # Skip if we've reached maximum depth
        if depth > self.MAX_COMMENT_DEPTH:
            return None

        # Skip low-score comments (but be more lenient for replies to maintain context)
        min_score = self.MIN_COMMENT_SCORE if depth == 0 else self.MIN_COMMENT_SCORE - 3
        if comment.score < min_score:
            return None

        # Relevance checking logic based on configuration
        is_author_reply = self.ALWAYS_INCLUDE_AUTHOR and hasattr(comment, 'is_submitter') and comment.is_submitter

        # Skip non-relevant comments based on configuration
        if check_relevance and not is_author_reply:
            if depth == 0:
                # For top-level comments, always check relevance
                if not self._is_relevant(comment.body):
                    return None
            elif not self.PRESERVE_CONTEXT:
                # For nested comments, only check relevance if PRESERVE_CONTEXT is False
                if not self._is_relevant(comment.body):
                    return None
        # If PRESERVE_CONTEXT is True, include all nested replies regardless of keywords

        # Extract comment data
        comment_data = self._extract_comment_data(comment, depth)
        comment_hash = self._get_content_hash(comment_data)

        # Check if unchanged in incremental mode
        if incremental and comment.id in comment_records:
            if comment_records[comment.id]["hash"] == comment_hash:
                # Skip this comment and its replies if unchanged
                return None

        # Update record
        comment_records[comment.id] = {
            "hash": comment_hash,
            "depth": depth,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }

        # Fetch replies if not at maximum depth
        if depth < self.MAX_COMMENT_DEPTH and hasattr(comment, 'replies'):
            # Get limited number of replies
            replies = comment.replies[:self.MAX_REPLIES_PER_COMMENT]

            for reply in replies:
                if isinstance(reply, Comment):
                    # Recursively fetch reply tree
                    # Don't check relevance for nested replies to preserve context
                    reply_data = self._fetch_comment_tree(
                        reply,
                        comment_records,
                        depth + 1,
                        incremental,
                        check_relevance=False  # Include all replies for context
                    )
                    if reply_data:
                        comment_data["replies"].append(reply_data)

                    # Small delay to avoid rate limiting
                    time.sleep(0.1)

        return comment_data

    def crawl_subreddit(
        self,
        subreddit_name: str,
        days_back: int = 3,
        incremental: bool = True,
        min_score: int = 10
    ) -> List[Dict]:
        """
        Crawl a specific subreddit for posts and comments using Reddit's listing endpoints.

        CORE APPROACH: Browse-based discovery
        - Uses Reddit's native listing types (hot, new, rising, top) to discover content
        - Similar to browsing Reddit's homepage tabs
        - Captures organically popular and recent content
        - Ideal for general monitoring and trend detection

        Args:
            subreddit_name: Name of subreddit to crawl
            days_back: Number of days to look back
            incremental: Use incremental mode (stop when unchanged content found)
            min_score: Minimum score threshold for posts

        Returns:
            List of posts with embedded comments (hierarchical structure)
        """
        print(f"\nCrawling r/{subreddit_name}...")
        subreddit = self.reddit.subreddit(subreddit_name)

        # Calculate time threshold
        time_threshold = datetime.now(timezone.utc) - timedelta(days=days_back)
        time_threshold_unix = time_threshold.timestamp()

        collected_posts = []  # Will contain posts with embedded comments

        # Track subreddit-specific records
        post_records = self.record["posts"].setdefault(subreddit_name, {})
        comment_records = self.record["comments"].setdefault(subreddit_name, {})

        # Fetch posts from different Reddit listing categories
        for listing_type in ['hot', 'new', 'rising', 'top']:
            print(f"  Fetching {listing_type} posts...")

            try:
                # Check rate limit before making request
                if not self._check_rate_limit():
                    print("⚠️  Stopping due to rate limits")
                    break

                # Handle different listing types with appropriate parameters
                if listing_type == 'top':
                    # Fetch top posts from the past week with conservative limit
                    posts = subreddit.top(time_filter='week', limit=self.POSTS_PER_LISTING)
                else:
                    # For 'hot', 'new', 'rising' - use dynamic method invocation
                    listing_func = getattr(subreddit, listing_type)
                    posts = listing_func(limit=self.POSTS_PER_LISTING)

                post_count = 0
                for submission in posts:
                    # Periodic rate limit check during iteration
                    if post_count > 0 and post_count % self.RATE_CHECK_INTERVAL == 0:
                        if not self._check_rate_limit():
                            print(f"    Rate limit hit after {post_count} posts, stopping")
                            break
                    post_count += 1

                    # Skip old posts
                    if submission.created_utc < time_threshold_unix:
                        continue

                    # Skip low-score posts
                    if submission.score < min_score:
                        continue

                    # Check relevance by combining title and post body
                    full_text = f"{submission.title} {submission.selftext}"
                    if not self._is_relevant(full_text):
                        continue

                    # Extract post data
                    post_data = self._extract_post_data(submission)
                    post_hash = self._get_content_hash(post_data)

                    # Check if unchanged in incremental mode
                    if incremental and submission.id in post_records:
                        if post_records[submission.id]["hash"] == post_hash:
                            print(f"    Found unchanged post {submission.id}, stopping {listing_type}")
                            break

                    # Initialize comments list for this post
                    post_data["comments"] = []

                    # Fetch comment forest (tree structure) for this post
                    submission.comments.replace_more(limit=0)  # Remove MoreComments objects

                    # Process top-level comments and their nested replies
                    top_comments = submission.comments[:self.COMMENTS_PER_POST]

                    for comment in top_comments:
                        if isinstance(comment, Comment):
                            # Recursively fetch comment tree
                            comment_tree = self._fetch_comment_tree(
                                comment,
                                comment_records,
                                depth=0,
                                incremental=incremental
                            )
                            if comment_tree:
                                post_data["comments"].append(comment_tree)

                    # Update record and collect post with its comments
                    post_records[submission.id] = {
                        "hash": post_hash,
                        "last_seen": datetime.now(timezone.utc).isoformat()
                    }
                    collected_posts.append(post_data)

                    # Adaptive rate limiting based on post value and collection progress
                    if submission.score > self.HIGH_VALUE_POST_THRESHOLD or len(collected_posts) < self.MIN_COLLECTED_POSTS:
                        time.sleep(1.0)  # More delay for high-value content or initial posts
                    else:
                        time.sleep(0.5)  # Standard delay for regular content

            except (ResponseException, RequestException) as e:
                error_msg = str(e)
                if "401" in error_msg or "429" in error_msg or "rate limit" in error_msg.lower():
                    print(f"    🚫 Rate limit error fetching {listing_type}")
                    self._handle_rate_limit_error(e)
                    # Skip remaining listing types for this subreddit
                    break
                elif "403" in error_msg or "404" in error_msg:
                    print(f"    ⚠️  Access error for r/{subreddit_name}: {error_msg}")
                    break
                else:
                    print(f"    Error fetching {listing_type}: {error_msg}")
                continue
            except Exception as e:
                print(f"    Unexpected error fetching {listing_type}: {e}")
                continue

        # Update last crawl time
        self.record["last_crawl"][subreddit_name] = datetime.now(timezone.utc).isoformat()
        self._save_record()

        # Count total comments from nested hierarchical structure
        total_comments = sum(self._count_comments(post.get("comments", [])) for post in collected_posts)
        print(f"  Collected {len(collected_posts)} posts and {total_comments} comments (including nested)")
        return collected_posts

    def search_keywords(
        self,
        subreddit_name: str,
        days_back: int = 3,  # Note: Currently unused, kept for API consistency
        incremental: bool = True
    ) -> List[Dict]:
        """
        Search for specific keywords in a subreddit using Reddit's search API.

        CORE APPROACH: Targeted keyword search
        - Uses Reddit's search API with specific queries
        - Directly finds posts mentioning competitors/products
        - More efficient for competitor intelligence
        - Reduces noise by pre-filtering at API level

        Args:
            subreddit_name: Name of subreddit to search
            days_back: Number of days to look back
            incremental: Use incremental mode

        Returns:
            List of posts with embedded comments (hierarchical structure)
        """
        print(f"\nSearching keywords in r/{subreddit_name}...")
        subreddit = self.reddit.subreddit(subreddit_name)

        collected_posts = []

        post_records = self.record["posts"].setdefault(f"{subreddit_name}_search", {})
        comment_records = self.record["comments"].setdefault(f"{subreddit_name}_search", {})

        for keyword in self.keywords:
            print(f"  Searching for '{keyword}'...")

            try:
                # Check rate limit before search
                if not self._check_rate_limit():
                    print("⚠️  Stopping search due to rate limits")
                    break

                # Search posts with reduced limit
                for submission in subreddit.search(
                    query=keyword,
                    time_filter='week',
                    sort='relevance',
                    limit=self.SEARCH_LIMIT
                ):
                    post_data = self._extract_post_data(submission)
                    post_hash = self._get_content_hash(post_data)

                    # Check if already processed
                    if incremental and submission.id in post_records:
                        if post_records[submission.id]["hash"] == post_hash:
                            continue

                    # Initialize comments list for this post
                    post_data["comments"] = []

                    # Fetch comment forest for keyword search results
                    submission.comments.replace_more(limit=0)

                    # Process top-level comments with limited depth for search results
                    top_comments = submission.comments[:self.SEARCH_COMMENTS_LIMIT]

                    for comment in top_comments:
                        if isinstance(comment, Comment):
                            # Recursively fetch comment tree (with shallower depth for search)
                            original_depth = self.MAX_COMMENT_DEPTH
                            self.MAX_COMMENT_DEPTH = min(1, original_depth)  # Limit to 1 level for search

                            comment_tree = self._fetch_comment_tree(
                                comment,
                                comment_records,
                                depth=0,
                                incremental=incremental
                            )

                            # Restore original depth setting
                            self.MAX_COMMENT_DEPTH = original_depth

                            if comment_tree:
                                # Track keyword that found this comment
                                comment_tree["matched_keyword"] = keyword
                                post_data["comments"].append(comment_tree)

                    # Store post with its comments
                    post_records[submission.id] = {
                        "hash": post_hash,
                        "keyword": keyword,
                        "last_seen": datetime.now(timezone.utc).isoformat()
                    }
                    collected_posts.append(post_data)

                    time.sleep(1.0)  # Conservative rate limiting

            except (ResponseException, RequestException) as e:
                error_msg = str(e)
                if "401" in error_msg or "429" in error_msg or "rate limit" in error_msg.lower():
                    print(f"    🚫 Rate limit error searching '{keyword}'")
                    self._handle_rate_limit_error(e)
                    # Skip remaining keywords
                    break
                else:
                    print(f"    Error searching '{keyword}': {error_msg}")
                continue
            except Exception as e:
                print(f"    Unexpected error searching '{keyword}': {e}")
                continue

        self._save_record()

        # Count total comments from nested hierarchical structure
        total_comments = sum(self._count_comments(post.get("comments", [])) for post in collected_posts)
        print(f"  Found {len(collected_posts)} posts and {total_comments} comments (including nested)")
        return collected_posts

    def save_to_s3(self, data: Dict, key: str) -> bool:
        """
        Save crawled data to S3 bucket

        Args:
            data: Data to save
            key: S3 object key

        Returns:
            Success status
        """
        try:
            # Check if bucket exists
            try:
                s3.head_bucket(Bucket=self.s3_bucket)
            except ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == '404':
                    print(f"⚠️  S3 bucket '{self.s3_bucket}' does not exist")
                    return False
                elif error_code == '403':
                    print(f"⚠️  No permission to access S3 bucket '{self.s3_bucket}'")
                    return False

            s3.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=json.dumps(data, indent=2),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            print(f"⚠️  Error saving to S3: {e}")
            return False

    def run_full_crawl(
        self,
        incremental: bool = True,
        save_to_s3: bool = True,
        days_back: int = 3,
        min_score: int = 10,
        crawl_type: str = 'both'
    ) -> Dict:
        """
        Run full crawl across all configured subreddits

        Args:
            incremental: Use incremental mode
            save_to_s3: Save results to S3
            days_back: Number of days to look back
            min_score: Minimum score threshold for posts
            crawl_type: Type of crawl ('crawl', 'search', or 'both')

        Returns:
            Dictionary with all collected data
        """
        print(f"\n{'='*60}")
        print(f"Starting Reddit Legal Communities Crawl")
        print(f"Mode: {'Incremental' if incremental else 'Full'}")
        print(f"Subreddits: {', '.join(self.subreddits)}")
        print(f"Daily API usage: {self.rate_limit_data['daily_requests']}/{self.MAX_REQUESTS_PER_DAY}")
        print(f"{'='*60}")

        all_data = {
            "crawl_metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "mode": "incremental" if incremental else "full",
                "subreddits": self.subreddits,
                "keywords": self.keywords
            },
            "posts": []  # Posts now contain embedded comments
        }

        for subreddit_name in self.subreddits:
            # Regular crawl - returns posts with embedded comments
            if crawl_type in ['crawl', 'both']:
                posts = self.crawl_subreddit(
                    subreddit_name,
                    days_back=days_back,
                    incremental=incremental,
                    min_score=min_score
                )
                all_data["posts"].extend(posts)

            # Keyword search - returns posts with embedded comments
            if crawl_type in ['search', 'both']:
                search_posts = self.search_keywords(
                    subreddit_name,
                    days_back=days_back,
                    incremental=incremental
                )
                all_data["posts"].extend(search_posts)

            # Longer delay between subreddits to avoid rate limiting
            time.sleep(5)

        # Remove duplicate posts and merge comments
        posts_by_id = {}
        for post in all_data["posts"]:
            if post["id"] in posts_by_id:
                # Merge comments from duplicate posts
                existing_comments = posts_by_id[post["id"]].get("comments", [])
                new_comments = post.get("comments", [])
                # Merge unique comments by id
                comment_ids = {c["id"] for c in existing_comments}
                for comment in new_comments:
                    if comment["id"] not in comment_ids:
                        existing_comments.append(comment)
                        comment_ids.add(comment["id"])
            else:
                posts_by_id[post["id"]] = post
        unique_posts = list(posts_by_id.values())
        all_data["posts"] = unique_posts

        # Save final rate limit data
        self._save_rate_limit_data()

        # Count total comments from nested hierarchical structure
        total_comments = sum(self._count_comments(post.get("comments", [])) for post in all_data["posts"])

        print(f"\n{'='*60}")
        print(f"Crawl Complete!")
        print(f"Total unique posts: {len(all_data['posts'])}")
        print(f"Total unique comments: {total_comments}")
        print(f"Total API requests made: {self.request_count}")
        print(f"Daily API usage: {self.rate_limit_data['daily_requests']}/{self.MAX_REQUESTS_PER_DAY}")
        print(f"{'='*60}")

        # Save to S3 if enabled
        if save_to_s3:
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            s3_key = f"reddit/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/crawl_{timestamp}.json"

            if self.save_to_s3(all_data, s3_key):
                print(f"✓ Saved to S3: s3://{self.s3_bucket}/{s3_key}")
            else:
                print(f"⚠️  Failed to save to S3")

        return all_data


def handler(event, context):
    """
    Lambda handler for Reddit data collection
    Implements the complete RedditLegalCrawler functionality for serverless execution
    """
    print(f"Starting Reddit collection with event: {json.dumps(event)}")

    # Validate Reddit credentials from environment
    reddit_client_id = os.environ.get('REDDIT_CLIENT_ID')
    reddit_client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
    reddit_user_agent = os.environ.get('REDDIT_USER_AGENT', 'legal-crawler/1.0')
    bucket_name = os.environ.get('BUCKET_NAME')

    if not reddit_client_id or not reddit_client_secret:
        raise ValueError(
            "Reddit API credentials not configured. "
            "Please redeploy the stack with --context redditClientId=XXX --context redditClientSecret=YYY"
        )

    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable not set")

    # Configuration from event or defaults
    config = {
        'subreddits': event.get('subreddits', ['LawFirm', 'Lawyertalk', 'legaltech']),
        'keywords': event.get('keywords', [
            'Supio', 'Harvey', 'Casetext', 'Lexis+', 'Westlaw',
            'AI', 'automation', 'document review', 'contract analysis'
        ]),
        'days_back': event.get('days_back', 3),
        'min_score': event.get('min_score', 10),
        'incremental': event.get('incremental', True),  # Default to incremental for Lambda
        'crawl_type': event.get('crawl_type', 'both'),  # 'crawl', 'search', or 'both'
        'save_to_s3': event.get('save_to_s3', True)
    }

    try:
        # Initialize crawler with S3-based state persistence
        crawler = LambdaRedditCrawler(
            client_id=reddit_client_id,
            client_secret=reddit_client_secret,
            user_agent=reddit_user_agent,
            s3_bucket=bucket_name,
            record_key="state/reddit_crawl_record.json",
            rate_limit_key="state/reddit_rate_limit.json"
        )

        # Override default configuration with event parameters
        if config.get('subreddits'):
            crawler.subreddits = config['subreddits']
        if config.get('keywords'):
            crawler.keywords = config['keywords']

        # Use run_full_crawl to eliminate code duplication
        crawl_result = crawler.run_full_crawl(
            incremental=config['incremental'],
            save_to_s3=False,  # We'll handle S3 saving separately below
            days_back=config['days_back'],
            min_score=config['min_score'],
            crawl_type=config['crawl_type']
        )

        unique_posts = crawl_result["posts"]

        # Count total comments including nested
        total_comments = sum(crawler._count_comments(post.get("comments", [])) for post in unique_posts)

        # Prepare result data
        result_data = {
            'crawl_metadata': {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'lambda_request_id': context.aws_request_id,
                'config': config,
                'subreddits': crawler.subreddits,
                'keywords': crawler.keywords
            },
            'posts_count': len(unique_posts),
            'comments_count': total_comments,
            'api_requests_made': crawler.request_count,
            'daily_api_usage': f"{crawler.rate_limit_data['daily_requests']}/{crawler.MAX_REQUESTS_PER_DAY}",
            'posts': unique_posts
        }

        # Save to S3 if enabled
        s3_location = None
        if config['save_to_s3']:
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            s3_key = f"reddit/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}/crawl_{timestamp}.json"

            if crawler.save_to_s3(result_data, s3_key):
                s3_location = f"s3://{bucket_name}/{s3_key}"
                print(f"✓ Saved to S3: {s3_location}")
            else:
                print("⚠️  Failed to save to S3")

        print(f"Successfully collected {len(unique_posts)} posts and {total_comments} comments")

        # Analyze competitor mentions
        competitor_counts = {}
        for post in unique_posts:
            # Check post title and content
            text = f"{post['title']} {post['content']}"
            for competitor in ["Harvey", "Casetext", "Lexis", "Westlaw"]:
                if competitor.lower() in text.lower():
                    competitor_counts[competitor] = competitor_counts.get(competitor, 0) + 1

            # Also check comments within each post (including nested replies)
            def check_comments_for_competitors(comments_list):
                """Recursively check comments and replies for competitor mentions"""
                for comment in comments_list:
                    for competitor in ["Harvey", "Casetext", "Lexis", "Westlaw"]:
                        if competitor.lower() in comment.get("body", "").lower():
                            competitor_counts[competitor] = competitor_counts.get(competitor, 0) + 1
                    # Check nested replies
                    if "replies" in comment:
                        check_comments_for_competitors(comment["replies"])

            check_comments_for_competitors(post.get("comments", []))

        print("\nTop mentioned competitors:")
        for competitor, count in sorted(competitor_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {competitor}: {count} mentions")

        return {
            'statusCode': 200,
            'body': {
                'posts_collected': len(unique_posts),
                'comments_collected': total_comments,
                'api_requests_made': crawler.request_count,
                'daily_api_usage': f"{crawler.rate_limit_data['daily_requests']}/{crawler.MAX_REQUESTS_PER_DAY}",
                's3_location': s3_location,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'competitor_mentions': competitor_counts,
                'execution_summary': {
                    'subreddits_processed': len(crawler.subreddits),
                    'keywords_searched': len(crawler.keywords),
                    'crawl_type': config['crawl_type'],
                    'incremental_mode': config['incremental']
                }
            }
        }

    except Exception as e:
        print(f"Error in Reddit collection: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': {
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        }