"""
Pydantic data models for Slack analysis Lambda function.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


class ChannelActivity(BaseModel):
    """Activity breakdown for a single channel."""
    channel_id: str
    channel_name: str
    message_count: int
    reply_count: int
    last_activity: str
    ai_summary: str


class SlackUserProfile(BaseModel):
    """Complete user profile from Slack analysis."""
    user_id: str
    workspace_id: str
    user_email: str
    user_name: str
    display_name: Optional[str] = None
    total_channels: int
    active_channels: int
    total_messages: int
    total_replies: int
    total_activity: int
    analysis_date: str
    analysis_period_days: int
    interests: List[str]
    expertise_areas: List[str]
    communication_style: str
    key_opinions: List[str]
    pain_points: List[str]
    influence_level: Literal['high', 'medium', 'low']
    channel_breakdown: List[ChannelActivity]
    ai_insights: str
    ai_persona_summary: str
    ai_tokens_used: int
    last_updated: int
    # New activity-focused fields
    engagement_score: Optional[float] = None  # Calculated: activity / time_period
    activity_trend: Optional[Literal['increasing', 'stable', 'decreasing']] = None
    most_active_time: Optional[str] = None  # e.g., "9-11 AM" or "afternoon"
    collaboration_network: Optional[List[dict]] = None  # Top collaborators with counts
    recent_topics: Optional[List[str]] = None  # Topics from last 7 days
    ttl: Optional[int] = None  # TTL for DynamoDB


class KeyContributor(BaseModel):
    """Key contributor in a channel."""
    user_id: str
    user_name: str
    contribution_level: Literal['high', 'medium', 'low']


class SlackChannelSummary(BaseModel):
    """Complete channel summary from Slack analysis."""
    channel_id: str
    workspace_id: str
    channel_name: str
    is_private: bool
    num_members: int
    analysis_date: str
    analysis_period_days: int
    messages_analyzed: int
    channel_purpose: str
    key_topics: List[str]
    # Deprecated product-focused fields (kept for backward compatibility)
    feature_requests: Optional[List[str]] = []
    pain_points: Optional[List[str]] = []
    product_opportunities: Optional[List[str]] = []
    strategic_recommendations: Optional[List[str]] = []
    # Core fields
    sentiment: Literal['positive', 'neutral', 'negative']
    key_contributors: List[KeyContributor]
    ai_summary: str  # Will become daily_digest in future versions
    ai_tokens_used: int
    last_updated: int
    # New activity-focused fields
    daily_digest: Optional[str] = None  # New field for conversational summaries
    highlights: Optional[List[dict]] = None  # Top messages: {author, text, timestamp, reactions}
    participation_rate: Optional[float] = None  # Engagement percentage
    topic_clusters: Optional[List[dict]] = None  # Grouped themes: {topic, count, messages}
    activity_trend: Optional[Literal['up', 'stable', 'down']] = None
    ttl: Optional[int] = None  # TTL for DynamoDB


class LambdaInput(BaseModel):
    """Input event schema for Lambda function."""
    analysis_type: Literal['user', 'channel', 'workspace']
    user_email: Optional[str] = None
    user_id: Optional[str] = None
    channel_name: Optional[str] = None
    channel_id: Optional[str] = None
    days: int = Field(default=30, ge=1, le=365)
    workspace_id: Optional[str] = None


class LambdaOutput(BaseModel):
    """Output response schema for Lambda function."""
    platform: Literal['slack'] = 'slack'
    analysis_type: str
    s3_location: str
    workspace_id: str
    status: Literal['success', 'error']
    metadata: dict
    error: Optional[str] = None
