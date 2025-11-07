#!/usr/bin/env python3
"""
Slack User Activity Analyzer - AI-Powered Product Manager Insights

Two powerful analysis modes designed for product managers and team leads:

MODE 1: CHANNEL ANALYSIS (Product Manager Focus)
- Analyze specific channels for product feedback, feature requests, and user sentiment
- Scan all channels for comprehensive workspace insights and communication patterns
- Identify pain points, opportunities, and recurring themes across conversations
- Understand channel dynamics, key contributors, and engagement patterns

MODE 2: USER ANALYSIS (Individual Engagement & Interests)
- Deep dive into specific user's interests, focus areas, and opinions
- Understand communication style, expertise domains, and contribution patterns
- Track engagement across channels to build comprehensive user profiles
- Identify opportunities for user development and team optimization

All analysis powered by Amazon Bedrock Claude Sonnet 4.5 for deep, contextual insights.

Usage:
    # Analyze specific channel for product insights
    python slack_user_analyzer.py --channel general

    # Scan all channels for comprehensive workspace analysis
    python slack_user_analyzer.py --all-channels

    # Analyze specific user's interests and opinions
    python slack_user_analyzer.py --user-email user@example.com

    # Analyze user by ID
    python slack_user_analyzer.py --user-id U123456789

    # Custom analysis period (default: 30 days)
    python slack_user_analyzer.py --channel general --days 60

    # Save to file
    python slack_user_analyzer.py --channel general --output analysis.json

    # Specify AWS region for Bedrock
    python slack_user_analyzer.py --channel general --aws-region us-east-1

    # Adjust API delay to avoid rate limits
    python slack_user_analyzer.py --user-email user@example.com --api-delay 2.0
"""

import os
import json
import argparse
import time
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Any, Optional

from dotenv import load_dotenv
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

# Load environment variables from .env.local file
load_dotenv('.env.local')

# AI Analysis with Bedrock (optional)
try:
    import boto3
    from botocore.exceptions import ClientError
    from botocore.config import Config
    BEDROCK_AVAILABLE = True
except ImportError:
    BEDROCK_AVAILABLE = False


