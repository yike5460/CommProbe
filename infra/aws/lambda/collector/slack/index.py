"""
Slack Collector Lambda - Main Handler
Analyzes Slack workspace data for user profiles and channel insights.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any

from slack_analyzer import SlackAnalyzer
from bedrock_client import BedrockContentAnalyzer
from data_storage import DataStorage
from models import (
    LambdaInput, LambdaOutput, SlackUserProfile, SlackChannelSummary,
    ChannelActivity, KeyContributor
)

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
SLACK_BOT_TOKEN = os.environ.get('SLACK_BOT_TOKEN', '')
BUCKET_NAME = os.environ.get('BUCKET_NAME', '')
SLACK_PROFILES_TABLE = os.environ.get('SLACK_PROFILES_TABLE', '')
AWS_BEDROCK_REGION = os.environ.get('AWS_BEDROCK_REGION', 'us-west-2')
MODEL_ID = os.environ.get('MODEL_ID', 'us.anthropic.claude-sonnet-4-20250514-v1:0')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for Slack analysis.

    Input event:
    {
        "analysis_type": "user|channel|workspace",
        "user_email": "user@example.com",  # For user analysis
        "user_id": "U123456789",  # Alternative to email
        "channel_name": "general",  # For channel analysis
        "channel_id": "C123456789",  # Alternative to name
        "days": 30,
        "workspace_id": "T123456789"
    }

    Returns:
    {
        "platform": "slack",
        "analysis_type": "user",
        "s3_location": "s3://...",
        "workspace_id": "T123456789",
        "status": "success",
        "metadata": {...}
    }
    """
    start_time = datetime.utcnow()
    logger.info(f"Slack Lambda invoked: {json.dumps(event)}")

    # Check if Slack is disabled
    if SLACK_BOT_TOKEN == 'DISABLED' or not SLACK_BOT_TOKEN:
        logger.warning("Slack integration disabled - SLACK_BOT_TOKEN not configured")
        return {
            'platform': 'slack',
            'status': 'disabled',
            'message': 'Slack integration is not configured'
        }

    try:
        # Validate and parse input
        lambda_input = LambdaInput(**event)

        # Initialize clients
        slack_analyzer = SlackAnalyzer(token=SLACK_BOT_TOKEN, api_delay=1.0)
        ai_analyzer = BedrockContentAnalyzer(region_name=AWS_BEDROCK_REGION, model_id=MODEL_ID)
        storage = DataStorage(bucket_name=BUCKET_NAME, table_name=SLACK_PROFILES_TABLE)

        # Route to appropriate handler
        if lambda_input.analysis_type == 'user':
            result = analyze_user(lambda_input, slack_analyzer, ai_analyzer, storage)
        elif lambda_input.analysis_type == 'channel':
            result = analyze_channel(lambda_input, slack_analyzer, ai_analyzer, storage)
        elif lambda_input.analysis_type == 'workspace':
            result = analyze_workspace(lambda_input, slack_analyzer, ai_analyzer, storage)
        else:
            raise ValueError(f"Invalid analysis_type: {lambda_input.analysis_type}")

        # Calculate duration
        duration = (datetime.utcnow() - start_time).total_seconds()
        result['metadata']['analysis_duration_seconds'] = int(duration)

        logger.info(f"Analysis completed successfully in {duration:.1f}s")
        return result

    except Exception as e:
        logger.error(f"Error in Slack Lambda: {str(e)}", exc_info=True)
        return {
            'platform': 'slack',
            'status': 'error',
            'error': str(e),
            'metadata': {}
        }


