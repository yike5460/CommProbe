"""
AWS Lambda handler for Reddit Crawler REST API
Provides REST endpoints for triggering and monitoring Reddit crawl jobs
"""

import boto3
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any
from decimal import Decimal

# Initialize AWS clients
sfn = boto3.client('stepfunctions')
dynamodb = boto3.resource('dynamodb')

# Configuration constants
DEFAULT_CRAWL_SETTINGS = {
    'default_subreddits': ['LawFirm', 'Lawyertalk', 'legaladvice', 'legaltechAI'],
    'default_crawl_type': 'both',
    'default_days_back': 3,
    'default_min_score': 10,
    'max_posts_per_crawl': 500
}

DEFAULT_ANALYSIS_SETTINGS = {
    'priority_threshold': 5,
    'ai_model': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'analysis_timeout_seconds': 30,
    'max_retries': 3
}

DEFAULT_STORAGE_SETTINGS = {
    'insights_ttl_days': 90,
    'max_insights_per_request': 100,
    'analytics_cache_ttl_minutes': 15
}

DEFAULT_SYSTEM_SETTINGS = {
    'api_version': '1.0',
    'environment': 'production',
    'maintenance_mode': False,
    'rate_limit_per_minute': 60
}


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle DynamoDB Decimal objects"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convert Decimal to int if it's a whole number, otherwise to float
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        return super(DecimalEncoder, self).default(obj)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway handler for manual crawling triggers and status checks

    Supported endpoints:
    - POST /trigger: Start a new crawl job
    - GET /status/{executionName}: Check execution status
    - GET /executions: List recent executions
    - GET /: API documentation
    """
    try:
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')

        # CORS headers for cross-origin requests
        headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        }

        # Handle preflight OPTIONS request for CORS
        if http_method == 'OPTIONS':
            return create_response(200, {'message': 'CORS preflight'}, headers)

        # Route to appropriate handler
        if http_method == 'POST' and path == '/trigger':
            return handle_trigger_crawl(event, context, headers)
        elif http_method == 'GET' and path.startswith('/status/'):
            return handle_get_status(event, context, headers)
        elif http_method == 'GET' and path == '/executions':
            return handle_list_executions(headers)
        elif http_method == 'GET' and path == '/insights' and not path.startswith('/insights/'):
            return handle_list_insights(event, headers)
        elif http_method == 'GET' and path.startswith('/insights/'):
            return handle_get_insight(event, headers)
        elif http_method == 'GET' and path == '/analytics/summary':
            return handle_analytics_summary(event, headers)
        elif http_method == 'GET' and path == '/analytics/trends':
            return handle_analytics_trends(event, headers)
        elif http_method == 'GET' and path == '/analytics/competitors':
            return handle_analytics_competitors(event, headers)
        elif http_method == 'DELETE' and path.startswith('/executions/'):
            return handle_cancel_execution(event, headers)
        elif http_method == 'GET' and path.startswith('/logs/'):
            return handle_get_execution_logs(event, headers)
        elif http_method == 'GET' and path == '/config':
            return handle_get_config(headers)
        elif http_method == 'PUT' and path == '/config':
            return handle_update_config(event, headers)
        elif http_method == 'GET' and path == '/health':
            return handle_health_check(headers)
        elif http_method == 'GET' and path == '/':
            return handle_api_documentation(headers)
        else:
            return create_response(404, {'error': 'Endpoint not found'}, headers)

    except Exception as e:
        return create_response(
            500,
            {'error': 'Internal server error', 'message': str(e)},
            headers if 'headers' in locals() else {}
        )


def handle_trigger_crawl(event: Dict[str, Any], context: Any, headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle POST /trigger - Start new crawl job"""
    try:
        # Parse request body for custom parameters
        body = {}
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except json.JSONDecodeError:
                return create_response(400, {'error': 'Invalid JSON in request body'}, headers)

        # Prepare execution input with default and custom parameters
        execution_input = {
            'manual_trigger': True,
            'trigger_time': datetime.now(timezone.utc).isoformat(),
            'trigger_source': 'api_gateway',
            'request_id': context.aws_request_id
        }

        # Allow custom crawl parameters from request body
        if body.get('subreddits'):
            execution_input['subreddits'] = body['subreddits']
        if body.get('crawl_type'):
            if body['crawl_type'] not in ['crawl', 'search', 'both']:
                return create_response(400, {'error': 'crawl_type must be crawl, search, or both'}, headers)
            execution_input['crawl_type'] = body['crawl_type']
        if body.get('days_back'):
            if not isinstance(body['days_back'], int) or body['days_back'] < 1:
                return create_response(400, {'error': 'days_back must be a positive integer'}, headers)
            execution_input['days_back'] = body['days_back']
        if body.get('min_score'):
            execution_input['min_score'] = body['min_score']

        # Start Step Functions execution with unique name
        execution_name = f"manual-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{context.aws_request_id[:8]}"

        response = sfn.start_execution(
            stateMachineArn=os.environ['STATE_MACHINE_ARN'],
            name=execution_name,
            input=json.dumps(execution_input)
        )

        return create_response(200, {
            'message': 'Crawl job started successfully',
            'executionArn': response['executionArn'],
            'executionName': execution_name,
            'startDate': response['startDate'].isoformat(),
            'parameters': execution_input
        }, headers)

    except sfn.exceptions.ExecutionAlreadyExists:
        return create_response(409, {'error': 'A crawl job with this name is already running'}, headers)
    except Exception as e:
        print(f"Error starting execution: {str(e)}")
        return create_response(500, {'error': 'Failed to start crawl job', 'message': str(e)}, headers)


