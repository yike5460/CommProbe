# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CommProbe is a Legal Community Feedback Collector & Analyzer that monitors legal technology discussions across Reddit communities. It uses Reddit's API to collect posts and comments, analyzes them for insights about legal tech products (particularly Supio and competitors), and is designed to provide actionable intelligence for product management decisions.

## Development Commands

### Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Reddit API credentials:
# - REDDIT_CLIENT_ID
# - REDDIT_CLIENT_SECRET
# - REDDIT_USER_AGENT
# - AWS credentials (optional for S3 storage)
```

### Running the Crawler
```bash
# Run full crawl
python reddit_crawler.py

# Test comment depth functionality
python test_comment_depth.py
```

### Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov
```

### Type Checking
```bash
mypy reddit_crawler.py
```

## Architecture

### Core Components

1. **RedditLegalCrawler** (`reddit_crawler.py`): Main crawler class that:
   - Authenticates with Reddit API using PRAW
   - Crawls specified subreddits (r/legaltech, r/LawFirm, r/Lawyertalk)
   - Searches for keywords related to legal tech products
   - Implements rate limiting and incremental crawling
   - Stores data locally (JSON) and optionally to AWS S3

2. **Data Collection Strategy**:
   - Tracks already-seen posts/comments to avoid duplicates
   - Maintains rate limit tracking in `reddit_rate_limit.json`
   - Saves crawl records in `reddit_crawl_record.json`
   - Outputs full data to timestamped JSON files

3. **Key Methods**:
   - `crawl_subreddit()`: Fetches posts from hot/new/rising listings
   - `search_keywords()`: Searches subreddits for specific terms
   - `_fetch_comment_tree()`: Recursively fetches comment threads with depth tracking
   - `save_to_s3()`: Uploads results to AWS S3 (optional)
   - `run_full_crawl()`: Orchestrates the complete crawling process

## Important Context

### Rate Limiting
The crawler implements sophisticated rate limiting to respect Reddit's API limits:
- Tracks requests in 10-minute windows
- Automatically pauses when approaching limits
- Saves rate limit state between runs

### Data Schema
Posts and comments are extracted with full metadata including:
- Content, author, score, timestamp
- Subreddit and URL information
- Full comment trees with parent-child relationships
- Relevance scoring based on keyword matching

### Target Keywords
The system monitors mentions of:
- Legal tech products: Supio, Harvey, Casetext, Lexis+, Westlaw
- General topics: automation, AI lawyer, document review, contract analysis

### AWS Integration
When AWS credentials are configured, the crawler can automatically upload results to S3 for further processing in the data pipeline described in the README.

## Development Tips

- Always check rate limits before making large crawls
- Use incremental mode to avoid re-fetching known content
- Monitor `reddit_crawl_record.json` size - it tracks all seen content
- Test with small subreddit samples before full runs
- The crawler respects Reddit's terms of service by using proper authentication and rate limiting