class BedrockContentAnalyzer:
    """
    AI-powered content analyzer using Amazon Bedrock with Claude models.
    Provides comprehensive analysis of Slack channel content.
    """

    def __init__(self, region_name: str = 'us-west-2', model_id: str = None):
        """
        Initialize Bedrock content analyzer.

        Args:
            region_name: AWS region for Bedrock
            model_id: Claude model ID (defaults to Sonnet 4.5)
        """
        if not BEDROCK_AVAILABLE:
            raise ImportError("boto3 is required for AI analysis. Install: pip install boto3")

        # Configure client with extended timeout for long-running tasks
        config = Config(
            read_timeout=600,  # 10 minutes
            connect_timeout=60,
            retries={'max_attempts': 3}
        )

        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=region_name,
            config=config
        )

        # Use latest Claude Sonnet 4.5 by default
        self.model_id = model_id or "us.anthropic.claude-sonnet-4-20250514-v1:0"

    def _invoke_claude(
        self,
        prompt: str,
        system_prompt: str = None,
        max_tokens: int = 4096,
        temperature: float = 0.3
    ) -> Dict[str, Any]:
        """
        Invoke Claude model via Bedrock.

        Args:
            prompt: User prompt
            system_prompt: System prompt for context
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0-1.0)

        Returns:
            Dictionary with content, token usage, and metadata
        """
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                }
            ]
        }

        if system_prompt:
            request_body["system"] = system_prompt

        try:
            response = self.bedrock_runtime.invoke_model(
                modelId=self.model_id,
                body=json.dumps(request_body)
            )

            response_body = json.loads(response['body'].read())

            return {
                'success': True,
                'content': response_body['content'][0]['text'],
                'input_tokens': response_body['usage']['input_tokens'],
                'output_tokens': response_body['usage']['output_tokens'],
                'stop_reason': response_body.get('stop_reason'),
                'model_id': self.model_id
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            return {
                'success': False,
                'error': f"{error_code}: {error_message}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def analyze_user_content(
        self,
        user_name: str,
        channel_name: str,
        messages: List[Dict[str, Any]],
        replies: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Comprehensive AI analysis of a user's content in a specific channel.

        Args:
            user_name: Name of the user
            channel_name: Name of the channel
            messages: List of user's messages
            replies: List of user's replies

        Returns:
            AI-generated analysis with themes, sentiment, and insights
        """
        # Combine all content
        all_texts = []
        for msg in messages:
            all_texts.append(f"Message: {msg.get('text', '')}")
        for reply in replies:
            all_texts.append(f"Reply: {reply.get('text', '')}")

        if not all_texts:
            return {
                'success': True,
                'analysis': f"No content found for {user_name} in #{channel_name}",
                'tokens_used': 0
            }

        combined_content = "\n\n".join(all_texts[:100])  # Limit to first 100 items

        prompt = f"""Analyze {user_name}'s activity in the Slack channel #{channel_name} to understand their interests, focus areas, and opinions.

Content ({len(messages)} messages, {len(replies)} replies):
{combined_content}

Provide a comprehensive analysis:
1. **Core Interests**: What topics, products, or areas is this user most engaged with?
2. **Key Opinions**: What are their stated opinions, preferences, and viewpoints on important topics?
3. **Focus Areas**: What problems are they trying to solve? What are they working on?
4. **Expertise & Knowledge**: What domains do they demonstrate expertise in?
5. **Communication Style**: How do they engage (collaborative, directive, supportive, analytical)?
6. **Pain Points**: What challenges or frustrations do they express?
7. **Influence Level**: How do they influence discussions and decisions?

Format your response in clear sections with headers."""

        system_prompt = "You are an expert at understanding individual communication patterns and extracting personal interests, opinions, and focus areas from workplace conversations. Provide deep psychological and professional insights."

        result = self._invoke_claude(prompt, system_prompt, max_tokens=2048, temperature=0.3)

        if result['success']:
            return {
                'success': True,
                'analysis': result['content'],
                'tokens_used': result['input_tokens'] + result['output_tokens'],
                'input_tokens': result['input_tokens'],
                'output_tokens': result['output_tokens']
            }
        else:
            return result

    def analyze_channel_content(
        self,
        channel_name: str,
        all_messages: List[Dict[str, Any]],
        max_messages: int = 200
    ) -> Dict[str, Any]:
        """
        Analyze all content in a channel (not user-specific).

        Args:
            channel_name: Name of the channel
            all_messages: All messages in the channel
            max_messages: Maximum messages to analyze

        Returns:
            AI-generated channel summary and insights
        """
        if not all_messages:
            return {
                'success': True,
                'summary': f"No messages found in #{channel_name}",
                'tokens_used': 0
            }

        # Sample messages if too many
        sampled_messages = all_messages[:max_messages]

        # Format messages
        formatted_messages = []
        for msg in sampled_messages:
            timestamp = msg.get('timestamp', 'unknown')
            user = msg.get('user', 'unknown')
            text = msg.get('text', '')
            formatted_messages.append(f"[{timestamp}] {user}: {text}")

        combined_content = "\n".join(formatted_messages)

        prompt = f"""Analyze the Slack channel #{channel_name} for product management insights and strategic opportunities.

Messages (sample of {len(sampled_messages)} from {len(all_messages)} total):
{combined_content}

Provide a comprehensive product-focused analysis:
1. **Channel Purpose & Context**: What is this channel's role in the organization?
2. **Key Discussion Topics**: What are the primary themes? (prioritize product, feature, and user-related topics)
3. **User Feedback & Feature Requests**: What features, improvements, or capabilities are users requesting?
4. **Pain Points & Blockers**: What problems, frustrations, or obstacles are being discussed?
5. **Sentiment Analysis**: What's the overall mood and satisfaction level?
6. **Key Contributors & Influencers**: Who are the most active and influential participants?
7. **Product Opportunities**: What actionable opportunities exist for product improvements or new features?
8. **Strategic Recommendations**: What should product managers prioritize based on these conversations?

Format your response with clear section headers and bullet points for actionability."""

        system_prompt = "You are an expert product manager analyst specializing in extracting strategic insights from team communications. Focus on user needs, feature requests, pain points, and opportunities that inform product roadmaps."

        result = self._invoke_claude(prompt, system_prompt, max_tokens=3072, temperature=0.4)

        if result['success']:
            return {
                'success': True,
                'summary': result['content'],
                'messages_analyzed': len(sampled_messages),
                'total_messages': len(all_messages),
                'tokens_used': result['input_tokens'] + result['output_tokens'],
                'input_tokens': result['input_tokens'],
                'output_tokens': result['output_tokens']
            }
        else:
            return result

    def generate_overall_insights(
        self,
        user_name: str,
        channel_analyses: List[Dict[str, Any]],
        summary_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate overall insights across all channels for a user.

        Args:
            user_name: Name of the user
            channel_analyses: List of per-channel analyses
            summary_stats: Summary statistics

        Returns:
            Comprehensive cross-channel insights
        """
        # Build context from channel analyses
        analyses_text = []
        for i, analysis in enumerate(channel_analyses[:10], 1):  # Limit to top 10
            if analysis.get('success') and 'analysis' in analysis:
                channel_name = analysis.get('channel_name', f'Channel {i}')
                analyses_text.append(f"\n## {channel_name}\n{analysis['analysis']}")

        combined_analyses = "\n".join(analyses_text)

        prompt = f"""Based on {user_name}'s activity across multiple Slack channels, provide a comprehensive profile of their interests, opinions, and engagement patterns.

Activity Summary:
- Total Channels: {summary_stats.get('total_channels_joined', 0)}
- Active Channels: {summary_stats.get('active_channels', 0)}
- Total Messages: {summary_stats.get('total_messages', 0)}
- Total Replies: {summary_stats.get('total_replies', 0)}

Per-Channel Analyses:
{combined_analyses}

Provide a comprehensive cross-channel analysis:
1. **Overall Interests & Focus**: What are {user_name}'s primary interests and focus areas across all channels?
2. **Key Opinions & Viewpoints**: What consistent opinions, preferences, or viewpoints do they express?
3. **Expertise Profile**: What areas do they demonstrate expertise in? What knowledge do they share?
4. **Communication Patterns**: How do they communicate across different contexts and channels?
5. **Pain Points & Concerns**: What recurring challenges or frustrations do they express?
6. **Influence & Impact**: How do they influence conversations, decisions, and team direction?
7. **Engagement Style**: How do they choose to engage (when do they participate heavily vs. lightly)?
8. **User Persona Summary**: Create a concise persona that captures who this person is professionally

Be insightful, specific, and reference concrete examples from their activity."""

        system_prompt = "You are an expert at building deep user profiles from communication patterns. Focus on understanding the person's authentic interests, opinions, and professional identity across multiple contexts."

        result = self._invoke_claude(prompt, system_prompt, max_tokens=4096, temperature=0.3)

        if result['success']:
            return {
                'success': True,
                'insights': result['content'],
                'channels_analyzed': len(channel_analyses),
                'tokens_used': result['input_tokens'] + result['output_tokens'],
                'input_tokens': result['input_tokens'],
                'output_tokens': result['output_tokens']
            }
        else:
            return result


class SlackUserAnalyzer:
    """Lightweight analyzer for Slack user activities."""

    def __init__(self, token: str, api_delay: float = 1.0, aws_region: str = 'us-west-2'):
        """
        Initialize the analyzer with Slack API token.

        Args:
            token: Slack Bot Token (xoxb-...) or User Token
            api_delay: Delay in seconds between API calls (default: 1.0)
            aws_region: AWS region for Bedrock (default: us-west-2)
        """
        self.client = WebClient(token=token)
        self.user_id = None
        self.user_info = {}
        self.api_delay = api_delay
        self.rate_limit_retries = 5
        self.base_retry_delay = 2.0

        # Initialize AI analyzer (required)
        if not BEDROCK_AVAILABLE:
            raise ImportError(
                "boto3 is required for AI analysis. Install with: pip install boto3\n"
                "This tool requires AI analysis for all operations."
            )

        try:
            self.ai_analyzer = BedrockContentAnalyzer(region_name=aws_region)
            print(f"✓ AI analysis initialized using {self.ai_analyzer.model_id}")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize AI analyzer: {e}")

    def _api_call_with_retry(self, api_func, *args, **kwargs):
        """
        Make an API call with exponential backoff retry on rate limits.

        Args:
            api_func: The API function to call
            *args: Positional arguments for the API function
            **kwargs: Keyword arguments for the API function

        Returns:
            API response

        Raises:
            SlackApiError: If the error is not rate-limit related or retries exhausted
        """
        for attempt in range(self.rate_limit_retries):
            try:
                # Add delay between API calls to prevent rate limiting
                if attempt == 0:
                    time.sleep(self.api_delay)

                response = api_func(*args, **kwargs)
                return response

            except SlackApiError as e:
                error_msg = e.response.get('error', '')

                if error_msg == 'ratelimited':
                    retry_after = int(e.response.headers.get('Retry-After', self.base_retry_delay * (2 ** attempt)))
                    wait_time = min(retry_after, 60)  # Cap at 60 seconds

                    print(f"  Rate limited. Waiting {wait_time}s before retry (attempt {attempt + 1}/{self.rate_limit_retries})...")
                    time.sleep(wait_time)

                    if attempt == self.rate_limit_retries - 1:
                        print(f"  Rate limit retries exhausted for {api_func.__name__}")
                        raise
                else:
                    # Non-rate-limit error, raise immediately
                    raise

        raise SlackApiError("Rate limit retries exhausted", response={'error': 'ratelimited'})

    def get_user_by_email(self, email: str) -> Optional[str]:
        """
        Get user ID from email address.

        Args:
            email: User's email address

        Returns:
            User ID or None if not found
        """
        try:
            response = self._api_call_with_retry(self.client.users_lookupByEmail, email=email)
            return response['user']['id']
        except SlackApiError as e:
            print(f"Error looking up user by email: {e.response['error']}")
            return None

    def get_user_info(self, user_id: str) -> Dict[str, Any]:
        """
        Get basic user information.

        Args:
            user_id: Slack user ID

        Returns:
            Dictionary containing user information
        """
        try:
            response = self._api_call_with_retry(self.client.users_info, user=user_id)
            user = response['user']
            return {
                'id': user['id'],
                'name': user.get('real_name', user.get('name')),
                'email': user.get('profile', {}).get('email'),
                'display_name': user.get('profile', {}).get('display_name'),
                'is_bot': user.get('is_bot', False),
                'is_admin': user.get('is_admin', False),
                'timezone': user.get('tz', 'Unknown')
            }
        except SlackApiError as e:
            print(f"Error getting user info: {e.response['error']}")
            return {}

    def get_user_channels(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get all channels the user has joined.

        Args:
            user_id: Slack user ID

        Returns:
            List of channel information dictionaries
        """
        channels = []
        try:
            # Get public channels
            response = self._api_call_with_retry(
                self.client.conversations_list,
                types="public_channel,private_channel",
                exclude_archived=True,
                limit=1000
            )

            for channel in response['channels']:
                # Check if user is a member
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
                            'is_channel': channel.get('is_channel', True),
                            'num_members': channel.get('num_members', 0),
                            'created': channel.get('created', 0)
                        })
                except SlackApiError:
                    # Skip channels we can't access
                    continue

        except SlackApiError as e:
            print(f"Error getting channels: {e.response['error']}")

        return channels

    def get_user_messages(
        self,
        user_id: str,
        channels: List[Dict[str, Any]],
        days: int = 30
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get user's messages (posts) in their channels.

        Args:
            user_id: Slack user ID
            channels: List of channel dictionaries
            days: Number of days to look back

        Returns:
            Dictionary mapping channel IDs to lists of messages
        """
        oldest_timestamp = (datetime.now() - timedelta(days=days)).timestamp()
        channel_messages = defaultdict(list)

        for idx, channel in enumerate(channels, 1):
            channel_id = channel['id']
            channel_name = channel.get('name', channel_id)
            print(f"  [{idx}/{len(channels)}] Checking messages in #{channel_name}...", end='\r')

            try:
                response = self._api_call_with_retry(
                    self.client.conversations_history,
                    channel=channel_id,
                    oldest=str(oldest_timestamp),
                    limit=1000
                )

                for message in response['messages']:
                    # Filter for user's messages only
                    if message.get('user') == user_id and message.get('type') == 'message':
                        # Skip threaded replies (they'll be counted separately)
                        if 'thread_ts' not in message or message.get('thread_ts') == message.get('ts'):
                            channel_messages[channel_id].append({
                                'ts': message['ts'],
                                'text': message.get('text', ''),
                                'timestamp': datetime.fromtimestamp(
                                    float(message['ts'])
                                ).isoformat(),
                                'reply_count': message.get('reply_count', 0),
                                'reaction_count': len(message.get('reactions', []))
                            })

            except SlackApiError as e:
                print(f"\n  Error getting messages for #{channel_name}: {e.response['error']}")
                continue

        print()  # New line after progress
        return dict(channel_messages)

    def get_user_replies(
        self,
        user_id: str,
        channels: List[Dict[str, Any]],
        days: int = 30,
        max_threads_per_channel: int = 50
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get user's replies in threads.

        Args:
            user_id: Slack user ID
            channels: List of channel dictionaries
            days: Number of days to look back
            max_threads_per_channel: Maximum threads to check per channel (default: 50)

        Returns:
            Dictionary mapping channel IDs to lists of replies
        """
        oldest_timestamp = (datetime.now() - timedelta(days=days)).timestamp()
        channel_replies = defaultdict(list)

        total_threads_checked = 0

        for idx, channel in enumerate(channels, 1):
            channel_id = channel['id']
            channel_name = channel.get('name', channel_id)
            print(f"  [{idx}/{len(channels)}] Checking replies in #{channel_name}...", end='\r')

            try:
                # First get all messages to find threads
                response = self._api_call_with_retry(
                    self.client.conversations_history,
                    channel=channel_id,
                    oldest=str(oldest_timestamp),
                    limit=1000
                )

                # Look for messages with replies (limit to avoid excessive API calls)
                messages_with_replies = [msg for msg in response['messages']
                                        if msg.get('reply_count', 0) > 0]

                threads_to_check = messages_with_replies[:max_threads_per_channel]

                for thread_idx, message in enumerate(threads_to_check, 1):
                    thread_ts = message['ts']

                    # Show progress for this channel
                    print(f"  [{idx}/{len(channels)}] #{channel_name}: checking thread {thread_idx}/{len(threads_to_check)}...", end='\r')

                    # Get thread replies
                    thread_response = self._api_call_with_retry(
                        self.client.conversations_replies,
                        channel=channel_id,
                        ts=thread_ts
                    )

                    # Filter for user's replies (excluding the parent message)
                    for reply in thread_response['messages'][1:]:
                        if reply.get('user') == user_id:
                            channel_replies[channel_id].append({
                                'ts': reply['ts'],
                                'thread_ts': thread_ts,
                                'text': reply.get('text', ''),
                                'timestamp': datetime.fromtimestamp(
                                    float(reply['ts'])
                                ).isoformat(),
                                'reaction_count': len(reply.get('reactions', []))
                            })

                    total_threads_checked += 1

            except SlackApiError as e:
                print(f"\n  Error getting replies for #{channel_name}: {e.response['error']}")
                continue

        print(f"\n  Checked {total_threads_checked} threads total")
        return dict(channel_replies)

    def get_user_reactions(
        self,
        user_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get reactions given by the user.

        Note: This requires user token scope or reactions:read scope.
        The Slack API doesn't provide a direct way to get all reactions by a user,
        so this is a simplified implementation.

        Args:
            user_id: Slack user ID
            days: Number of days to look back

        Returns:
            List of reaction information
        """
        # Note: Getting user reactions requires iterating through messages
        # This is a placeholder for the full implementation
        # In production, you'd need to scan messages and check reactions
        reactions = []

        print("Note: Comprehensive reaction tracking requires scanning all channel messages.")
        print("This is a simplified implementation. For full tracking, consider using")
        print("Slack's Events API to capture reactions in real-time.")

        return reactions

    def get_all_channel_messages(
        self,
        channel_id: str,
        days: int = 30,
        limit: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Get all messages in a channel (from all users) for channel-wide analysis.

        Args:
            channel_id: Channel ID
            days: Number of days to look back
            limit: Maximum number of messages to fetch

        Returns:
            List of messages with user info
        """
        oldest_timestamp = (datetime.now() - timedelta(days=days)).timestamp()
        messages = []

        try:
            response = self._api_call_with_retry(
                self.client.conversations_history,
                channel=channel_id,
                oldest=str(oldest_timestamp),
                limit=limit
            )

            for message in response['messages']:
                if message.get('type') == 'message' and not message.get('subtype'):
                    messages.append({
                        'user': message.get('user', 'unknown'),
                        'text': message.get('text', ''),
                        'timestamp': datetime.fromtimestamp(float(message['ts'])).isoformat(),
                        'ts': message['ts'],
                        'reply_count': message.get('reply_count', 0)
                    })

        except SlackApiError as e:
            print(f"Error getting all messages for channel {channel_id}: {e.response['error']}")

        return messages

    def analyze_channel_content(
        self,
        channel_id: str,
        channel_name: str,
        messages: List[Dict[str, Any]],
        replies: List[Dict[str, Any]],
        user_name: str
    ) -> Dict[str, Any]:
        """
        Analyze content for a specific channel using AI.

        Args:
            channel_id: Channel ID
            channel_name: Channel name
            messages: List of user's messages in the channel
            replies: List of user's replies in the channel
            user_name: User name

        Returns:
            Dictionary containing AI-powered channel analysis
        """
        base_result = {
            'channel_id': channel_id,
            'channel_name': channel_name,
            'message_count': len(messages),
            'reply_count': len(replies),
            'total_activity': len(messages) + len(replies)
        }

        if not messages and not replies:
            return {
                **base_result,
                'analysis': f'No activity found for {user_name} in #{channel_name}',
                'analysis_type': 'none'
            }

        print(f"    Running AI analysis for #{channel_name}...")
        ai_result = self.ai_analyzer.analyze_user_content(
            user_name=user_name,
            channel_name=channel_name,
            messages=messages,
            replies=replies
        )

        if ai_result.get('success'):
            return {
                **base_result,
                'analysis_type': 'ai',
                'analysis': ai_result['analysis'],
                'ai_tokens_used': ai_result.get('tokens_used', 0),
                'ai_input_tokens': ai_result.get('input_tokens', 0),
                'ai_output_tokens': ai_result.get('output_tokens', 0)
            }
        else:
            return {
                **base_result,
                'analysis_type': 'error',
                'error': ai_result.get('error', 'Unknown error during AI analysis')
            }

    def generate_overall_summary(
        self,
        channels: List[Dict[str, Any]],
        messages: Dict[str, List[Dict[str, Any]]],
        replies: Dict[str, List[Dict[str, Any]]],
        channel_analyses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate overall summary statistics across all channels.

        Args:
            channels: List of channel information
            messages: Dictionary of messages by channel
            replies: Dictionary of replies by channel
            channel_analyses: List of per-channel analyses

        Returns:
            Dictionary containing overall summary statistics
        """
        total_messages = sum(len(msgs) for msgs in messages.values())
        total_replies = sum(len(reps) for reps in replies.values())
        total_activity = total_messages + total_replies

        # Get top channels by activity
        sorted_analyses = sorted(channel_analyses, key=lambda x: x['total_activity'], reverse=True)
        top_channels = sorted_analyses[:10] if sorted_analyses else []

        # Calculate activity distribution
        active_channels = [ch for ch in channel_analyses if ch['total_activity'] > 0]
        inactive_channels = len(channels) - len(active_channels)

        # Engagement metrics
        avg_messages_per_channel = total_messages / len(channels) if channels else 0
        avg_replies_per_channel = total_replies / len(channels) if channels else 0

        return {
            'total_channels_joined': len(channels),
            'active_channels': len(active_channels),
            'inactive_channels': inactive_channels,
            'total_messages': total_messages,
            'total_replies': total_replies,
            'total_activity': total_activity,
            'avg_messages_per_channel': round(avg_messages_per_channel, 2),
            'avg_replies_per_channel': round(avg_replies_per_channel, 2),
            'top_channels_by_activity': [
                {
                    'channel_name': ch['channel_name'],
                    'total_activity': ch['total_activity'],
                    'message_count': ch['message_count'],
                    'reply_count': ch['reply_count']
                }
                for ch in top_channels
            ],
            'engagement_summary': {
                'highly_active_channels': len([ch for ch in active_channels if ch['total_activity'] >= 10]),
                'moderately_active_channels': len([ch for ch in active_channels if 3 <= ch['total_activity'] < 10]),
                'low_activity_channels': len([ch for ch in active_channels if 0 < ch['total_activity'] < 3])
            }
        }

    def calculate_channel_preferences(
        self,
        messages: Dict[str, List[Dict[str, Any]]],
        replies: Dict[str, List[Dict[str, Any]]],
        channels: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate channel preferences based on activity.

        Args:
            messages: Dictionary of channel messages
            replies: Dictionary of channel replies
            channels: List of channel information

        Returns:
            List of channels sorted by activity level
        """
        channel_map = {ch['id']: ch for ch in channels}
        preferences = []

        for channel_id in set(list(messages.keys()) + list(replies.keys())):
            if channel_id not in channel_map:
                continue

            channel = channel_map[channel_id]
            message_count = len(messages.get(channel_id, []))
            reply_count = len(replies.get(channel_id, []))
            total_activity = message_count + reply_count

            preferences.append({
                'channel_id': channel_id,
                'channel_name': channel['name'],
                'is_private': channel['is_private'],
                'message_count': message_count,
                'reply_count': reply_count,
                'total_activity': total_activity,
                'activity_score': total_activity  # Can be enhanced with weighting
            })

        # Sort by activity score (descending)
        preferences.sort(key=lambda x: x['activity_score'], reverse=True)

        return preferences

    def analyze_user(
        self,
        user_identifier: str,
        is_email: bool = False,
        days: int = 30,
        max_threads_per_channel: int = 50
    ) -> Dict[str, Any]:
        """
        Run complete AI-powered analysis for a user to understand their interests,
        opinions, and engagement patterns.

        Args:
            user_identifier: User ID or email
            is_email: Whether the identifier is an email address
            days: Number of days to analyze
            max_threads_per_channel: Max threads to check per channel (default: 50)

        Returns:
            Complete AI-powered analysis results including interests and opinions
        """
        # Get user ID
        if is_email:
            user_id = self.get_user_by_email(user_identifier)
            if not user_id:
                return {'error': 'User not found'}
        else:
            user_id = user_identifier

        print(f"Analyzing user: {user_id}")

        # Get user info
        print("Fetching user information...")
        user_info = self.get_user_info(user_id)

        # Get channels
        print("Fetching user's channels...")
        channels = self.get_user_channels(user_id)
        print(f"Found {len(channels)} channels")

        # Get messages
        print(f"Fetching messages from last {days} days...")
        messages = self.get_user_messages(user_id, channels, days)
        total_messages = sum(len(msgs) for msgs in messages.values())
        print(f"Found {total_messages} messages")

        # Get replies
        print(f"Fetching replies from last {days} days (max {max_threads_per_channel} threads/channel)...")
        replies = self.get_user_replies(user_id, channels, days, max_threads_per_channel)
        total_replies = sum(len(reps) for reps in replies.values())
        print(f"Found {total_replies} replies")

        # Get reactions (simplified)
        print("Fetching reactions...")
        reactions = self.get_user_reactions(user_id, days)

        # Calculate preferences
        print("Calculating channel preferences...")
        preferences = self.calculate_channel_preferences(messages, replies, channels)

        # Perform AI-powered content analysis
        print("Analyzing channel content with AI...")
        channel_analyses = []
        channel_map = {ch['id']: ch for ch in channels}
        user_display_name = user_info.get('name', 'User')

        for channel_id in set(list(messages.keys()) + list(replies.keys())):
            if channel_id in channel_map:
                channel = channel_map[channel_id]
                analysis = self.analyze_channel_content(
                    channel_id,
                    channel['name'],
                    messages.get(channel_id, []),
                    replies.get(channel_id, []),
                    user_name=user_display_name
                )
                channel_analyses.append(analysis)

        print("Generating overall summary...")
        overall_summary = self.generate_overall_summary(
            channels, messages, replies, channel_analyses
        )

        # Generate AI-powered overall insights
        if channel_analyses:
            print("Generating AI-powered overall insights...")
            summary_stats = {
                'total_channels_joined': len(channels),
                'active_channels': len([ch for ch in channel_analyses if ch.get('total_activity', 0) > 0]),
                'total_messages': total_messages,
                'total_replies': total_replies
            }

            ai_insights = self.ai_analyzer.generate_overall_insights(
                user_name=user_display_name,
                channel_analyses=channel_analyses,
                summary_stats=summary_stats
            )

            if ai_insights.get('success'):
                overall_summary['ai_insights'] = ai_insights['insights']
                overall_summary['ai_insights_tokens'] = ai_insights.get('tokens_used', 0)

        # Compile results
        total_ai_tokens = sum(
            ch.get('ai_tokens_used', 0) for ch in channel_analyses
        ) + overall_summary.get('ai_insights_tokens', 0)

        results = {
            'analysis_date': datetime.now().isoformat(),
            'analysis_period_days': days,
            'user': user_info,
            'summary': {
                'total_channels': len(channels),
                'total_messages': total_messages,
                'total_replies': total_replies,
                'total_reactions_given': len(reactions),
                'most_active_channel': preferences[0]['channel_name'] if preferences else None,
                'active_channels_count': len([p for p in preferences if p['total_activity'] > 0])
            },
            'channels': channels,
            'channel_preferences': preferences,
            'messages_by_channel': messages,
            'replies_by_channel': replies,
            'reactions': reactions,
            'ai_analysis': {
                'per_channel': channel_analyses,
                'overall_summary': overall_summary
            },
            'ai_usage': {
                'model': self.ai_analyzer.model_id,
                'total_tokens_used': total_ai_tokens,
                'channels_analyzed': len([ch for ch in channel_analyses if ch.get('analysis_type') == 'ai'])
            }
        }

        return results

    def list_accessible_channels(self) -> List[Dict[str, Any]]:
        """
        List all channels accessible to the bot.

        Returns:
            List of channel information dictionaries
        """
        try:
            response = self._api_call_with_retry(
                self.client.conversations_list,
                types="public_channel,private_channel",
                exclude_archived=True,
                limit=1000
            )
            return response['channels']
        except SlackApiError as e:
            print(f"Error listing channels: {e.response['error']}")
            return []

    def analyze_channel_overall(
        self,
        channel_name: str = None,
        channel_id: str = None,
        days: int = 30,
        max_messages: int = 200
    ) -> Dict[str, Any]:
        """
        Analyze an entire channel (all users) for product management insights.
        Provides deep AI-powered analysis of channel purpose, key topics, user feedback,
        pain points, and strategic recommendations.

        Args:
            channel_name: Channel name (e.g., 'general')
            channel_id: Channel ID (alternative to channel_name)
            days: Number of days to analyze
            max_messages: Maximum messages to analyze

        Returns:
            AI-powered comprehensive channel analysis for product managers
        """
        # Find channel by name or ID
        if channel_name:
            print(f"Finding channel #{channel_name}...")
            try:
                # Fetch all channels with pagination
                all_channels = []
                cursor = None

                while True:
                    response = self._api_call_with_retry(
                        self.client.conversations_list,
                        types="public_channel,private_channel",
                        exclude_archived=True,
                        limit=1000,
                        cursor=cursor
                    )

                    all_channels.extend(response['channels'])

                    cursor = response.get('response_metadata', {}).get('next_cursor')
                    if not cursor:
                        break

                channel_id = None
                available_channels = []
                for channel in all_channels:
                    available_channels.append(channel['name'])
                    if channel['name'] == channel_name:
                        channel_id = channel['id']
                        break

                if not channel_id:
                    # Provide helpful error message
                    error_msg = f"Channel #{channel_name} not found in {len(available_channels)} channels.\n\n"
                    error_msg += "Possible causes:\n\n"
                    error_msg += "1. ARCHIVED CHANNEL (Most Common for Public Channels)\n"
                    error_msg += "   • Archived channels are excluded from results\n"
                    error_msg += "   • Check if the channel is archived in Slack\n\n"
                    error_msg += "2. PRIVATE CHANNEL (Not Invited)\n"
                    error_msg += "   • Private channels are invisible until bot is invited\n"
                    error_msg += "   • Go to #{channel_name} and type: /invite @YourBotName\n\n"
                    error_msg += "3. TYPO IN CHANNEL NAME\n"
                    error_msg += "   • Check spelling carefully\n"
                    error_msg += "   • Use --list-channels to see exact names\n\n"
                    error_msg += "4. DM OR GROUP DM\n"
                    error_msg += "   • Only public and private channels are supported\n\n"
                    error_msg += f"Similar channel names found:\n"

                    # Find similar channel names
                    similar = [ch for ch in available_channels if channel_name.lower() in ch.lower() or ch.lower() in channel_name.lower()]
                    if similar:
                        for ch_name in sorted(similar)[:10]:
                            error_msg += f"  • {ch_name}\n"
                    else:
                        # Show first 20 channels
                        for ch_name in sorted(available_channels)[:20]:
                            error_msg += f"  • {ch_name}\n"
                        if len(available_channels) > 20:
                            error_msg += f"  ... and {len(available_channels) - 20} more\n"

                    error_msg += f"\n💡 Run with --list-channels to see all {len(available_channels)} accessible channels"

                    return {'error': error_msg}

            except SlackApiError as e:
                return {'error': f"Error finding channel: {e.response['error']}"}

        elif not channel_id:
            return {'error': 'Either channel_name or channel_id is required'}

        # Get channel info
        try:
            channel_info_response = self._api_call_with_retry(
                self.client.conversations_info,
                channel=channel_id
            )
            channel_info = channel_info_response['channel']
            channel_name = channel_info['name']
        except SlackApiError as e:
            return {'error': f"Error getting channel info: {e.response['error']}"}

        print(f"Analyzing channel #{channel_name} (all users)...")

        # Get all messages in the channel
        print(f"Fetching up to {max_messages} messages from last {days} days...")
        all_messages = self.get_all_channel_messages(channel_id, days, max_messages)
        print(f"Found {len(all_messages)} messages")

        # Run AI-powered channel analysis
        print("Running AI-powered channel analysis...")
        ai_result = self.ai_analyzer.analyze_channel_content(
            channel_name=channel_name,
            all_messages=all_messages,
            max_messages=max_messages
        )

        return {
            'analysis_date': datetime.now().isoformat(),
            'analysis_period_days': days,
            'channel': {
                'id': channel_id,
                'name': channel_name,
                'is_private': channel_info.get('is_private', False),
                'num_members': channel_info.get('num_members', 0)
            },
            'message_count': len(all_messages),
            'analysis': ai_result.get('summary') if ai_result.get('success') else ai_result.get('error'),
            'messages_analyzed': ai_result.get('messages_analyzed', 0),
            'ai_usage': {
                'model': self.ai_analyzer.model_id,
                'tokens_used': ai_result.get('tokens_used', 0)
            }
        }

    def analyze_all_channels(
        self,
        days: int = 30,
        max_messages_per_channel: int = 100,
        max_channels: int = 20
    ) -> Dict[str, Any]:
        """
        Scan all accessible channels in the workspace for comprehensive product insights.
        Provides strategic overview of communication patterns, themes, and opportunities
        across the entire organization.

        Args:
            days: Number of days to analyze
            max_messages_per_channel: Maximum messages to analyze per channel
            max_channels: Maximum number of channels to analyze (most active first)

        Returns:
            Comprehensive workspace analysis with per-channel insights
        """
        print("Scanning workspace for all accessible channels...")

        # Get all channels with pagination
        try:
            all_channels = []
            cursor = None
            page = 0

            while True:
                page += 1
                print(f"  Fetching channels (page {page})...", end='\r')

                response = self._api_call_with_retry(
                    self.client.conversations_list,
                    types="public_channel,private_channel",
                    exclude_archived=True,
                    limit=1000,
                    cursor=cursor
                )

                all_channels.extend(response['channels'])

                cursor = response.get('response_metadata', {}).get('next_cursor')
                if not cursor:
                    break

            print(f"Found {len(all_channels)} channels{' '*30}")
        except SlackApiError as e:
            return {'error': f"Error fetching channels: {e.response['error']}"}

        # Sort channels by member count (proxy for importance)
        sorted_channels = sorted(
            all_channels,
            key=lambda ch: ch.get('num_members', 0),
            reverse=True
        )[:max_channels]

        print(f"Analyzing top {len(sorted_channels)} channels by member count...")

        channel_analyses = []
        total_messages = 0
        total_tokens = 0

        for idx, channel in enumerate(sorted_channels, 1):
            channel_id = channel['id']
            channel_name = channel['name']

            print(f"\n[{idx}/{len(sorted_channels)}] Analyzing #{channel_name}...")

            # Get messages for this channel
            messages = self.get_all_channel_messages(
                channel_id,
                days=days,
                limit=max_messages_per_channel
            )

            if not messages:
                print(f"  No messages found in #{channel_name}, skipping...")
                continue

            print(f"  Found {len(messages)} messages, running AI analysis...")

            # Run AI analysis
            ai_result = self.ai_analyzer.analyze_channel_content(
                channel_name=channel_name,
                all_messages=messages,
                max_messages=max_messages_per_channel
            )

            if ai_result.get('success'):
                channel_analyses.append({
                    'channel_id': channel_id,
                    'channel_name': channel_name,
                    'is_private': channel.get('is_private', False),
                    'num_members': channel.get('num_members', 0),
                    'messages_analyzed': len(messages),
                    'analysis': ai_result.get('summary', ''),
                    'tokens_used': ai_result.get('tokens_used', 0)
                })
                total_messages += len(messages)
                total_tokens += ai_result.get('tokens_used', 0)
            else:
                print(f"  AI analysis failed: {ai_result.get('error')}")

        # Generate cross-channel insights
        print("\n\nGenerating cross-channel strategic insights...")

        # Compile all analyses for meta-analysis
        all_analyses_text = []
        for analysis in channel_analyses[:15]:  # Top 15 for meta-analysis
            all_analyses_text.append(
                f"## #{analysis['channel_name']} ({analysis['num_members']} members)\n{analysis['analysis']}"
            )

        combined_analyses = "\n\n".join(all_analyses_text)

        # Generate strategic overview
        meta_prompt = f"""Analyze these Slack channels to provide strategic product management insights across the entire workspace.

Channels Analyzed ({len(channel_analyses)} total, showing top {len(all_analyses_text)}):

{combined_analyses}

Provide a comprehensive strategic analysis:
1. **Workspace Overview**: What is the overall health and activity level of this workspace?
2. **Cross-Channel Themes**: What common themes, topics, or concerns appear across multiple channels?
3. **Product Opportunities**: What product features, improvements, or new capabilities are being requested?
4. **Key Pain Points**: What are the most critical problems or frustrations across the organization?
5. **User Sentiment**: What's the overall mood and satisfaction level?
6. **Communication Patterns**: How does information flow? Are there silos or bottlenecks?
7. **Strategic Priorities**: Based on all channel activity, what should product managers prioritize?
8. **Risk Areas**: Are there any concerning patterns, conflicts, or issues that need attention?

Be strategic, actionable, and prioritize insights that inform product roadmap decisions."""

        system_prompt = "You are a senior product strategist analyzing organizational communication to inform executive product decisions. Focus on high-level patterns, strategic opportunities, and actionable recommendations."

        meta_result = self.ai_analyzer._invoke_claude(
            meta_prompt,
            system_prompt,
            max_tokens=4096,
            temperature=0.4
        )

        strategic_insights = ""
        meta_tokens = 0

        if meta_result.get('success'):
            strategic_insights = meta_result['content']
            meta_tokens = meta_result.get('input_tokens', 0) + meta_result.get('output_tokens', 0)
            total_tokens += meta_tokens

        # Compile results
        return {
            'analysis_date': datetime.now().isoformat(),
            'analysis_period_days': days,
            'workspace_summary': {
                'total_channels_analyzed': len(channel_analyses),
                'total_messages_analyzed': total_messages,
                'channels_requested': max_channels,
                'messages_per_channel_limit': max_messages_per_channel
            },
            'strategic_insights': strategic_insights,
            'channel_analyses': channel_analyses,
            'ai_usage': {
                'model': self.ai_analyzer.model_id,
                'total_tokens_used': total_tokens,
                'meta_analysis_tokens': meta_tokens
            }
        }


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description='AI-Powered Slack Analyzer for Product Managers',
        epilog="""
Examples:
  # Analyze specific channel for product insights
  python slack_user_analyzer.py --channel general

  # Scan all channels for comprehensive workspace analysis
  python slack_user_analyzer.py --all-channels

  # Analyze specific user's interests and opinions
  python slack_user_analyzer.py --user-email user@example.com

  # Analyze user by ID
  python slack_user_analyzer.py --user-id U123456789
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Authentication
    parser.add_argument(
        '--token',
        type=str,
        help='Slack API token (or set SLACK_BOT_TOKEN env variable)',
        default=os.environ.get('SLACK_BOT_TOKEN')
    )

    # Mode selection (mutually exclusive groups)
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        '--user-email',
        type=str,
        help='MODE 2: Analyze specific user by email to understand interests and opinions'
    )
    mode_group.add_argument(
        '--user-id',
        type=str,
        help='MODE 2: Analyze specific user by ID (alternative to --user-email)'
    )
    mode_group.add_argument(
        '--channel',
        type=str,
        help='MODE 1: Analyze specific channel for product management insights'
    )
    mode_group.add_argument(
        '--all-channels',
        action='store_true',
        help='MODE 1: Scan all workspace channels for comprehensive strategic insights'
    )
    mode_group.add_argument(
        '--list-channels',
        action='store_true',
        help='List all channels accessible to the bot (for debugging)'
    )

    # Common options
    parser.add_argument(
        '--days',
        type=int,
        default=30,
        help='Number of days to analyze (default: 30)'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output JSON file path (default: prints to stdout)'
    )
    parser.add_argument(
        '--api-delay',
        type=float,
        default=1.0,
        help='Delay in seconds between API calls to avoid rate limits (default: 1.0)'
    )
    parser.add_argument(
        '--aws-region',
        type=str,
        default='us-west-2',
        help='AWS region for Bedrock (default: us-west-2)'
    )

    # Advanced options for user analysis
    parser.add_argument(
        '--max-threads',
        type=int,
        default=50,
        help='For user analysis: Maximum threads to check per channel (default: 50)'
    )

    # Advanced options for all-channels analysis
    parser.add_argument(
        '--max-channels',
        type=int,
        default=20,
        help='For --all-channels: Maximum channels to analyze (default: 20)'
    )
    parser.add_argument(
        '--max-messages',
        type=int,
        default=100,
        help='For channel analysis: Maximum messages per channel (default: 100 for --all-channels, 200 for --channel)'
    )

    args = parser.parse_args()

    # Validate inputs
    if not args.token:
        print("Error: Slack token required. Use --token or set SLACK_BOT_TOKEN environment variable.")
        print("You can set it in .env.local file as SLACK_BOT_TOKEN=xoxb-...")
        return 1

    # Handle list-channels mode separately (doesn't require AI)
    if args.list_channels:
        print(f"\nListing accessible channels...")
        try:
            # Initialize without AI for listing
            from slack_sdk import WebClient
            client = WebClient(token=args.token)

            # Get bot's own user ID
            auth_response = client.auth_test()
            bot_user_id = auth_response['user_id']

            # Fetch ALL channels with pagination
            channels = []
            cursor = None
            page = 0

            print("Fetching all channels (this may take a moment for large workspaces)...")

            while True:
                page += 1
                print(f"  Fetching page {page}...", end='\r')

                response = client.conversations_list(
                    types="public_channel,private_channel",
                    exclude_archived=True,
                    limit=1000,
                    cursor=cursor
                )

                channels.extend(response['channels'])

                cursor = response.get('response_metadata', {}).get('next_cursor')
                if not cursor:
                    break

            print(f"  Fetched {len(channels)} channels total.{' '*20}")

            print(f"\n{'='*80}")
            print(f"CHANNEL ACCESS REPORT")
            print(f"{'='*80}\n")
            print(f"Bot User ID: {bot_user_id}\n")

            # Check membership for each channel
            channels_with_membership = []
            print("Checking channel membership... (this may take a moment)")

            for ch in channels:
                try:
                    # Check if bot is a member
                    members_response = client.conversations_members(channel=ch['id'], limit=1000)
                    is_member = bot_user_id in members_response['members']

                    channels_with_membership.append({
                        'name': ch['name'],
                        'id': ch['id'],
                        'is_private': ch.get('is_private', False),
                        'num_members': ch.get('num_members', 0),
                        'is_member': is_member
                    })
                except Exception:
                    # Can't check membership (likely no access)
                    channels_with_membership.append({
                        'name': ch['name'],
                        'id': ch['id'],
                        'is_private': ch.get('is_private', False),
                        'num_members': ch.get('num_members', 0),
                        'is_member': False
                    })

            # Group by membership and type
            member_public = [ch for ch in channels_with_membership if ch['is_member'] and not ch['is_private']]
            member_private = [ch for ch in channels_with_membership if ch['is_member'] and ch['is_private']]
            not_member_public = [ch for ch in channels_with_membership if not ch['is_member'] and not ch['is_private']]
            not_member_private = [ch for ch in channels_with_membership if not ch['is_member'] and ch['is_private']]

            print(f"\n{'='*80}")
            print(f"✓ CHANNELS BOT CAN ANALYZE ({len(member_public) + len(member_private)} total)")
            print(f"{'='*80}\n")

            if member_public:
                print(f"✓ Public Channels - Bot is Member ({len(member_public)}):")
                for ch in sorted(member_public, key=lambda x: x['name']):
                    print(f"  • {ch['name']} (Members: {ch['num_members']})")

            if member_private:
                print(f"\n✓ Private Channels - Bot is Member ({len(member_private)}):")
                for ch in sorted(member_private, key=lambda x: x['name']):
                    print(f"  • {ch['name']} (Members: {ch['num_members']})")

            print(f"\n{'='*80}")
            print(f"✗ CHANNELS BOT CANNOT ANALYZE ({len(not_member_public) + len(not_member_private)} total)")
            print(f"{'='*80}\n")

            if not_member_public:
                print(f"✗ Public Channels - Bot NOT Member ({len(not_member_public)}):")
                print(f"   → Invite bot with: /invite @YourBotName\n")
                for ch in sorted(not_member_public, key=lambda x: x['name']):
                    print(f"  • {ch['name']} (Members: {ch['num_members']})")

            if not_member_private:
                print(f"\n✗ Private Channels - Bot NOT Member ({len(not_member_private)}):")
                print(f"   → Invite bot with: /invite @YourBotName\n")
                for ch in sorted(not_member_private, key=lambda x: x['name']):
                    print(f"  • {ch['name']} (Members: {ch['num_members']})")

            print(f"\n{'='*80}")
            print(f"SUMMARY")
            print(f"{'='*80}")
            print(f"Total channels visible to bot: {len(channels_with_membership)}")
            print(f"  • Public channels: {len(member_public) + len(not_member_public)}")
            print(f"  • Private channels (bot is member): {len(member_private) + len(not_member_private)}")
            print(f"\nBot can analyze: {len(member_public) + len(member_private)}")
            print(f"Bot needs invitation: {len(not_member_public) + len(not_member_private)}")
            print(f"\n{'='*80}")
            print(f"IMPORTANT: Private channels are INVISIBLE until you invite the bot!")
            print(f"{'='*80}")
            print(f"If a channel you're looking for doesn't appear above:")
            print(f"  1. It's likely a PRIVATE channel")
            print(f"  2. Go to that channel in Slack")
            print(f"  3. Type: /invite @YourBotName")
            print(f"  4. Run --list-channels again to see it")
            print(f"{'='*80}\n")

            return 0

        except Exception as e:
            print(f"Error listing channels: {e}")
            import traceback
            traceback.print_exc()
            return 1

    # Initialize analyzer
    print(f"\nInitializing Slack Analyzer...")
    print(f"AWS Region: {args.aws_region}")
    print(f"Analysis Period: {args.days} days\n")

    try:
        analyzer = SlackUserAnalyzer(
            token=args.token,
            api_delay=args.api_delay,
            aws_region=args.aws_region
        )
    except Exception as e:
        print(f"Error initializing analyzer: {e}")
        return 1

    # Determine mode and run analysis
    try:
        if args.all_channels:
            # MODE 1a: Scan all channels
            print("=" * 80)
            print("MODE 1: COMPREHENSIVE WORKSPACE ANALYSIS")
            print("=" * 80)
            results = analyzer.analyze_all_channels(
                days=args.days,
                max_messages_per_channel=args.max_messages,
                max_channels=args.max_channels
            )

        elif args.channel:
            # MODE 1b: Analyze specific channel
            print("=" * 80)
            print(f"MODE 1: CHANNEL ANALYSIS - #{args.channel}")
            print("=" * 80)
            max_msgs = args.max_messages if args.max_messages != 100 else 200  # Default 200 for single channel
            results = analyzer.analyze_channel_overall(
                channel_name=args.channel,
                days=args.days,
                max_messages=max_msgs
            )

        elif args.user_email or args.user_id:
            # MODE 2: Analyze specific user
            user_identifier = args.user_email or args.user_id
            print("=" * 80)
            print(f"MODE 2: USER ANALYSIS - {user_identifier}")
            print("=" * 80)
            results = analyzer.analyze_user(
                user_identifier,
                is_email=bool(args.user_email),
                days=args.days,
                max_threads_per_channel=args.max_threads
            )

        else:
            print("Error: Please specify --channel, --all-channels, --user-email, or --user-id")
            return 1

    except KeyboardInterrupt:
        print("\n\nAnalysis interrupted by user.")
        return 1
    except Exception as e:
        print(f"\nError during analysis: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Output results
    if 'error' in results:
        print(f"\n{'='*80}")
        print(f"ERROR: {results['error']}")
        print(f"{'='*80}")
        return 1

    # Format output
    output_json = json.dumps(results, indent=2)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(output_json)
        print(f"\n{'='*80}")
        print(f"ANALYSIS COMPLETE!")
        print(f"{'='*80}")
        print(f"Results saved to: {args.output}")

        # Print summary
        if 'ai_usage' in results:
            print(f"\nAI Usage:")
            print(f"  Model: {results['ai_usage'].get('model', 'unknown')}")
            print(f"  Total Tokens: {results['ai_usage'].get('total_tokens_used', 0):,}")

        if 'workspace_summary' in results:
            print(f"\nWorkspace Summary:")
            print(f"  Channels Analyzed: {results['workspace_summary'].get('total_channels_analyzed', 0)}")
            print(f"  Messages Analyzed: {results['workspace_summary'].get('total_messages_analyzed', 0):,}")
        elif 'summary' in results:
            print(f"\nUser Summary:")
            print(f"  Channels: {results['summary'].get('total_channels', 0)}")
            print(f"  Messages: {results['summary'].get('total_messages', 0)}")
            print(f"  Replies: {results['summary'].get('total_replies', 0)}")
        elif 'channel' in results:
            print(f"\nChannel Summary:")
            print(f"  Channel: #{results['channel'].get('name', 'unknown')}")
            print(f"  Messages Analyzed: {results.get('messages_analyzed', 0)}")

    else:
        print("\n" + "="*80)
        print("ANALYSIS RESULTS")
        print("="*80)
        print(output_json)
        print("\n" + "="*80)

    return 0


if __name__ == '__main__':
    exit(main())