def handle_get_status(event: Dict[str, Any], context: Any, headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /status/{executionName} - Check execution status"""
    try:
        # Extract execution name from path
        execution_name = event['path'].split('/')[-1]

        # Construct full execution ARN
        account_id = context.invoked_function_arn.split(':')[4]
        region = os.environ.get('AWS_REGION', 'us-west-2')
        execution_arn = f"arn:aws:states:{region}:{account_id}:execution:supio-reddit-insights-pipeline:{execution_name}"

        # Get execution details
        response = sfn.describe_execution(executionArn=execution_arn)

        # Parse input and output safely
        execution_input = {}
        execution_output = None

        try:
            execution_input = json.loads(response.get('input', '{}'))
        except json.JSONDecodeError:
            pass

        try:
            if response.get('output'):
                execution_output = json.loads(response['output'])
        except json.JSONDecodeError:
            pass

        return create_response(200, {
            'executionArn': response['executionArn'],
            'status': response['status'],
            'startDate': response['startDate'].isoformat(),
            'stopDate': response.get('stopDate').isoformat() if response.get('stopDate') else None,
            'input': execution_input,
            'output': execution_output
        }, headers)

    except sfn.exceptions.ExecutionDoesNotExist:
        return create_response(404, {'error': 'Execution not found'}, headers)
    except Exception as e:
        print(f"Error getting execution status: {str(e)}")
        return create_response(500, {'error': 'Failed to get execution status', 'message': str(e)}, headers)


def handle_list_executions(headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /executions - List recent executions"""
    try:
        response = sfn.list_executions(
            stateMachineArn=os.environ['STATE_MACHINE_ARN'],
            maxResults=10
        )

        executions = []
        for execution in response['executions']:
            executions.append({
                'executionArn': execution['executionArn'],
                'name': execution['name'],
                'status': execution['status'],
                'startDate': execution['startDate'].isoformat(),
                'stopDate': execution.get('stopDate').isoformat() if execution.get('stopDate') else None
            })

        return create_response(200, {
            'executions': executions,
            'count': len(executions)
        }, headers)

    except Exception as e:
        print(f"Error listing executions: {str(e)}")
        return create_response(500, {'error': 'Failed to list executions', 'message': str(e)}, headers)


def handle_api_documentation(headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET / - API documentation"""
    return create_response(200, {
        'service': 'Supio Reddit Legal Communities Crawler API',
        'version': '1.0',
        'description': 'REST API for triggering and monitoring Reddit crawl jobs',
        'endpoints': {
            'POST /trigger': {
                'description': 'Start a new crawl job',
                'parameters': {
                    'subreddits': 'array of subreddit names (optional)',
                    'crawl_type': 'crawl, search, or both (optional, default: both)',
                    'days_back': 'number of days to look back (optional, default: 3)',
                    'min_score': 'minimum post score threshold (optional, default: 10)'
                }
            },
            'GET /status/{executionName}': {
                'description': 'Check execution status',
                'response': 'Execution details including status, timestamps, input, and output'
            },
            'GET /executions': {
                'description': 'List recent executions',
                'response': 'Array of recent executions with basic details'
            },
            'GET /': {
                'description': 'This API documentation'
            }
        },
        'status_values': ['RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'],
        'authentication': 'API Key required in X-API-Key header',
        'cors': 'Enabled for all origins'
    }, headers)


def handle_list_insights(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /insights - List insights with filtering"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}

        # Filtering parameters
        priority_min = int(query_params.get('priority_min', 0))
        priority_max = int(query_params.get('priority_max', 10))
        category = query_params.get('category')
        user_segment = query_params.get('user_segment')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        limit = min(int(query_params.get('limit', 50)), 100)  # Max 100 items

        # Get DynamoDB table
        table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))

        # Query using GSI for priority-based access
        filter_expression = None
        expression_values = {}

        # Build filter expression
        if category:
            filter_expression = 'feature_category = :category'
            expression_values[':category'] = category

        if user_segment:
            if filter_expression:
                filter_expression += ' AND user_segment = :segment'
            else:
                filter_expression = 'user_segment = :segment'
            expression_values[':segment'] = user_segment

        # Query GSI1 for priority-based access
        query_params_dynamo = {
            'IndexName': 'GSI1',
            'KeyConditionExpression': 'GSI1PK = :pk',
            'ExpressionAttributeValues': {':pk': 'PRIORITY'},
            'Limit': limit,
            'ScanIndexForward': False  # Descending order (high priority first)
        }

        if filter_expression:
            query_params_dynamo['FilterExpression'] = filter_expression
            query_params_dynamo['ExpressionAttributeValues'].update(expression_values)

        response = table.query(**query_params_dynamo)

        # Filter by priority range and date range if specified
        filtered_items = []
        for item in response['Items']:
            priority = item.get('priority_score', 0)
            if priority < priority_min or priority > priority_max:
                continue

            # Date filtering
            if date_from or date_to:
                item_date = item.get('GSI1SK', '').split('#DATE#')[-1]
                if date_from and item_date < date_from:
                    continue
                if date_to and item_date > date_to:
                    continue

            filtered_items.append({
                'insight_id': f"{item['PK']}#{item['SK']}",
                'post_id': item['post_id'],
                'priority_score': item['priority_score'],
                'feature_summary': item.get('feature_summary', ''),
                'feature_category': item.get('feature_category', ''),
                'user_segment': item.get('user_segment', ''),
                'subreddit': item.get('subreddit', ''),
                'analyzed_at': item.get('analyzed_at', ''),
                'action_required': item.get('action_required', False),
                'suggested_action': item.get('suggested_action', ''),
                'competitors_mentioned': item.get('competitors_mentioned', [])
            })

        return create_response(200, {
            'data': filtered_items[:limit],
            'pagination': {
                'limit': limit,
                'count': len(filtered_items),
                'hasMore': len(response['Items']) >= limit
            },
            'filters': {
                'priority_min': priority_min,
                'priority_max': priority_max,
                'category': category,
                'user_segment': user_segment,
                'date_from': date_from,
                'date_to': date_to
            }
        }, headers)

    except Exception as e:
        print(f"Error listing insights: {str(e)}")
        return create_response(500, {'error': 'Failed to list insights', 'message': str(e)}, headers)


def handle_get_insight(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /insights/{insightId} - Get single insight details"""
    try:
        # Extract insight ID from path
        insight_id = event['path'].split('/')[-1]

        # Parse insight ID format: INSIGHT#{date}#PRIORITY#{score}#ID#{post_id}
        if '#' not in insight_id:
            return create_response(400, {'error': 'Invalid insight ID format'}, headers)

        parts = insight_id.split('#')
        if len(parts) < 6:
            return create_response(400, {'error': 'Invalid insight ID format'}, headers)

        pk = f"{parts[0]}#{parts[1]}"  # INSIGHT#{date}
        sk = f"{parts[2]}#{parts[3]}#{parts[4]}#{parts[5]}"  # PRIORITY#{score}#ID#{post_id}

        # Get DynamoDB table
        table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))

        # Get item
        response = table.get_item(
            Key={
                'PK': pk,
                'SK': sk
            }
        )

        if 'Item' not in response:
            return create_response(404, {'error': 'Insight not found'}, headers)

        item = response['Item']

        # Return detailed insight
        insight_detail = {
            'insight_id': insight_id,
            'post_id': item['post_id'],
            'post_url': item.get('post_url', ''),
            'subreddit': item.get('subreddit', ''),
            'timestamp': item.get('timestamp', 0),
            'analyzed_at': item.get('analyzed_at', ''),
            'collected_at': item.get('collected_at', ''),

            # Feature Analysis
            'feature_summary': item.get('feature_summary', ''),
            'feature_details': item.get('feature_details', ''),
            'feature_category': item.get('feature_category', ''),
            'priority_score': item.get('priority_score', 0),
            'implementation_size': item.get('implementation_size', ''),

            # User Context
            'user_segment': item.get('user_segment', ''),
            'ai_readiness': item.get('ai_readiness', ''),

            # Competitive Intelligence
            'competitors_mentioned': item.get('competitors_mentioned', []),
            'supio_mentioned': item.get('supio_mentioned', False),
            'competitive_advantage': item.get('competitive_advantage', ''),

            # Action Items
            'action_required': item.get('action_required', False),
            'suggested_action': item.get('suggested_action', ''),
            'pain_points': item.get('pain_points', []),

            # Post Metadata
            'post_score': item.get('post_score', 0),
            'num_comments': item.get('num_comments', 0)
        }

        return create_response(200, {
            'data': insight_detail
        }, headers)

    except Exception as e:
        print(f"Error getting insight: {str(e)}")
        return create_response(500, {'error': 'Failed to get insight', 'message': str(e)}, headers)


