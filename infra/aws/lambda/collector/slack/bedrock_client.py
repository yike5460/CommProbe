"""
Amazon Bedrock content analyzer for Slack messages.
Migrated from prototype with Lambda-specific adaptations.
"""

import json
import logging
import time
from typing import Dict, List, Any, Optional
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class BedrockContentAnalyzer:
    """
    AI-powered content analyzer using Amazon Bedrock with Claude models.
    Provides comprehensive analysis of Slack channel content and user profiles.
    """

    def __init__(self, region_name: str = 'us-west-2', model_id: Optional[str] = None):
        """
        Initialize Bedrock content analyzer.

        Args:
            region_name: AWS region for Bedrock
            model_id: Claude model ID (defaults to Sonnet 4.5)
        """
        # Configure client with extended timeout for long-running tasks
        config = Config(
            read_timeout=600,  # 10 minutes
            connect_timeout=60,
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )

        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=region_name,
            config=config
        )

        # Use latest Claude Sonnet 4.5 by default
        self.model_id = model_id or "us.anthropic.claude-sonnet-4-20250514-v1:0"
        logger.info(f"Initialized Bedrock analyzer with model: {self.model_id}")

    def _invoke_claude(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """
        Invoke Claude model via Bedrock with retry logic.

        Args:
            prompt: User prompt
            system_prompt: System prompt for context
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0-1.0)
            retry_count: Current retry attempt

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
            logger.info(f"Invoking Claude with {len(prompt)} chars prompt")
            response = self.bedrock_runtime.invoke_model(
                modelId=self.model_id,
                body=json.dumps(request_body)
            )

            response_body = json.loads(response['body'].read())

            tokens_used = response_body['usage']['input_tokens'] + response_body['usage']['output_tokens']
            logger.info(f"Claude response successful. Tokens used: {tokens_used}")

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

            # Retry on throttling
            if error_code == 'ThrottlingException' and retry_count < 3:
                wait_time = (2 ** retry_count) * 2  # Exponential backoff
                logger.warning(f"Throttled by Bedrock. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                return self._invoke_claude(prompt, system_prompt, max_tokens, temperature, retry_count + 1)

            logger.error(f"Bedrock error: {error_code} - {error_message}")
            return {
                'success': False,
                'error': f"{error_code}: {error_message}"
            }
        except Exception as e:
            logger.error(f"Unexpected error invoking Claude: {str(e)}")
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
                'tokens_used': 0,
                'input_tokens': 0,
                'output_tokens': 0
            }

        combined_content = "\n\n".join(all_texts[:100])  # Limit to first 100 items

        prompt = f"""Analyze {user_name}'s recent activity in the Slack channel #{channel_name} to provide a personal activity summary.

Content ({len(messages)} messages, {len(replies)} replies):
{combined_content}

Provide a friendly, personal activity summary:
1. **Activity Overview**: Summarize their participation level and engagement in this channel
2. **Topics Discussed**: What topics and subjects did they discuss?
3. **Personal Interests**: What personal interests or professional passions are evident?
4. **Collaboration Style**: How do they interact with team members?
5. **Key Contributions**: What valuable insights or help did they provide?
6. **Current Focus**: What are they currently working on or thinking about?

Write in a friendly, supportive tone that helps team members understand each other better. Format your response in clear sections with headers.

IMPORTANT: Do NOT use emojis in your response. Use plain text markdown formatting only."""

        system_prompt = "You are a friendly team collaboration assistant helping organization members understand each other's daily activities, interests, and contributions. Focus on personal growth, team dynamics, and mutual understanding rather than product management. Write in a warm, conversational tone. Do not use emojis or special characters."

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
        Analyze all content in a channel for product management insights.

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
                'tokens_used': 0,
                'input_tokens': 0,
                'output_tokens': 0
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

        prompt = f"""Provide a daily summary of conversations in the Slack channel #{channel_name}.

Messages (sample of {len(sampled_messages)} from {len(all_messages)} total):
{combined_content}

Provide a conversational daily digest:
1. **Channel Activity Overview**: Overall participation level and engagement in this period
2. **Main Discussion Topics**: What were the primary topics discussed?
3. **Interesting Highlights**: Notable conversations, insights, or memorable moments
4. **Active Participants**: Who contributed most to discussions?
5. **Helpful Content**: Useful information, tips, resources, or knowledge shared
6. **Team Mood**: What's the overall team sentiment and energy level?
7. **Ongoing Discussions**: Any topics that will continue or action items mentioned?

Write as a friendly daily digest that helps team members catch up on what they missed. Format your response with clear section headers and conversational language.

IMPORTANT: Do NOT use emojis in your response. Use plain text markdown formatting only (headers ##, bold **, bullets -, links []()), but no emoji characters."""

        system_prompt = "You are a friendly team collaboration assistant creating daily channel summaries. Focus on helping team members stay connected, catch up on discussions, and understand team dynamics. Write in a warm, conversational tone that makes people feel included and informed. Use plain text only - do not include emojis or special characters in your response."

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

        prompt = f"""Based on {user_name}'s recent activity across multiple Slack channels, create a friendly personal activity summary.

Activity Summary:
- Total Channels: {summary_stats.get('total_channels_joined', 0)}
- Active Channels: {summary_stats.get('active_channels', 0)}
- Total Messages: {summary_stats.get('total_messages', 0)}
- Total Replies: {summary_stats.get('total_replies', 0)}

Per-Channel Activities:
{combined_analyses}

Create a warm, personal activity summary:
1. **Activity Highlights**: What has {user_name} been up to recently? Summarize their main activities and contributions
2. **Areas of Interest**: What topics are they passionate about or actively exploring?
3. **Collaboration Highlights**: How have they helped or collaborated with teammates? Any notable interactions?
4. **Personal Growth**: What are they learning, exploring, or developing?
5. **Engagement Pattern**: When and where are they most active? What drives their participation?
6. **Team Connections**: Who do they interact with most frequently?
7. **Personal Summary**: Create a friendly 2-3 sentence description that captures their recent vibe, focus, and energy

Write as if you're a friendly colleague helping others understand what {user_name} is up to. Be specific, reference concrete examples, and maintain a supportive, appreciative tone.

IMPORTANT: Do NOT use emojis in your response. Use plain text markdown formatting only."""

        system_prompt = "You are a friendly team collaboration assistant helping organization members understand each other's daily activities and interests. Focus on building connections, celebrating contributions, and fostering team understanding. Write in a warm, personal tone that makes people feel valued and connected. Do not use emojis or special characters."

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
