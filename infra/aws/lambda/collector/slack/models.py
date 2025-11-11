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
    feature_requests: List[str]
    pain_points: List[str]
    sentiment: Literal['positive', 'neutral', 'negative']
    key_contributors: List[KeyContributor]
    product_opportunities: List[str]
    strategic_recommendations: List[str]
    ai_summary: str
    ai_tokens_used: int
    last_updated: int
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