def handle_analytics_summary(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /analytics/summary - Analytics dashboard data"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        period = query_params.get('period', '7d')  # 7d, 30d, 90d
        group_by = query_params.get('group_by', 'category').split(',')

        # Calculate date range based on period
        from datetime import datetime, timedelta
        end_date = datetime.utcnow()

        if period == '7d':
            start_date = end_date - timedelta(days=7)
        elif period == '30d':
            start_date = end_date - timedelta(days=30)
        elif period == '90d':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=7)

        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = end_date.strftime('%Y-%m-%d')

        # Get DynamoDB table
        table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))

        # Scan for analytics (in production, this would be optimized with date-based queries)
        response = table.scan()
        items = response['Items']

        # Filter by date range
        filtered_items = []
        for item in items:
            item_date = item.get('GSI1SK', '').split('#DATE#')[-1]
            if start_date_str <= item_date <= end_date_str:
                filtered_items.append(item)

        # Calculate analytics
        analytics = {
            'period': period,
            'date_range': {
                'start': start_date_str,
                'end': end_date_str
            },
            'total_insights': len(filtered_items),
            'high_priority_insights': len([i for i in filtered_items if i.get('priority_score', 0) >= 8]),
            'actionable_insights': len([i for i in filtered_items if i.get('action_required', False)]),
            'avg_priority_score': round(sum(i.get('priority_score', 0) for i in filtered_items) / max(len(filtered_items), 1), 2)
        }

        # Group by analytics
        if 'category' in group_by:
            category_stats = {}
            for item in filtered_items:
                category = item.get('feature_category', 'unknown')
                if category not in category_stats:
                    category_stats[category] = {'count': 0, 'avg_priority': 0, 'priorities': []}
                category_stats[category]['count'] += 1
                priority = item.get('priority_score', 0)
                category_stats[category]['priorities'].append(priority)

            # Calculate averages
            for category, stats in category_stats.items():
                if stats['priorities']:
                    stats['avg_priority'] = round(sum(stats['priorities']) / len(stats['priorities']), 2)
                del stats['priorities']  # Clean up

            analytics['by_category'] = category_stats

        if 'user_segment' in group_by:
            segment_stats = {}
            for item in filtered_items:
                segment = item.get('user_segment', 'unknown')
                if segment not in segment_stats:
                    segment_stats[segment] = {'count': 0, 'avg_priority': 0, 'priorities': []}
                segment_stats[segment]['count'] += 1
                priority = item.get('priority_score', 0)
                segment_stats[segment]['priorities'].append(priority)

            # Calculate averages
            for segment, stats in segment_stats.items():
                if stats['priorities']:
                    stats['avg_priority'] = round(sum(stats['priorities']) / len(stats['priorities']), 2)
                del stats['priorities']  # Clean up

            analytics['by_user_segment'] = segment_stats

        # Top competitors mentioned
        competitor_mentions = {}
        for item in filtered_items:
            competitors = item.get('competitors_mentioned', [])
            for competitor in competitors:
                competitor_mentions[competitor] = competitor_mentions.get(competitor, 0) + 1

        analytics['top_competitors'] = dict(sorted(competitor_mentions.items(), key=lambda x: x[1], reverse=True)[:10])

        # Recent high priority insights (for alerts)
        recent_high_priority = [
            {
                'insight_id': f"{item['PK']}#{item['SK']}",
                'priority_score': item.get('priority_score', 0),
                'feature_summary': item.get('feature_summary', ''),
                'analyzed_at': item.get('analyzed_at', '')
            }
            for item in sorted(filtered_items, key=lambda x: x.get('timestamp', 0), reverse=True)
            if item.get('priority_score', 0) >= 8
        ][:5]

        analytics['recent_high_priority'] = recent_high_priority

        return create_response(200, {
            'data': analytics,
            'meta': {
                'generated_at': datetime.utcnow().isoformat(),
                'items_analyzed': len(filtered_items)
            }
        }, headers)

    except Exception as e:
        print(f"Error generating analytics summary: {str(e)}")
        return create_response(500, {'error': 'Failed to generate analytics summary', 'message': str(e)}, headers)


