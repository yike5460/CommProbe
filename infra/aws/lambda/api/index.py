"""
AWS Lambda handler for Reddit Crawler REST API
Provides REST endpoints for triggering and monitoring Reddit crawl jobs
"""

import boto3
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any

# Initialize AWS clients
sfn = boto3.client('stepfunctions')


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


def create_response(status_code: int, body: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Create a standardized API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, indent=2 if status_code == 200 and 'service' in body else None)
    }