def analyze_user(
    lambda_input: LambdaInput,
    slack_analyzer: SlackAnalyzer,
    ai_analyzer: BedrockContentAnalyzer,
    storage: DataStorage
) -> Dict[str, Any]:
    """Analyze a specific Slack user's activity and interests."""
    logger.info("Starting user analysis")

    # Resolve user ID
    if lambda_input.user_email:
        user_id = slack_analyzer.get_user_by_email(lambda_input.user_email)
        if not user_id:
            raise ValueError(f"User not found with email: {lambda_input.user_email}")
    elif lambda_input.user_id:
        user_id = lambda_input.user_id
    else:
        raise ValueError("Either user_email or user_id is required")

    # Get user info
    user_info = slack_analyzer.get_user_info(user_id)
    logger.info(f"Analyzing user: {user_info.get('name', user_id)}")

    # Get user's channels
    channels = slack_analyzer.get_user_channels(user_id)
    logger.info(f"User is in {len(channels)} channels")

    # Get messages and replies
    user_messages = slack_analyzer.get_user_messages(user_id, channels, days=lambda_input.days)
    user_replies = slack_analyzer.get_user_replies(user_id, channels, days=lambda_input.days)

    # Calculate statistics
    total_messages = sum(len(msgs) for msgs in user_messages.values())
    total_replies = sum(len(replies) for replies in user_replies.values())
    active_channels = len([ch for ch in channels if ch['name'] in user_messages or ch['name'] in user_replies])

    logger.info(f"Found {total_messages} messages and {total_replies} replies across {active_channels} active channels")

    # Analyze each channel with AI
    channel_analyses = []
    total_ai_tokens = 0

    for channel in channels[:10]:  # Limit to top 10 to prevent timeout
        channel_name = channel['name']
        messages = user_messages.get(channel_name, [])
        replies = user_replies.get(channel_name, [])

        if messages or replies:
            logger.info(f"Analyzing channel #{channel_name} ({len(messages)} msgs, {len(replies)} replies)")

            ai_result = ai_analyzer.analyze_user_content(
                user_name=user_info.get('name', 'User'),
                channel_name=channel_name,
                messages=messages,
                replies=replies
            )

            if ai_result.get('success'):
                channel_analyses.append({
                    'channel_id': channel['id'],
                    'channel_name': channel_name,
                    'message_count': len(messages),
                    'reply_count': len(replies),
                    'last_activity': messages[-1]['timestamp'] if messages else replies[-1]['timestamp'] if replies else '',
                    'ai_summary': ai_result.get('analysis', ''),
                    'tokens_used': ai_result.get('tokens_used', 0)
                })
                total_ai_tokens += ai_result.get('tokens_used', 0)

    # Generate overall insights across all channels
    summary_stats = {
        'total_channels_joined': len(channels),
        'active_channels': active_channels,
        'total_messages': total_messages,
        'total_replies': total_replies
    }

    overall_result = ai_analyzer.generate_overall_insights(
        user_name=user_info.get('name', 'User'),
        channel_analyses=channel_analyses,
        summary_stats=summary_stats
    )

    if overall_result.get('success'):
        total_ai_tokens += overall_result.get('tokens_used', 0)

    # Extract structured data from AI insights (simplified parsing)
    ai_insights = overall_result.get('insights', '')

    # Build user profile
    user_profile = SlackUserProfile(
        user_id=user_id,
        workspace_id=lambda_input.workspace_id or 'default',
        user_email=user_info.get('email', ''),
        user_name=user_info.get('name', ''),
        display_name=user_info.get('display_name'),
        total_channels=len(channels),
        active_channels=active_channels,
        total_messages=total_messages,
        total_replies=total_replies,
        total_activity=total_messages + total_replies,
        analysis_date=datetime.utcnow().strftime('%Y-%m-%d'),
        analysis_period_days=lambda_input.days,
        interests=extract_list_from_text(ai_insights, 'interests', max_items=10),
        expertise_areas=extract_list_from_text(ai_insights, 'expertise', max_items=10),
        communication_style=extract_communication_style(ai_insights),
        key_opinions=extract_list_from_text(ai_insights, 'opinions', max_items=10),
        pain_points=extract_list_from_text(ai_insights, 'pain points', max_items=10),
        influence_level=slack_analyzer.calculate_influence_level(total_messages, total_replies, active_channels),
        channel_breakdown=[
            ChannelActivity(**ch) for ch in channel_analyses
        ],
        ai_insights=ai_insights,
        ai_persona_summary=extract_persona_summary(ai_insights),
        ai_tokens_used=total_ai_tokens,
        last_updated=int(datetime.utcnow().timestamp())
    )

    # Save to S3 (raw data)
    s3_location = storage.save_to_s3(
        data=user_profile.dict(),
        analysis_type='user',
        entity_id=user_id
    )

    # Save to DynamoDB (structured profile)
    storage.save_user_profile(user_profile)

    return {
        'platform': 'slack',
        'analysis_type': 'user',
        's3_location': s3_location,
        'workspace_id': lambda_input.workspace_id or 'default',
        'status': 'success',
        'metadata': {
            'user_id': user_id,
            'user_email': user_info.get('email', ''),
            'user_name': user_info.get('name', ''),
            'messages_analyzed': total_messages,
            'replies_analyzed': total_replies,
            'channels_analyzed': active_channels,
            'ai_tokens_used': total_ai_tokens
        }
    }