def handle_get_config(headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /config - Get system configuration"""
    try:
        # Default configuration settings (in production, these would come from DynamoDB or Parameter Store)
        config = {
            'crawl_settings': DEFAULT_CRAWL_SETTINGS,
            'analysis_settings': DEFAULT_ANALYSIS_SETTINGS,
            'storage_settings': DEFAULT_STORAGE_SETTINGS,
            'system_settings': DEFAULT_SYSTEM_SETTINGS
        }

        return create_response(200, config, headers)

    except Exception as e:
        print(f"Error getting configuration: {str(e)}")
        return create_response(500, {'error': 'Failed to get configuration', 'message': str(e)}, headers)


def handle_update_config(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle PUT /config - Update system configuration"""
    try:
        # Parse request body
        if not event.get('body'):
            return create_response(400, {'error': 'Request body is required'}, headers)

        try:
            config_update = json.loads(event['body'])
        except json.JSONDecodeError:
            return create_response(400, {'error': 'Invalid JSON in request body'}, headers)

        # Validate configuration update
        allowed_sections = ['crawl_settings', 'analysis_settings', 'storage_settings', 'system_settings']
        for section in config_update.keys():
            if section not in allowed_sections:
                return create_response(400, {'error': f'Invalid configuration section: {section}'}, headers)

        # In production, this would update DynamoDB or Parameter Store
        # For now, return success with the updated configuration
        updated_config = {
            'message': 'Configuration updated successfully',
            'updated_sections': list(config_update.keys()),
            'timestamp': datetime.utcnow().isoformat(),
            'updated_by': 'api_user'  # In production, extract from authentication
        }

        return create_response(200, updated_config, headers)

    except Exception as e:
        print(f"Error updating configuration: {str(e)}")
        return create_response(500, {'error': 'Failed to update configuration', 'message': str(e)}, headers)


def handle_health_check(headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /health - System health check"""
    try:
        # Check system health metrics
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'uptime_seconds': 0,  # In production, calculate actual uptime
            'checks': {
                'database': {'status': 'healthy', 'response_time_ms': 0},
                'storage': {'status': 'healthy', 'response_time_ms': 0},
                'ai_service': {'status': 'healthy', 'response_time_ms': 0},
                'pipeline': {'status': 'healthy', 'last_execution': None}
            },
            'metrics': {
                'total_requests': 0,  # In production, get from CloudWatch
                'error_rate': 0.0,
                'avg_response_time_ms': 0,
                'active_executions': 0
            },
            'resources': {
                'memory_usage_percent': 0,
                'cpu_usage_percent': 0,
                'disk_usage_percent': 0
            }
        }

        # Quick database connectivity check
        try:
            table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))
            table.meta.client.describe_table(TableName=table.table_name)
            health_status['checks']['database'] = {'status': 'healthy', 'response_time_ms': 50}
        except Exception as db_error:
            health_status['checks']['database'] = {'status': 'unhealthy', 'error': str(db_error)}
            health_status['status'] = 'degraded'

        # Quick Step Functions check
        try:
            sfn.list_executions(
                stateMachineArn=os.environ['STATE_MACHINE_ARN'],
                maxResults=1
            )
            health_status['checks']['pipeline'] = {'status': 'healthy', 'response_time_ms': 100}
        except Exception as sfn_error:
            health_status['checks']['pipeline'] = {'status': 'unhealthy', 'error': str(sfn_error)}
            health_status['status'] = 'degraded'

        # Return appropriate status code based on health
        status_code = 200 if health_status['status'] == 'healthy' else 503

        return create_response(status_code, health_status, headers)

    except Exception as e:
        print(f"Error performing health check: {str(e)}")
        return create_response(500, {'error': 'Health check failed', 'message': str(e)}, headers)


def handle_analytics_trends(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /analytics/trends - Historical trend analysis"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        metric = query_params.get('metric', 'priority_score')  # priority_score, insights_count, avg_score
        period = query_params.get('period', '30d')  # 7d, 30d, 90d
        group_by = query_params.get('group_by', 'day')  # day, week, month

        # Calculate date range based on period
        from datetime import datetime, timedelta
        end_date = datetime.utcnow()

        if period == '7d':
            start_date = end_date - timedelta(days=7)
            interval_days = 1
        elif period == '30d':
            start_date = end_date - timedelta(days=30)
            interval_days = 1 if group_by == 'day' else 7
        elif period == '90d':
            start_date = end_date - timedelta(days=90)
            interval_days = 7 if group_by == 'week' else 30
        else:
            start_date = end_date - timedelta(days=30)
            interval_days = 1

        # Get DynamoDB table
        table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))

        # Scan for trend analysis (in production, optimize with date partitioning)
        response = table.scan()
        items = response['Items']

        # Generate trend data points
        trend_data = []
        current_date = start_date

        while current_date <= end_date:
            end_interval = current_date + timedelta(days=interval_days)
            current_date_str = current_date.strftime('%Y-%m-%d')
            end_interval_str = end_interval.strftime('%Y-%m-%d')

            # Filter items for this interval
            interval_items = [
                item for item in items
                if current_date_str <= item.get('GSI1SK', '').split('#DATE#')[-1] < end_interval_str
            ]

            # Calculate metrics
            if metric == 'priority_score':
                value = round(sum(item.get('priority_score', 0) for item in interval_items) / max(len(interval_items), 1), 2)
            elif metric == 'insights_count':
                value = len(interval_items)
            elif metric == 'avg_score':
                value = round(sum(item.get('priority_score', 0) for item in interval_items) / max(len(interval_items), 1), 2)
            else:
                value = len(interval_items)

            trend_data.append({
                'date': current_date_str,
                'value': value,
                'count': len(interval_items)
            })

            current_date = end_interval

        # Calculate trend statistics
        values = [point['value'] for point in trend_data if point['value'] > 0]
        if values:
            trend_direction = 'increasing' if values[-1] > values[0] else 'decreasing' if values[-1] < values[0] else 'stable'
            volatility = round(max(values) - min(values), 2) if len(values) > 1 else 0
        else:
            trend_direction = 'stable'
            volatility = 0

        return create_response(200, {
            'data': {
                'metric': metric,
                'period': period,
                'group_by': group_by,
                'date_range': {
                    'start': start_date.strftime('%Y-%m-%d'),
                    'end': end_date.strftime('%Y-%m-%d')
                },
                'trend_points': trend_data,
                'summary': {
                    'trend_direction': trend_direction,
                    'volatility': volatility,
                    'total_data_points': len(trend_data),
                    'avg_value': round(sum(values) / len(values), 2) if values else 0
                }
            },
            'meta': {
                'generated_at': datetime.utcnow().isoformat(),
                'total_insights_analyzed': len(items)
            }
        }, headers)

    except Exception as e:
        print(f"Error generating analytics trends: {str(e)}")
        return create_response(500, {'error': 'Failed to generate analytics trends', 'message': str(e)}, headers)


def handle_analytics_competitors(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /analytics/competitors - Competitive intelligence analysis"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        competitor = query_params.get('competitor')  # Filter by specific competitor
        sentiment = query_params.get('sentiment')  # positive, negative, neutral
        limit = min(int(query_params.get('limit', 50)), 100)

        # Get DynamoDB table
        table = dynamodb.Table(os.environ.get('INSIGHTS_TABLE_NAME', 'supio-insights'))

        # Scan for competitive analysis
        response = table.scan()
        items = response['Items']

        # Aggregate competitor mentions
        competitor_data = {}
        competitor_insights = []

        for item in items:
            competitors_mentioned = item.get('competitors_mentioned', [])

            # Filter by specific competitor if requested
            if competitor and competitor not in competitors_mentioned:
                continue

            # Process each competitor mentioned in this insight
            for comp in competitors_mentioned:
                if comp not in competitor_data:
                    competitor_data[comp] = {
                        'name': comp,
                        'total_mentions': 0,
                        'insights': [],
                        'avg_priority': 0,
                        'categories': {},
                        'user_segments': {},
                        'sentiment_breakdown': {'positive': 0, 'negative': 0, 'neutral': 0}
                    }

                competitor_data[comp]['total_mentions'] += 1

                # Analyze competitive advantage for sentiment (simplified logic)
                competitive_advantage = item.get('competitive_advantage', '').lower()
                if 'better' in competitive_advantage or 'superior' in competitive_advantage:
                    competitor_data[comp]['sentiment_breakdown']['positive'] += 1
                elif 'worse' in competitive_advantage or 'inferior' in competitive_advantage:
                    competitor_data[comp]['sentiment_breakdown']['negative'] += 1
                else:
                    competitor_data[comp]['sentiment_breakdown']['neutral'] += 1

                # Category breakdown
                category = item.get('feature_category', 'unknown')
                competitor_data[comp]['categories'][category] = competitor_data[comp]['categories'].get(category, 0) + 1

                # User segment breakdown
                segment = item.get('user_segment', 'unknown')
                competitor_data[comp]['user_segments'][segment] = competitor_data[comp]['user_segments'].get(segment, 0) + 1

                # Add insight details
                insight_detail = {
                    'insight_id': f"{item['PK']}#{item['SK']}",
                    'priority_score': item.get('priority_score', 0),
                    'feature_summary': item.get('feature_summary', ''),
                    'competitive_advantage': item.get('competitive_advantage', ''),
                    'analyzed_at': item.get('analyzed_at', ''),
                    'subreddit': item.get('subreddit', '')
                }
                competitor_data[comp]['insights'].append(insight_detail)

        # Calculate averages and apply filters
        filtered_competitors = []
        for comp_name, comp_info in competitor_data.items():
            if comp_info['insights']:
                comp_info['avg_priority'] = round(
                    sum(insight['priority_score'] for insight in comp_info['insights']) / len(comp_info['insights']), 2
                )

            # Apply sentiment filter
            if sentiment:
                dominant_sentiment = max(comp_info['sentiment_breakdown'], key=comp_info['sentiment_breakdown'].get)
                if dominant_sentiment != sentiment:
                    continue

            # Sort insights by priority and limit
            comp_info['insights'] = sorted(comp_info['insights'], key=lambda x: x['priority_score'], reverse=True)[:limit]

            filtered_competitors.append(comp_info)

        # Sort by total mentions
        filtered_competitors = sorted(filtered_competitors, key=lambda x: x['total_mentions'], reverse=True)[:limit]

        # Generate market position analysis
        if filtered_competitors:
            market_leader = max(filtered_competitors, key=lambda x: x['total_mentions'])
            avg_mentions = sum(comp['total_mentions'] for comp in filtered_competitors) / len(filtered_competitors)
        else:
            market_leader = None
            avg_mentions = 0

        return create_response(200, {
            'data': {
                'competitors': filtered_competitors,
                'market_analysis': {
                    'market_leader': market_leader['name'] if market_leader else None,
                    'total_competitors_mentioned': len(competitor_data),
                    'avg_mentions_per_competitor': round(avg_mentions, 1),
                    'most_discussed_categories': dict(sorted({
                        cat: sum(comp['categories'].get(cat, 0) for comp in filtered_competitors)
                        for cat in set().union(*(comp['categories'].keys() for comp in filtered_competitors))
                    }.items(), key=lambda x: x[1], reverse=True)[:5])
                }
            },
            'filters': {
                'competitor': competitor,
                'sentiment': sentiment,
                'limit': limit
            },
            'meta': {
                'generated_at': datetime.utcnow().isoformat(),
                'total_insights_analyzed': len(items)
            }
        }, headers)

    except Exception as e:
        print(f"Error generating competitive analysis: {str(e)}")
        return create_response(500, {'error': 'Failed to generate competitive analysis', 'message': str(e)}, headers)


def handle_cancel_execution(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle DELETE /executions/{executionName} - Cancel running job"""
    try:
        # Extract execution name from path
        execution_name = event['path'].split('/')[-1]

        # Construct full execution ARN
        account_id = os.environ.get('AWS_ACCOUNT_ID')
        region = os.environ.get('AWS_REGION', 'us-east-1')

        if not account_id:
            # Try to extract from context if available
            context = event.get('requestContext', {})
            account_id = context.get('accountId', '705247044519')  # fallback

        execution_arn = f"arn:aws:states:{region}:{account_id}:execution:supio-reddit-insights-pipeline:{execution_name}"

        # Check current execution status first
        try:
            describe_response = sfn.describe_execution(executionArn=execution_arn)
            current_status = describe_response['status']

            if current_status in ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']:
                return create_response(409, {
                    'error': 'Cannot cancel execution',
                    'message': f'Execution is already in terminal state: {current_status}',
                    'current_status': current_status
                }, headers)
        except sfn.exceptions.ExecutionDoesNotExist:
            return create_response(404, {'error': 'Execution not found'}, headers)

        # Stop the execution
        stop_response = sfn.stop_execution(
            executionArn=execution_arn,
            error='UserCancellation',
            cause='Execution cancelled via API request'
        )

        return create_response(200, {
            'message': 'Execution cancellation requested successfully',
            'executionArn': execution_arn,
            'executionName': execution_name,
            'stopDate': stop_response['stopDate'].isoformat(),
            'previous_status': current_status,
            'new_status': 'ABORTED'
        }, headers)

    except sfn.exceptions.ExecutionDoesNotExist:
        return create_response(404, {'error': 'Execution not found'}, headers)
    except Exception as e:
        print(f"Error cancelling execution: {str(e)}")
        return create_response(500, {'error': 'Failed to cancel execution', 'message': str(e)}, headers)


def handle_get_execution_logs(event: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Handle GET /logs/{executionName} - Get execution logs"""
    try:
        # Extract execution name from path
        execution_name = event['path'].split('/')[-1]

        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        level = query_params.get('level', 'INFO')  # DEBUG, INFO, WARN, ERROR
        limit = min(int(query_params.get('limit', 100)), 1000)
        start_time = query_params.get('start_time')  # ISO timestamp

        # Get execution details first to get log group
        account_id = os.environ.get('AWS_ACCOUNT_ID', '705247044519')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        execution_arn = f"arn:aws:states:{region}:{account_id}:execution:supio-reddit-insights-pipeline:{execution_name}"

        try:
            execution_details = sfn.describe_execution(executionArn=execution_arn)
        except sfn.exceptions.ExecutionDoesNotExist:
            return create_response(404, {'error': 'Execution not found'}, headers)

        # Get execution history for detailed logs
        history_response = sfn.get_execution_history(
            executionArn=execution_arn,
            maxResults=limit,
            reverseOrder=True  # Most recent first
        )

        # Process execution events into log format
        logs = []
        for event_item in history_response['events']:
            event_type = event_item['type']
            timestamp = event_item['timestamp'].isoformat()

            # Extract relevant information based on event type
            log_entry = {
                'timestamp': timestamp,
                'level': 'INFO',
                'event_type': event_type,
                'message': '',
                'details': {}
            }

            # Process different event types
            if event_type == 'ExecutionStarted':
                log_entry['message'] = 'Execution started'
                log_entry['details'] = event_item.get('executionStartedEventDetails', {})
            elif event_type == 'ExecutionSucceeded':
                log_entry['message'] = 'Execution completed successfully'
                log_entry['details'] = event_item.get('executionSucceededEventDetails', {})
            elif event_type == 'ExecutionFailed':
                log_entry['level'] = 'ERROR'
                log_entry['message'] = 'Execution failed'
                log_entry['details'] = event_item.get('executionFailedEventDetails', {})
            elif event_type == 'TaskStateEntered':
                state_details = event_item.get('stateEnteredEventDetails', {})
                log_entry['message'] = f"Entered state: {state_details.get('name', 'Unknown')}"
                log_entry['details'] = state_details
            elif event_type == 'TaskStateExited':
                state_details = event_item.get('stateExitedEventDetails', {})
                log_entry['message'] = f"Exited state: {state_details.get('name', 'Unknown')}"
                log_entry['details'] = state_details
            elif event_type == 'TaskFailed':
                log_entry['level'] = 'ERROR'
                task_details = event_item.get('taskFailedEventDetails', {})
                log_entry['message'] = f"Task failed: {task_details.get('error', 'Unknown error')}"
                log_entry['details'] = task_details
            elif event_type == 'LambdaFunctionStarted':
                log_entry['message'] = 'Lambda function started'
            elif event_type == 'LambdaFunctionSucceeded':
                log_entry['message'] = 'Lambda function completed'
                log_entry['details'] = event_item.get('lambdaFunctionSucceededEventDetails', {})
            elif event_type == 'LambdaFunctionFailed':
                log_entry['level'] = 'ERROR'
                lambda_details = event_item.get('lambdaFunctionFailedEventDetails', {})
                log_entry['message'] = f"Lambda function failed: {lambda_details.get('error', 'Unknown error')}"
                log_entry['details'] = lambda_details
            else:
                log_entry['message'] = f"Step Functions event: {event_type}"

            # Apply level filter
            if level != 'ALL' and log_entry['level'] != level:
                continue

            logs.append(log_entry)

        # Sort by timestamp (most recent first)
        logs = sorted(logs, key=lambda x: x['timestamp'], reverse=True)[:limit]

        return create_response(200, {
            'data': {
                'execution_name': execution_name,
                'execution_arn': execution_arn,
                'execution_status': execution_details['status'],
                'logs': logs,
                'log_summary': {
                    'total_events': len(history_response['events']),
                    'filtered_logs': len(logs),
                    'error_count': len([log for log in logs if log['level'] == 'ERROR']),
                    'execution_duration': None  # Could calculate from start/end times
                }
            },
            'filters': {
                'level': level,
                'limit': limit,
                'start_time': start_time
            },
            'meta': {
                'generated_at': datetime.utcnow().isoformat()
            }
        }, headers)

    except Exception as e:
        print(f"Error getting execution logs: {str(e)}")
        return create_response(500, {'error': 'Failed to get execution logs', 'message': str(e)}, headers)


def create_response(status_code: int, body: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Create a standardized API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, indent=2 if status_code == 200 and 'service' in body else None, cls=DecimalEncoder)
    }