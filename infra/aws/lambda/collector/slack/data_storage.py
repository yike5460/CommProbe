"""
Data storage utilities for S3 and DynamoDB operations.
"""

import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import ClientError

from models import SlackUserProfile, SlackChannelSummary

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class DataStorage:
    """Handles storage operations for Slack analysis data."""

    def __init__(self, bucket_name: str, table_name: str):
        """
        Initialize storage clients.

        Args:
            bucket_name: S3 bucket name for raw data
            table_name: DynamoDB table name for profiles
        """
        self.s3_client = boto3.client('s3')
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(table_name)
        self.bucket_name = bucket_name
        self.table_name = table_name

        logger.info(f"Initialized storage: S3={bucket_name}, DynamoDB={table_name}")

    def save_to_s3(self, data: Dict[str, Any], analysis_type: str, entity_id: str) -> str:
        """
        Save raw analysis data to S3.

        Args:
            data: Analysis data to save
            analysis_type: Type of analysis ('user' or 'channel')
            entity_id: User ID or Channel ID

        Returns:
            S3 location (s3://bucket/path)
        """
        # Create hierarchical path: slack/YYYY-MM-DD/TYPE_ID.json
        today = datetime.utcnow().strftime('%Y-%m-%d')
        key = f"slack/{today}/{analysis_type.upper()}_{entity_id}.json"

        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=json.dumps(data, indent=2, default=str),
                ContentType='application/json'
            )
            s3_location = f"s3://{self.bucket_name}/{key}"
            logger.info(f"Saved raw data to S3: {s3_location}")
            return s3_location

        except ClientError as e:
            logger.error(f"Failed to save to S3: {str(e)}")
            raise

    def save_user_profile(self, profile: SlackUserProfile) -> None:
        """
        Save user profile to DynamoDB.

        Args:
            profile: SlackUserProfile model instance
        """
        # Calculate TTL (180 days from now)
        ttl = int((datetime.utcnow() + timedelta(days=180)).timestamp())

        # Convert Pydantic model to dict
        profile_dict = profile.dict()
        profile_dict['ttl'] = ttl
        profile_dict['entity_type'] = 'user_profile'

        # Convert lists to JSON strings for DynamoDB
        profile_dict['interests'] = json.dumps(profile_dict['interests'])
        profile_dict['expertise_areas'] = json.dumps(profile_dict['expertise_areas'])
        profile_dict['key_opinions'] = json.dumps(profile_dict['key_opinions'])
        profile_dict['pain_points'] = json.dumps(profile_dict['pain_points'])
        profile_dict['channel_breakdown'] = json.dumps([ch.dict() for ch in profile.channel_breakdown])

        # Set primary keys
        profile_dict['PK'] = f"USER#{profile.user_id}"
        profile_dict['SK'] = f"WORKSPACE#{profile.workspace_id}"

        try:
            self.table.put_item(Item=profile_dict)
            logger.info(f"Saved user profile to DynamoDB: {profile.user_id}")

        except ClientError as e:
            logger.error(f"Failed to save user profile to DynamoDB: {str(e)}")
            raise

    def save_channel_summary(self, summary: SlackChannelSummary) -> None:
        """
        Save channel summary to DynamoDB.

        Args:
            summary: SlackChannelSummary model instance
        """
        # Calculate TTL (180 days from now)
        ttl = int((datetime.utcnow() + timedelta(days=180)).timestamp())

        # Convert Pydantic model to dict
        summary_dict = summary.dict()
        summary_dict['ttl'] = ttl
        summary_dict['entity_type'] = 'channel_summary'

        # Convert lists to JSON strings for DynamoDB
        summary_dict['key_topics'] = json.dumps(summary_dict['key_topics'])
        summary_dict['feature_requests'] = json.dumps(summary_dict['feature_requests'])
        summary_dict['pain_points'] = json.dumps(summary_dict['pain_points'])
        summary_dict['product_opportunities'] = json.dumps(summary_dict['product_opportunities'])
        summary_dict['strategic_recommendations'] = json.dumps(summary_dict['strategic_recommendations'])
        summary_dict['key_contributors'] = json.dumps([kc.dict() for kc in summary.key_contributors])

        # Set primary keys
        summary_dict['PK'] = f"CHANNEL#{summary.channel_id}"
        summary_dict['SK'] = f"WORKSPACE#{summary.workspace_id}"

        try:
            self.table.put_item(Item=summary_dict)
            logger.info(f"Saved channel summary to DynamoDB: {summary.channel_id}")

        except ClientError as e:
            logger.error(f"Failed to save channel summary to DynamoDB: {str(e)}")
            raise

    def get_user_profile(self, user_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user profile from DynamoDB.

        Args:
            user_id: Slack user ID
            workspace_id: Slack workspace ID

        Returns:
            User profile dict or None if not found
        """
        try:
            response = self.table.get_item(
                Key={
                    'PK': f"USER#{user_id}",
                    'SK': f"WORKSPACE#{workspace_id}"
                }
            )
            return response.get('Item')

        except ClientError as e:
            logger.error(f"Failed to get user profile: {str(e)}")
            return None

    def get_channel_summary(self, channel_id: str, workspace_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve channel summary from DynamoDB.

        Args:
            channel_id: Slack channel ID
            workspace_id: Slack workspace ID

        Returns:
            Channel summary dict or None if not found
        """
        try:
            response = self.table.get_item(
                Key={
                    'PK': f"CHANNEL#{channel_id}",
                    'SK': f"WORKSPACE#{workspace_id}"
                }
            )
            return response.get('Item')

        except ClientError as e:
            logger.error(f"Failed to get channel summary: {str(e)}")
            return None

    def list_users_by_workspace(self, workspace_id: str, limit: int = 50) -> list:
        """
        List all user profiles for a workspace.

        Args:
            workspace_id: Slack workspace ID
            limit: Maximum number of results

        Returns:
            List of user profile dicts
        """
        try:
            response = self.table.query(
                IndexName='WorkspaceIndex',
                KeyConditionExpression='workspace_id = :wid',
                FilterExpression='entity_type = :type',
                ExpressionAttributeValues={':wid': workspace_id, ':type': 'user_profile'},
                Limit=limit
            )
            return response.get('Items', [])

        except ClientError as e:
            logger.error(f"Failed to list users: {str(e)}")
            return []

    def list_channels_by_workspace(self, workspace_id: str, limit: int = 50) -> list:
        """
        List all channel summaries for a workspace.

        Args:
            workspace_id: Slack workspace ID
            limit: Maximum number of results

        Returns:
            List of channel summary dicts
        """
        try:
            response = self.table.query(
                IndexName='WorkspaceIndex',
                KeyConditionExpression='workspace_id = :wid',
                FilterExpression='entity_type = :type',
                ExpressionAttributeValues={':wid': workspace_id, ':type': 'channel_summary'},
                Limit=limit
            )
            return response.get('Items', [])

        except ClientError as e:
            logger.error(f"Failed to list channels: {str(e)}")
            return []