def analyze_channel(
    lambda_input: LambdaInput,
    slack_analyzer: SlackAnalyzer,
    ai_analyzer: BedrockContentAnalyzer,
    storage: DataStorage
) -> Dict[str, Any]:
    """Analyze a specific Slack channel for product insights."""
    logger.info("Starting channel analysis")

    # Get channel info
    channel_info = slack_analyzer.get_channel_info(
        channel_id=lambda_input.channel_id,
        channel_name=lambda_input.channel_name
    )

    if not channel_info:
        raise ValueError(f"Channel not found: {lambda_input.channel_name or lambda_input.channel_id}")

    channel_id = channel_info['id']
    channel_name = channel_info['name']
    logger.info(f"Analyzing channel: #{channel_name}")

    # Get channel messages
    messages = slack_analyzer.get_channel_messages(
        channel_id=channel_id,
        days=lambda_input.days,
        max_messages=500
    )

    logger.info(f"Retrieved {len(messages)} messages from #{channel_name}")

    # Analyze with AI
    ai_result = ai_analyzer.analyze_channel_content(
        channel_name=channel_name,
        all_messages=messages,
        max_messages=200
    )

    if not ai_result.get('success'):
        raise RuntimeError(f"AI analysis failed: {ai_result.get('error')}")

    ai_summary = ai_result.get('summary', '')
    tokens_used = ai_result.get('tokens_used', 0)

    # Extract structured insights from AI summary
    channel_summary = SlackChannelSummary(
        channel_id=channel_id,
        workspace_id=lambda_input.workspace_id or 'default',
        channel_name=channel_name,
        is_private=channel_info.get('is_private', False),
        num_members=channel_info.get('num_members', 0),
        analysis_date=datetime.utcnow().strftime('%Y-%m-%d'),
        analysis_period_days=lambda_input.days,
        messages_analyzed=len(messages),
        channel_purpose=channel_info.get('purpose', ''),
        key_topics=extract_list_from_text(ai_summary, 'topics', max_items=10),
        feature_requests=extract_list_from_text(ai_summary, 'feature requests', max_items=15),
        pain_points=extract_list_from_text(ai_summary, 'pain points', max_items=10),
        sentiment=slack_analyzer.determine_sentiment(ai_summary),
        key_contributors=extract_contributors(messages),
        product_opportunities=extract_list_from_text(ai_summary, 'opportunities', max_items=10),
        strategic_recommendations=extract_list_from_text(ai_summary, 'recommendations', max_items=10),
        ai_summary=ai_summary,
        ai_tokens_used=tokens_used,
        last_updated=int(datetime.utcnow().timestamp())
    )

    # Save to S3 (raw data)
    s3_location = storage.save_to_s3(
        data=channel_summary.dict(),
        analysis_type='channel',
        entity_id=channel_id
    )

    # Save to DynamoDB (structured summary)
    storage.save_channel_summary(channel_summary)

    return {
        'platform': 'slack',
        'analysis_type': 'channel',
        's3_location': s3_location,
        'workspace_id': lambda_input.workspace_id or 'default',
        'status': 'success',
        'metadata': {
            'channel_id': channel_id,
            'channel_name': channel_name,
            'messages_analyzed': len(messages),
            'ai_tokens_used': tokens_used
        }
    }


