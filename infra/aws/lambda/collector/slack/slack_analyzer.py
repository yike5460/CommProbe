"""
Simplified Slack analyzer for Lambda environment.
Migrated from prototype with focus on core analysis functionality.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class SlackAnalyzer:
    """Simplified analyzer for Slack user and channel activities in Lambda environment."""

    def __init__(self, token: str, api_delay: float = 1.0):
        """
        Initialize the analyzer with Slack API token.

        Args:
            token: Slack Bot Token (xoxb-...)
            api_delay: Delay in seconds between API calls (default: 1.0)
        """
        self.client = WebClient(token=token)
        self.api_delay = api_delay
        self.rate_limit_retries = 5
        self.base_retry_delay = 2.0

        logger.info("Slack analyzer initialized")

    def _api_call_with_retry(self, api_func, *args, **kwargs):
        """Make an API call with exponential backoff retry on rate limits."""
        for attempt in range(self.rate_limit_retries):
            try:
                if attempt == 0:
                    time.sleep(self.api_delay)

                response = api_func(*args, **kwargs)
                return response

            except SlackApiError as e:
                error_msg = e.response.get('error', '')

                if error_msg == 'ratelimited':
                    retry_after = int(e.response.headers.get('Retry-After', self.base_retry_delay * (2 ** attempt)))
                    wait_time = min(retry_after, 60)
                    logger.warning(f"Rate limited. Waiting {wait_time}s (attempt {attempt + 1})")
                    time.sleep(wait_time)

                    if attempt == self.rate_limit_retries - 1:
                        raise
                else:
                    raise

        raise SlackApiError("Rate limit retries exhausted", response={'error': 'ratelimited'})

    def get_user_by_email(self, email: str) -> Optional[str]:
        """Get user ID from email address."""
        try:
            response = self._api_call_with_retry(self.client.users_lookupByEmail, email=email)
            return response['user']['id']
        except SlackApiError as e:
            logger.error(f"Error looking up user by email: {e.response['error']}")
            return None

    def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """Get basic user information."""
        try:
            response = self._api_call_with_retry(self.client.users_info, user=user_id)
            user = response['user']
            return {
                'id': user['id'],
                'name': user.get('real_name', user.get('name')),
                'email': user.get('profile', {}).get('email'),
                'display_name': user.get('profile', {}).get('display_name'),
                'is_bot': user.get('is_bot', False),
            }
        except SlackApiError as e:
            logger.error(f"Error getting user info: {e.response['error']}")
            return {}

    def get_user_channels(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all channels the user has joined."""
        channels = []
        try:
            cursor = None
            page_count = 0
            max_pages = 10  # Limit to prevent timeout

            logger.info(f"Fetching channels for user {user_id}")

            while page_count < max_pages:
                response = self._api_call_with_retry(
                    self.client.conversations_list,
                    types="public_channel,private_channel",
                    exclude_archived=True,
                    limit=1000,
                    cursor=cursor
                )

                logger.info(f"Checking {len(response['channels'])} channels for user membership (page {page_count + 1})")

                for channel in response['channels']:
                    try:
                        members_response = self._api_call_with_retry(
                            self.client.conversations_members,
                            channel=channel['id'],
                            limit=1000
                        )
                        if user_id in members_response['members']:
                            channels.append({
                                'id': channel['id'],
                                'name': channel['name'],
                                'is_private': channel.get('is_private', False),
                                'num_members': channel.get('num_members', 0)
                            })
                    except SlackApiError:
                        continue

                cursor = response.get('response_metadata', {}).get('next_cursor')
                page_count += 1
                if not cursor:
                    break

            logger.info(f"Found {len(channels)} channels for user {user_id}")

        except SlackApiError as e:
            logger.error(f"Error getting channels: {e.response['error']}")

        return channels

    def get_channel_info(self, channel_id: Optional[str] = None, channel_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get channel information by ID or name."""
        try:
            if channel_id:
                response = self._api_call_with_retry(self.client.conversations_info, channel=channel_id)
            elif channel_name:
                # Find channel by name with pagination (workspace may have 500+ channels)
                target_name = channel_name.lstrip('#')
                cursor = None
                found_channel_id = None
                page_count = 0
                max_pages = 10  # Limit to 10 pages (10k channels max) to prevent timeout

                logger.info(f"Searching for channel: {target_name}")

                while page_count < max_pages:
                    conversations = self._api_call_with_retry(
                        self.client.conversations_list,
                        types="public_channel,private_channel",
                        exclude_archived=True,
                        limit=1000,
                        cursor=cursor
                    )

                    logger.info(f"Checking {len(conversations['channels'])} channels (page {page_count + 1})")

                    for ch in conversations['channels']:
                        if ch['name'] == target_name:
                            found_channel_id = ch['id']
                            logger.info(f"Found channel #{target_name} with ID {found_channel_id}")
                            break

                    if found_channel_id:
                        break

                    cursor = conversations.get('response_metadata', {}).get('next_cursor')
                    page_count += 1
                    if not cursor:
                        break

                if not found_channel_id:
                    logger.error(f"Channel not found after checking {page_count} pages: {target_name}")
                    return None

                # Get full channel info
                response = self._api_call_with_retry(self.client.conversations_info, channel=found_channel_id)
            else:
                return None

            channel = response['channel']
            return {
                'id': channel['id'],
                'name': channel['name'],
                'is_private': channel.get('is_private', False),
                'num_members': channel.get('num_members', 0),
                'topic': channel.get('topic', {}).get('value', ''),
                'purpose': channel.get('purpose', {}).get('value', '')
            }

        except SlackApiError as e:
            logger.error(f"Error getting channel info: {e.response['error']}")
            return None

    def get_user_messages(self, user_id: str, channels: List[Dict[str, Any]], days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
        """Get user's messages in their channels."""
        oldest_timestamp = (datetime.utcnow() - timedelta(days=days)).timestamp()
        user_messages = {}

        for channel in channels:
            channel_id = channel['id']
            channel_name = channel['name']

            try:
                messages = []
                cursor = None
                page_count = 0
                max_pages = 10  # Limit to prevent timeout

                while page_count < max_pages:
                    response = self._api_call_with_retry(
                        self.client.conversations_history,
                        channel=channel_id,
                        oldest=str(oldest_timestamp),
                        limit=200,
                        cursor=cursor
                    )

                    for msg in response['messages']:
                        if msg.get('user') == user_id and msg.get('type') == 'message':
                            messages.append({
                                'ts': msg['ts'],
                                'text': msg.get('text', ''),
                                'timestamp': datetime.fromtimestamp(float(msg['ts'])).isoformat()
                            })

                    cursor = response.get('response_metadata', {}).get('next_cursor')
                    page_count += 1
                    if not cursor:
                        break

                if messages:
                    user_messages[channel_name] = messages
                    logger.info(f"Found {len(messages)} messages in #{channel_name}")

            except SlackApiError as e:
                logger.warning(f"Error getting messages from #{channel_name}: {e.response['error']}")

        return user_messages

    def get_channel_messages(self, channel_id: str, days: int = 30, max_messages: int = 500) -> List[Dict[str, Any]]:
        """Get all messages from a channel."""
        oldest_timestamp = (datetime.utcnow() - timedelta(days=days)).timestamp()
        all_messages = []

        try:
            cursor = None
            page_count = 0
            max_pages = 10

            while page_count < max_pages and len(all_messages) < max_messages:
                response = self._api_call_with_retry(
                    self.client.conversations_history,
                    channel=channel_id,
                    oldest=str(oldest_timestamp),
                    limit=200,
                    cursor=cursor
                )

                for msg in response['messages']:
                    if msg.get('type') == 'message' and not msg.get('subtype'):
                        all_messages.append({
                            'ts': msg['ts'],
                            'user': msg.get('user', 'unknown'),
                            'text': msg.get('text', ''),
                            'timestamp': datetime.fromtimestamp(float(msg['ts'])).isoformat()
                        })

                cursor = response.get('response_metadata', {}).get('next_cursor')
                page_count += 1
                if not cursor:
                    break

            logger.info(f"Retrieved {len(all_messages)} messages from channel")

        except SlackApiError as e:
            logger.error(f"Error getting channel messages: {e.response['error']}")

        return all_messages[:max_messages]

    def get_user_replies(self, user_id: str, channels: List[Dict[str, Any]], days: int = 30) -> Dict[str, List[Dict[str, Any]]]:
        """Get user's replies in threads."""
        oldest_timestamp = (datetime.utcnow() - timedelta(days=days)).timestamp()
        user_replies = {}

        for channel in channels[:10]:  # Limit channels to prevent timeout
            channel_id = channel['id']
            channel_name = channel['name']

            try:
                # Get threads with replies
                response = self._api_call_with_retry(
                    self.client.conversations_history,
                    channel=channel_id,
                    oldest=str(oldest_timestamp),
                    limit=100
                )

                replies = []
                for msg in response['messages']:
                    if msg.get('thread_ts'):
                        # Get thread replies
                        try:
                            thread_response = self._api_call_with_retry(
                                self.client.conversations_replies,
                                channel=channel_id,
                                ts=msg['thread_ts'],
                                limit=50
                            )

                            for reply in thread_response['messages'][1:]:  # Skip parent
                                if reply.get('user') == user_id:
                                    replies.append({
                                        'ts': reply['ts'],
                                        'text': reply.get('text', ''),
                                        'timestamp': datetime.fromtimestamp(float(reply['ts'])).isoformat()
                                    })
                        except SlackApiError:
                            continue

                if replies:
                    user_replies[channel_name] = replies
                    logger.info(f"Found {len(replies)} replies in #{channel_name}")

            except SlackApiError as e:
                logger.warning(f"Error getting replies from #{channel_name}: {e.response['error']}")

        return user_replies

    def calculate_influence_level(self, total_messages: int, total_replies: int, num_channels: int) -> str:
        """Calculate user's influence level based on activity metrics."""
        total_activity = total_messages + total_replies

        if total_activity > 100 and num_channels > 5:
            return 'high'
        elif total_activity > 30:
            return 'medium'
        else:
            return 'low'

    def determine_sentiment(self, ai_summary: str) -> str:
        """Extract sentiment from AI summary text (simple heuristic)."""
        summary_lower = ai_summary.lower()

        positive_indicators = ['positive', 'engaged', 'enthusiastic', 'satisfied', 'excited', 'supportive']
        negative_indicators = ['negative', 'frustrated', 'concerned', 'critical', 'disappointed', 'unhappy']

        positive_count = sum(1 for word in positive_indicators if word in summary_lower)
        negative_count = sum(1 for word in negative_indicators if word in summary_lower)

        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        else:
            return 'neutral'
