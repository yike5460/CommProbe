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