def analyze_workspace(
    lambda_input: LambdaInput,
    slack_analyzer: SlackAnalyzer,
    ai_analyzer: BedrockContentAnalyzer,
    storage: DataStorage
) -> Dict[str, Any]:
    """Analyze entire workspace (future implementation)."""
    logger.warning("Workspace analysis not yet implemented")
    return {
        'platform': 'slack',
        'analysis_type': 'workspace',
        'status': 'not_implemented',
        'message': 'Workspace-wide analysis coming soon',
        'metadata': {}
    }


# Helper functions for extracting structured data from AI text

def extract_list_from_text(text: str, keyword: str, max_items: int = 10) -> list:
    """Extract a list of items from AI-generated text based on keyword."""
    items = []
    lines = text.split('\n')

    # Look for section with keyword
    in_section = False
    for line in lines:
        if keyword.lower() in line.lower() and ('**' in line or '##' in line):
            in_section = True
            continue

        if in_section:
            # Stop at next section
            if line.strip().startswith('**') or line.strip().startswith('##'):
                break

            # Extract bullet points or numbered items
            cleaned = line.strip()
            if cleaned.startswith('-') or cleaned.startswith('•') or cleaned.startswith('*'):
                item = cleaned.lstrip('-•* ').strip()
                if item and len(items) < max_items:
                    items.append(item)
            elif cleaned and cleaned[0].isdigit() and '.' in cleaned[:3]:
                item = cleaned.split('.', 1)[1].strip()
                if item and len(items) < max_items:
                    items.append(item)

    # Fallback: return generic items if parsing failed
    if not items:
        items = [f"{keyword.title()} analysis in progress"]

    return items[:max_items]


def extract_communication_style(text: str) -> str:
    """Extract communication style description from AI text."""
    lines = text.split('\n')

    for i, line in enumerate(lines):
        if 'communication' in line.lower() and 'style' in line.lower():
            # Get next non-empty line
            for next_line in lines[i+1:i+5]:
                if next_line.strip() and not next_line.strip().startswith('#'):
                    return next_line.strip().lstrip('-•* ')

    return "Collaborative team member"


def extract_persona_summary(text: str) -> str:
    """Extract persona summary from AI text."""
    lines = text.split('\n')

    for i, line in enumerate(lines):
        if 'persona' in line.lower() or 'summary' in line.lower():
            # Get next paragraph
            summary_lines = []
            for next_line in lines[i+1:i+10]:
                if next_line.strip() and not next_line.strip().startswith('#'):
                    summary_lines.append(next_line.strip().lstrip('-•* '))
                if len(' '.join(summary_lines)) > 200:
                    break

            if summary_lines:
                return ' '.join(summary_lines)

    return "Engaged team member with diverse interests"


def extract_contributors(messages: list, top_n: int = 5) -> list:
    """Extract top contributors from message list."""
    from collections import Counter

    user_counts = Counter(msg['user'] for msg in messages if msg.get('user'))
    contributors = []

    for user_id, count in user_counts.most_common(top_n):
        # Determine contribution level
        if count > 50:
            level = 'high'
        elif count > 20:
            level = 'medium'
        else:
            level = 'low'

        contributors.append(
            KeyContributor(
                user_id=user_id,
                user_name=user_id,  # Would need additional lookup for real name
                contribution_level=level
            )
        )

    return contributors
