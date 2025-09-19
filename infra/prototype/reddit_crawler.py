#!/usr/bin/env python3
"""
Reddit Legal Communities Crawler
Collects posts and comments from legal-focused subreddits for product insights
Based on incremental crawling patterns from Highspot crawler
"""

import hashlib
import json
import os
import time
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
import praw
from praw.models import Submission, Comment
from prawcore.exceptions import ResponseException, RequestException
import boto3
from botocore.exceptions import ClientError


class RedditLegalCrawler:
    """Crawler for Reddit legal communities with incremental sync support and rate limiting"""
    
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
        record_file: str = "reddit_crawl_record.json",
        s3_bucket: str = "supio-raw-data",
        rate_limit_file: str = "reddit_rate_limit.json"
    ):
        """
        Initialize Reddit crawler with PRAW client and record keeping
        
        Args:
            client_id: Reddit API client ID
            client_secret: Reddit API client secret
            user_agent: User agent string for Reddit API
            record_file: JSON file to track crawled content
            s3_bucket: S3 bucket name for raw data storage
            rate_limit_file: JSON file to track API usage
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
        
        # Rate limiting tracking
        self.rate_limit_file = rate_limit_file
        self.rate_limit_data = self._load_rate_limit_data()
        self.request_count = 0
        self.last_request_time = time.time()
        self.backoff_until = 0  # Timestamp until which we should back off
        
        # Configuration
        self.subreddits = ["LawFirm", "Lawyertalk", "legaltech", "legaltechAI"]
        self.keywords = ["Supio", "Harvey", "Casetext", "Lexis+", "Westlaw", 
                        "AI", "automation", "document review", "contract analysis"]
        self.record_file = record_file
        self.s3_bucket = s3_bucket
        self.record = self._load_record()
        
        # Initialize S3 client
        try:
            self.s3_client = boto3.client('s3')
        except Exception as e:
            print(f"⚠️  Warning: Could not initialize S3 client: {e}")
            self.s3_client = None
        
    def _load_record(self) -> Dict:
        """Load or initialize the record file for tracking crawled content
        
        The reddit_crawl_record.json file structure:
        {
            "posts": {
                "subreddit_name": {
                    "post_id": {
                        "hash": "md5_hash",  # Content hash to detect changes
                        "last_seen": "ISO timestamp"  # When last crawled
                    }
                }
            },
            "comments": { ... similar structure ... },
            "last_crawl": {
                "subreddit_name": "ISO timestamp"  # Last successful crawl
            }
        }
        
        This file enables incremental crawling by tracking what content
        we've already seen and detecting when it changes.
        """
        try:
            with open(self.record_file, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "posts": {},      # Track posts by ID with hash
                "comments": {},   # Track comments by ID with hash
                "last_crawl": {}  # Track last crawl time per subreddit
            }
    
    def _load_rate_limit_data(self) -> Dict:
        """Load or initialize rate limit tracking data
        
        The reddit_rate_limit.json file structure:
        {
            "daily_requests": 0,      # Number of API requests made today
            "last_reset": "ISO timestamp",  # When daily counter was last reset
            "rate_limit_hits": 0      # How many rate limit errors today (for backoff)
        }
        
        This file persists rate limiting state across script runs to:
        - Prevent exceeding daily API limits (MAX_REQUESTS_PER_DAY)
        - Track rate limit errors for exponential backoff
        - Reset counters at day boundaries
        
        File is updated:
        - Every 10 API requests (via _check_rate_limit)
        - When rate limit errors occur (via _handle_rate_limit_error)
        - At end of crawl (via _save_rate_limit_data)
        """
        try:
            with open(self.rate_limit_file, "r") as f:
                data = json.load(f)
                # Reset daily counter if it's a new day
                last_reset = datetime.fromisoformat(data.get("last_reset", "2020-01-01"))
                if datetime.now(timezone.utc).date() > last_reset.date():
                    data["daily_requests"] = 0
                    data["last_reset"] = datetime.now(timezone.utc).isoformat()
                return data
        except FileNotFoundError:
            return {
                "daily_requests": 0,
                "last_reset": datetime.now(timezone.utc).isoformat(),
                "rate_limit_hits": 0
            }
    
    def _save_rate_limit_data(self):
        """Save rate limit tracking data"""
        with open(self.rate_limit_file, "w") as f:
            json.dump(self.rate_limit_data, f, indent=2)
    
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
        """Save the current record to file"""
        with open(self.record_file, "w") as f:
            json.dump(self.record, f, indent=2)
    
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
        
        KEY DIFFERENCES from search_keywords():
        1. DISCOVERY METHOD: Uses listing endpoints vs search API
        2. COVERAGE: Broader, captures all recent/popular content vs targeted keyword matches
        3. RELEVANCE: Filters by keywords after fetching vs pre-filtered by search
        4. API USAGE: More API calls (4 listing types) vs fewer targeted searches
        5. USE CASE: General monitoring vs specific competitor/feature tracking
        
        WORKFLOW:
        1. Iterate through listing types (hot, new, rising, top)
        2. Fetch posts from each listing (25 posts per listing)
        3. Filter by time threshold and keyword relevance
        4. Check hash for changes (incremental mode)
        5. Collect post data and fetch comments
        6. Stop early if unchanged content found (saves API calls)
        
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
        # Reddit API Documentation: https://praw.readthedocs.io/en/stable/code_overview/models/subreddit.html
        # Available listing types:
        # - 'hot': Currently popular posts based on upvotes and recency
        # - 'new': Most recent posts in chronological order
        # - 'rising': Posts gaining traction (increasing upvotes/engagement)
        # - 'top': Highest scoring posts (requires time_filter: hour/day/week/month/year/all)
        # - 'controversial': Most debated posts (high upvote+downvote ratio)
        # - 'gilded': Posts that received Reddit awards (not used here)
        for listing_type in ['hot', 'new', 'rising', 'top']:
            print(f"  Fetching {listing_type} posts...")
            
            try:
                # Check rate limit before making request
                if not self._check_rate_limit():
                    print("⚠️  Stopping due to rate limits")
                    break
                    
                # Handle different listing types with appropriate parameters
                # 'top' requires a time_filter parameter, while others don't
                if listing_type == 'top':
                    # Fetch top posts from the past week with conservative limit
                    posts = subreddit.top(time_filter='week', limit=self.POSTS_PER_LISTING)
                else:
                    # For 'hot', 'new', 'rising' - use dynamic method invocation
                    # getattr allows us to call subreddit.hot(), subreddit.new(), etc.
                    listing_func = getattr(subreddit, listing_type)
                    posts = listing_func(limit=self.POSTS_PER_LISTING)
                
                post_count = 0
                for submission in posts:
                    # Periodic rate limit check during iteration to prevent mid-crawl blocking
                    # Check every RATE_CHECK_INTERVAL posts (but not on the first post)
                    # This prevents hitting rate limits deep into a crawl session
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
                    
                    
                    # submission.selftext contains the full text body that the user wrote, while the link post may have an external URL
                    full_text = f"{submission.title} {submission.selftext}"
                    # Check relevance by combining title and post body: a post titled "Need legal tech advice" with body mentioning "considering Supio" would be caught, a post titled "Supio vs Harvey comparison" with empty body (link post) would also be caught
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
                    top_comments = submission.comments[:self.COMMENTS_PER_POST]  # Limit top-level comments
                    
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
                    # Store in reddit_crawl_record.json to track this post
                    post_records[submission.id] = {
                        "hash": post_hash,
                        "last_seen": datetime.now(timezone.utc).isoformat()
                    }
                    collected_posts.append(post_data)
                    
                    # Adaptive rate limiting based on post value and collection progress
                    # Apply longer delays for high-value posts or when starting collection
                    # This helps ensure we don't miss important content due to rate limits
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
        
        # Update last crawl time in reddit_crawl_record.json
        # This timestamp helps with monitoring and debugging crawl schedules
        self.record["last_crawl"][subreddit_name] = datetime.now(timezone.utc).isoformat()
        self._save_record()  # Persist to reddit_crawl_record.json
        
        # Count total comments from nested hierarchical structure
        def count_comments(comments_list):
            """Recursively count comments including nested replies"""
            count = len(comments_list)
            for comment in comments_list:
                if "replies" in comment:
                    count += count_comments(comment["replies"])
            return count
        
        total_comments = sum(count_comments(post.get("comments", [])) for post in collected_posts)
        print(f"  Collected {len(collected_posts)} posts and {total_comments} comments (including nested)")
        return collected_posts  # Returns posts with embedded comments
    
    def search_keywords(
        self,
        subreddit_name: str,
        days_back: int = 3,  # Note: Currently unused, kept for future time-based filtering
        incremental: bool = True
    ) -> List[Dict]:
        """
        Search for specific keywords in a subreddit using Reddit's search API.
        
        CORE APPROACH: Targeted keyword search
        - Uses Reddit's search API with specific queries
        - Directly finds posts mentioning competitors/products
        - More efficient for competitor intelligence
        - Reduces noise by pre-filtering at API level
        
        KEY DIFFERENCES from crawl_subreddit():
        1. DISCOVERY METHOD: Uses search API vs listing endpoints
        2. COVERAGE: Narrow, keyword-focused vs broad recent/popular content
        3. RELEVANCE: Pre-filtered by search vs post-fetch filtering
        4. API USAGE: Fewer calls (1 per keyword) vs multiple listing types
        5. USE CASE: Competitor tracking vs general monitoring
        
        WORKFLOW:
        1. Search for each keyword (Supio, Harvey, AI, etc.)
        2. Fetch search results (10 posts per keyword)
        3. Process each result (already relevant by search)
        4. Check post hash for changes (skip if unchanged)
        5. Fetch comments and filter by keyword relevance
        6. Track comment hashes for incremental sync
        7. No early stopping (each search is independent)
        
        LIMITATIONS:
        - Search API may miss some content
        - Limited to explicit keyword matches
        - Less discovery of emerging topics
        - May not capture all relevant discussions
        
        Args:
            subreddit_name: Name of subreddit to search
            days_back: Number of days to look back
            incremental: Use incremental mode
            
        Returns:
            List of posts with embedded comments (hierarchical structure)
        """
        print(f"\nSearching keywords in r/{subreddit_name}...")
        subreddit = self.reddit.subreddit(subreddit_name)
        
        collected_posts = []  # Will contain posts with embedded comments
        
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
                    limit=self.SEARCH_LIMIT  # Conservative limit for search API calls
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
                    # Use fewer comments and shallower depth for search to save API calls
                    top_comments = submission.comments[:self.SEARCH_COMMENTS_LIMIT]
                    
                    for comment in top_comments:
                        if isinstance(comment, Comment):
                            # Recursively fetch comment tree (with shallower depth for search)
                            # Override MAX_COMMENT_DEPTH with smaller value for search
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
        def count_comments(comments_list):
            """Recursively count comments including nested replies"""
            count = len(comments_list)
            for comment in comments_list:
                if "replies" in comment:
                    count += count_comments(comment["replies"])
            return count
        
        total_comments = sum(count_comments(post.get("comments", [])) for post in collected_posts)
        print(f"  Found {len(collected_posts)} posts and {total_comments} comments (including nested)")
        return collected_posts  # Returns posts with embedded comments
    
    def save_to_s3(self, data: Dict, key: str) -> bool:
        """
        Save crawled data to S3 bucket
        
        Args:
            data: Data to save
            key: S3 object key
            
        Returns:
            Success status
        """
        if not self.s3_client:
            print("⚠️  S3 client not initialized, skipping upload")
            return False
            
        try:
            # Check if bucket exists
            try:
                self.s3_client.head_bucket(Bucket=self.s3_bucket)
            except ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == '404':
                    print(f"⚠️  S3 bucket '{self.s3_bucket}' does not exist")
                    return False
                elif error_code == '403':
                    print(f"⚠️  No permission to access S3 bucket '{self.s3_bucket}'")
                    return False
                    
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=key,
                Body=json.dumps(data, indent=2),
                ContentType='application/json'
            )
            return True
        except Exception as e:
            print(f"⚠️  Error saving to S3: {e}")
            return False
    
    def run_full_crawl(self, incremental: bool = True, save_to_s3: bool = True) -> Dict:
        """
        Run full crawl across all configured subreddits
        
        Args:
            incremental: Use incremental mode
            save_to_s3: Save results to S3
            
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
            posts = self.crawl_subreddit(
                subreddit_name,
                days_back=3,
                incremental=incremental
            )
            all_data["posts"].extend(posts)
            
            # Keyword search - returns posts with embedded comments
            search_posts = self.search_keywords(
                subreddit_name,
                days_back=3,
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
        def count_comments(comments_list):
            """Recursively count comments including nested replies"""
            count = len(comments_list)
            for comment in comments_list:
                if "replies" in comment:
                    count += count_comments(comment["replies"])
            return count
        
        total_comments = sum(count_comments(post.get("comments", [])) for post in all_data["posts"])
        
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
                # Fallback to local file
                local_file = f"reddit_crawl_{timestamp}.json"
                with open(local_file, "w") as f:
                    json.dump(all_data, f, indent=2)
                print(f"✓ Saved locally: {local_file}")
        
        return all_data


def main():
    """Main execution function"""
    # Load credentials from environment or config
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Initialize crawler
    crawler = RedditLegalCrawler(
        client_id=os.getenv("REDDIT_CLIENT_ID", ""),
        client_secret=os.getenv("REDDIT_CLIENT_SECRET", ""),
        user_agent=os.getenv("REDDIT_USER_AGENT", "legal-crawler/1.0 by u/YOUR_USERNAME"),
        s3_bucket=os.getenv("S3_BUCKET", "supio-raw-data")
    )
    
    # Run incremental crawl
    results = crawler.run_full_crawl(incremental=True, save_to_s3=True)
    
    # Print summary
    print("\nTop mentioned competitors:")
    competitor_counts = {}
    for post in results["posts"]:
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
    
    for competitor, count in sorted(competitor_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {competitor}: {count} mentions")


if __name__ == "__main__":
    main()