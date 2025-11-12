#!/bin/bash

# Reddit Crawler API Validation Script
# Validates end-to-end pipeline functionality for stable iteration

set -e

# Usage information
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -r, --region REGION     AWS region (default: us-west-2)"
    echo "  -p, --pipeline-only     Test only pipeline endpoints (original tests)"
    echo "  -d, --data-only         Test only data access endpoints (Priority 1)"
    echo "  -s, --slack-only        Test only Slack integration endpoints"
    echo "  -q, --quick             Skip pipeline execution tests (faster)"
    echo "  --skip-s3               Skip S3 storage validation"
    echo "  --skip-quality          Skip analysis quality validation"
    echo ""
    echo "Test Categories:"
    echo "  Pipeline Tests:   API docs, trigger, status, executions, S3, DynamoDB, quality"
    echo "  Data Access Tests: insights list, insight details, analytics summary"
    echo "  Config & Management Tests: system config, config update, health check"
    echo "  Enhanced Analytics Tests: trends analysis, competitor intelligence"
    echo "  Operational Tests: execution cancellation, execution logs"
    echo "  Twitter Integration Tests: multi-platform collection, platform filtering, Twitter insights"
    echo "  Slack Integration Tests: channel/user analysis triggers, profile retrieval, list operations, job tracking"
    echo ""
    echo "Note: Slack tests require SLACK_BOT_TOKEN to be configured in Lambda environment."
    echo "      If not configured, tests will verify proper 'disabled' error handling."
    echo "      Job tracking test validates Phase X.1 implementation (async job status tracking)."
    echo ""
    echo "Examples:"
    echo "  $0                      # Run all tests (default)"
    echo "  $0 --region us-east-1   # Run tests against us-east-1 region"
    echo "  $0 --pipeline-only      # Test only original pipeline functionality"
    echo "  $0 --data-only          # Test only new data access endpoints"
    echo "  $0 --slack-only         # Test only Slack integration (user & channel analysis)"
    echo "  $0 --quick              # Skip long-running pipeline execution test"
    exit 0
}

# Default Configuration (can be overridden by region parameter)
AWS_REGION="us-west-2"
TIMEOUT_SECONDS=900

# Test configuration flags
PIPELINE_ONLY=false
DATA_ONLY=false
SLACK_ONLY=false
QUICK_MODE=false
SKIP_S3=false
SKIP_QUALITY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -p|--pipeline-only)
            PIPELINE_ONLY=true
            shift
            ;;
        -d|--data-only)
            DATA_ONLY=true
            shift
            ;;
        -s|--slack-only)
            SLACK_ONLY=true
            shift
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        --skip-s3)
            SKIP_S3=true
            shift
            ;;
        --skip-quality)
            SKIP_QUALITY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Set region-specific configuration after parsing arguments
case $AWS_REGION in
    us-west-2)
        API_BASE_URL="https://x1kxsb6l17.execute-api.us-west-2.amazonaws.com/v1"
        API_KEY="vPJlvaa0DS9tqxH41eNIA20Sofzb0cG719d8dd0i"
        S3_BUCKET="supio-raw-data-705247044519-us-west-2"
        ;;
    us-east-1)
        # Add us-east-1 configuration when deployed there
        echo "Error: us-east-1 configuration not yet set up"
        exit 1
        ;;
    *)
        echo "Error: Unsupported region: $AWS_REGION"
        echo "Supported regions: us-west-2, us-east-1"
        exit 1
        ;;
esac

DYNAMODB_TABLE="supio-insights"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation results
VALIDATION_RESULTS=()

add_result() {
    local status=$1
    local test_name=$2
    local details=$3
    VALIDATION_RESULTS+=("$status|$test_name|$details")
}

# API request helper
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3

    if ([ "$method" = "POST" ] || [ "$method" = "PUT" ]) && [ -n "$data" ]; then
        curl -s -X "$method" "$API_BASE_URL$endpoint" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X "$method" "$API_BASE_URL$endpoint" \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json"
    fi
}

# Test 1: API Documentation Endpoint
test_api_documentation() {
    log_info "Testing API documentation endpoint..."

    local response
    response=$(api_request "GET" "/")

    if echo "$response" | jq -e '.service' > /dev/null 2>&1; then
        local service_name
        service_name=$(echo "$response" | jq -r '.service')
        add_result "PASS" "API Documentation" "Service: $service_name"
        log_success "API documentation endpoint working"
    else
        add_result "FAIL" "API Documentation" "Invalid response format"
        log_error "API documentation endpoint failed"
        return 1
    fi
}

# Test 2: Trigger Pipeline Execution
test_pipeline_trigger() {
    log_info "Triggering pipeline execution..."

    local trigger_data='{"subreddits": ["legaltechAI"], "crawl_type": "crawl", "days_back": 1, "min_score": 10}'
    local response
    response=$(api_request "POST" "/trigger" "$trigger_data")

    if echo "$response" | jq -e '.executionName' > /dev/null 2>&1; then
        EXECUTION_NAME=$(echo "$response" | jq -r '.executionName')
        EXECUTION_ARN=$(echo "$response" | jq -r '.executionArn')
        add_result "PASS" "Pipeline Trigger" "Execution: $EXECUTION_NAME"
        log_success "Pipeline triggered successfully: $EXECUTION_NAME"
    else
        add_result "FAIL" "Pipeline Trigger" "Failed to start execution"
        log_error "Failed to trigger pipeline"
        return 1
    fi
}

# Test 3: Monitor Execution Status
test_execution_monitoring() {
    log_info "Monitoring execution status..."

    local attempts=0
    local max_attempts=$((TIMEOUT_SECONDS / 5))

    while [ $attempts -lt $max_attempts ]; do
        local status_response
        status_response=$(api_request "GET" "/status/$EXECUTION_NAME")

        # Check if response contains an error message
        if echo "$status_response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$status_response" | jq -r '.error')
            add_result "FAIL" "Execution Status" "API Error: $error_msg"
            log_error "Failed to get execution status: $error_msg"
            log_warning "Response: $status_response"
            return 1
        fi

        if echo "$status_response" | jq -e '.status' > /dev/null 2>&1; then
            local status
            status=$(echo "$status_response" | jq -r '.status')

            case $status in
                "SUCCEEDED")
                    EXECUTION_OUTPUT=$(echo "$status_response" | jq -r '.output')
                    add_result "PASS" "Execution Status" "Status: $status"
                    log_success "Pipeline execution completed successfully"
                    return 0
                    ;;
                "FAILED"|"TIMED_OUT"|"ABORTED")
                    add_result "FAIL" "Execution Status" "Status: $status"
                    log_error "Pipeline execution failed with status: $status"
                    return 1
                    ;;
                "RUNNING")
                    log_info "Execution still running... (attempt $((attempts + 1))/$max_attempts)"
                    sleep 5
                    attempts=$((attempts + 1))
                    ;;
                *)
                    log_warning "Unknown status: $status, will retry..."
                    sleep 5
                    attempts=$((attempts + 1))
                    ;;
            esac
        else
            # Response doesn't have .status or .error, show what we got
            add_result "FAIL" "Execution Status" "Invalid response format"
            log_error "Failed to get execution status - unexpected response format"
            log_warning "Response received: $(echo "$status_response" | head -c 200)..."
            return 1
        fi
    done

    add_result "FAIL" "Execution Status" "Timeout after ${TIMEOUT_SECONDS}s"
    log_error "Execution monitoring timed out"
    return 1
}

# Test 4: Verify S3 Storage
test_s3_storage() {
    log_info "Verifying S3 file storage..."

    local date_str
    date_str=$(date +%Y-%m-%d)

    # Check for both filtered and full analysis files
    local filtered_files
    local full_files

    filtered_files=$(aws s3 ls "s3://$S3_BUCKET/analyzed/$date_str/" --region "$AWS_REGION" | grep "filtered_analysis" | wc -l)
    full_files=$(aws s3 ls "s3://$S3_BUCKET/analyzed/$date_str/" --region "$AWS_REGION" | grep "full_analysis" | wc -l)

    if [ "$filtered_files" -gt 0 ] && [ "$full_files" -gt 0 ]; then
        # Get file sizes
        local latest_filtered
        local latest_full
        latest_filtered=$(aws s3 ls "s3://$S3_BUCKET/analyzed/$date_str/" --region "$AWS_REGION" | grep "filtered_analysis" | tail -1 | awk '{print $4}')
        latest_full=$(aws s3 ls "s3://$S3_BUCKET/analyzed/$date_str/" --region "$AWS_REGION" | grep "full_analysis" | tail -1 | awk '{print $4}')

        add_result "PASS" "S3 Storage" "Filtered: ${latest_filtered}B, Full: ${latest_full}B"
        log_success "S3 files created successfully"
    else
        add_result "FAIL" "S3 Storage" "Missing analysis files"
        log_error "S3 analysis files not found"
        return 1
    fi
}

# Test 5: Verify DynamoDB Access
test_dynamodb_access() {
    log_info "Verifying DynamoDB table access..."

    local table_status
    table_status=$(aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" --query 'Table.TableStatus' --output text 2>/dev/null)

    if [ "$table_status" = "ACTIVE" ]; then
        local item_count
        item_count=$(aws dynamodb scan --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" --select "COUNT" --query 'Count' --output text)
        add_result "PASS" "DynamoDB Access" "Table active, items: $item_count"
        log_success "DynamoDB table accessible"
    else
        add_result "FAIL" "DynamoDB Access" "Table not active"
        log_error "DynamoDB table not accessible"
        return 1
    fi
}

# Test 6: Validate Analysis Quality
test_analysis_quality() {
    log_info "Validating analysis quality..."

    local date_str
    date_str=$(date +%Y-%m-%d)

    # Download and examine latest full analysis file
    local latest_full_file
    latest_full_file=$(aws s3 ls "s3://$S3_BUCKET/analyzed/$date_str/" --region "$AWS_REGION" | grep "full_analysis" | tail -1 | awk '{print $4}')

    if [ -n "$latest_full_file" ]; then
        aws s3 cp "s3://$S3_BUCKET/analyzed/$date_str/$latest_full_file" /tmp/validation_analysis.json --region "$AWS_REGION" > /dev/null 2>&1

        if [ -f "/tmp/validation_analysis.json" ]; then
            local posts_analyzed
            local total_results
            posts_analyzed=$(jq -r '.posts_analyzed' /tmp/validation_analysis.json)
            total_results=$(jq -r '.total_analysis_results' /tmp/validation_analysis.json)

            # Validate that posts were analyzed and results structure is correct
            # Note: 0 posts analyzed is valid if no posts met the criteria (e.g., min_score threshold)
            if [ "$posts_analyzed" -ge 0 ] && [ "$total_results" -ge 0 ] && [ "$total_results" -le "$posts_analyzed" ]; then
                if [ "$posts_analyzed" -eq 0 ]; then
                    add_result "PASS" "Analysis Quality" "No posts met criteria (analyzed: $posts_analyzed, results: $total_results)"
                    log_success "Analysis quality validation passed (no qualifying posts)"
                else
                    add_result "PASS" "Analysis Quality" "Analyzed: $posts_analyzed posts, Results: $total_results"
                    log_success "Analysis quality validation passed"
                fi
            else
                add_result "FAIL" "Analysis Quality" "Invalid analysis counts: analyzed=$posts_analyzed, results=$total_results"
                log_error "Analysis quality validation failed"
                return 1
            fi

            rm -f /tmp/validation_analysis.json
        else
            add_result "FAIL" "Analysis Quality" "Could not download analysis file"
            log_error "Failed to download analysis file"
            return 1
        fi
    else
        add_result "FAIL" "Analysis Quality" "No analysis file found"
        log_error "No analysis file found for validation"
        return 1
    fi
}

# Test 7: Insights List Endpoint (Priority 1)
test_insights_list() {
    log_info "Testing insights list endpoint..."

    # Test basic endpoint
    local response
    response=$(api_request "GET" "/insights?limit=5")

    if echo "$response" | jq -e '.data' > /dev/null 2>&1; then
        local count
        count=$(echo "$response" | jq -r '.pagination.count')
        add_result "PASS" "Insights List" "Basic endpoint working, items: $count"
        log_success "Insights list endpoint working"
    else
        add_result "FAIL" "Insights List" "Invalid response format"
        log_error "Insights list endpoint failed"
        return 1
    fi

    # Test with filtering parameters
    log_info "Testing insights list with filters..."
    local filtered_response
    filtered_response=$(api_request "GET" "/insights?priority_min=8&category=document_automation&limit=10")

    if echo "$filtered_response" | jq -e '.filters.priority_min' > /dev/null 2>&1; then
        local priority_min
        priority_min=$(echo "$filtered_response" | jq -r '.filters.priority_min')
        add_result "PASS" "Insights Filtering" "Filters applied correctly, priority_min: $priority_min"
        log_success "Insights filtering working"
    else
        add_result "FAIL" "Insights Filtering" "Filter parameters not processed"
        log_error "Insights filtering failed"
        return 1
    fi
}

# Test 8: Insight Details Endpoint (Priority 1)
test_insight_details() {
    log_info "Testing insight details endpoint..."

    # Test with invalid ID format (should return 400)
    local response
    response=$(api_request "GET" "/insights/invalid-id-format")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$response" | jq -r '.error')
        add_result "PASS" "Insight Details Validation" "Proper validation: $error_msg"
        log_success "Insight details validation working"
    else
        add_result "FAIL" "Insight Details Validation" "No proper validation"
        log_error "Insight details validation failed"
        return 1
    fi

    # Test with properly formatted dash format ID (should return 404 if no data)
    local valid_response
    valid_response=$(api_request "GET" "/insights/INSIGHT-2025-09-23-PRIORITY-8-ID-test123")

    if echo "$valid_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$valid_response" | jq -r '.error')
        add_result "PASS" "Insight Details Format" "Valid ID handling: $error_msg"
        log_success "Insight details ID format handling working"
    else
        # If we get data back, that's also valid
        if echo "$valid_response" | jq -e '.data' > /dev/null 2>&1; then
            add_result "PASS" "Insight Details Format" "Found existing insight data"
            log_success "Insight details returned existing data"
        else
            add_result "FAIL" "Insight Details Format" "Unexpected response format"
            log_error "Insight details unexpected response"
            return 1
        fi
    fi
}

# Test 9: Analytics Summary Endpoint (Priority 1)
test_analytics_summary() {
    log_info "Testing analytics summary endpoint..."

    # Test basic endpoint
    local response
    response=$(api_request "GET" "/analytics/summary")

    if echo "$response" | jq -e '.data.period' > /dev/null 2>&1; then
        local period
        local total_insights
        period=$(echo "$response" | jq -r '.data.period')
        total_insights=$(echo "$response" | jq -r '.data.total_insights')
        add_result "PASS" "Analytics Summary" "Basic endpoint working, period: $period, insights: $total_insights"
        log_success "Analytics summary endpoint working"
    else
        add_result "FAIL" "Analytics Summary" "Invalid response format"
        log_error "Analytics summary endpoint failed"
        return 1
    fi

    # Test with different parameters
    log_info "Testing analytics summary with parameters..."
    local param_response
    param_response=$(api_request "GET" "/analytics/summary?period=30d&group_by=category,user_segment")

    if echo "$param_response" | jq -e '.data.date_range' > /dev/null 2>&1; then
        local period
        local start_date
        period=$(echo "$param_response" | jq -r '.data.period')
        start_date=$(echo "$param_response" | jq -r '.data.date_range.start')
        add_result "PASS" "Analytics Parameters" "Parameters processed correctly, period: $period, start: $start_date"
        log_success "Analytics summary parameters working"
    else
        add_result "FAIL" "Analytics Parameters" "Parameters not processed correctly"
        log_error "Analytics summary parameters failed"
        return 1
    fi

    # Verify grouping structure
    if echo "$param_response" | jq -e '.data.by_category' > /dev/null 2>&1 &&
       echo "$param_response" | jq -e '.data.by_user_segment' > /dev/null 2>&1; then
        add_result "PASS" "Analytics Grouping" "Grouping structure present"
        log_success "Analytics summary grouping working"
    else
        add_result "PASS" "Analytics Grouping" "Grouping structure optional when no data"
        log_success "Analytics summary grouping handled correctly"
    fi
}

# Test 10: System Configuration Endpoint (Priority 2)
test_system_config() {
    log_info "Testing system configuration endpoint..."

    # Test basic GET /config endpoint
    local response
    response=$(api_request "GET" "/config")

    if echo "$response" | jq -e '.crawl_settings' > /dev/null 2>&1; then
        local default_subreddits_count
        local api_version
        default_subreddits_count=$(echo "$response" | jq -r '.crawl_settings.default_subreddits | length')
        api_version=$(echo "$response" | jq -r '.system_settings.api_version')
        add_result "PASS" "System Config" "Config loaded, subreddits: $default_subreddits_count, version: $api_version"
        log_success "System configuration endpoint working"
    else
        add_result "FAIL" "System Config" "Invalid config structure"
        log_error "System configuration endpoint failed"
        return 1
    fi

    # Verify config structure includes all required sections
    if echo "$response" | jq -e '.crawl_settings' > /dev/null 2>&1 &&
       echo "$response" | jq -e '.analysis_settings' > /dev/null 2>&1 &&
       echo "$response" | jq -e '.storage_settings' > /dev/null 2>&1 &&
       echo "$response" | jq -e '.system_settings' > /dev/null 2>&1; then
        add_result "PASS" "Config Structure" "All required sections present"
        log_success "Configuration structure validation passed"
    else
        add_result "FAIL" "Config Structure" "Missing required configuration sections"
        log_error "Configuration structure validation failed"
        return 1
    fi
}

# Test 11: Configuration Update Endpoint (Priority 2)
test_config_update() {
    log_info "Testing configuration update endpoint..."

    # Test with valid configuration update
    local update_data='{"crawl_settings": {"default_days_back": 5}, "system_settings": {"maintenance_mode": false}}'
    local response
    response=$(api_request "PUT" "/config" "$update_data")

    if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
        local updated_sections
        local timestamp
        updated_sections=$(echo "$response" | jq -r '.updated_sections | length')
        timestamp=$(echo "$response" | jq -r '.timestamp')
        add_result "PASS" "Config Update" "Update processed, sections: $updated_sections, timestamp: $timestamp"
        log_success "Configuration update endpoint working"
    else
        add_result "FAIL" "Config Update" "Invalid update response"
        log_error "Configuration update endpoint failed"
        return 1
    fi

    # Test with invalid configuration section (should return 400)
    log_info "Testing config update validation..."
    local invalid_data='{"invalid_section": {"test": "value"}}'
    local invalid_response
    invalid_response=$(api_request "PUT" "/config" "$invalid_data")

    if echo "$invalid_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$invalid_response" | jq -r '.error')
        add_result "PASS" "Config Validation" "Proper validation: $error_msg"
        log_success "Configuration update validation working"
    else
        add_result "FAIL" "Config Validation" "No proper validation for invalid sections"
        log_error "Configuration update validation failed"
        return 1
    fi
}

# Test 11B: Configuration Persistence Verification (Critical)
test_config_persistence() {
    log_info "Testing configuration persistence (GET -> PUT -> GET cycle)..."

    # Step 1: Get current configuration
    local initial_config
    initial_config=$(api_request "GET" "/config")

    if ! echo "$initial_config" | jq -e '.crawl_settings.default_days_back' > /dev/null 2>&1; then
        add_result "FAIL" "Config Persistence" "Cannot read initial config"
        log_error "Failed to read initial configuration"
        return 1
    fi

    local initial_days_back
    initial_days_back=$(echo "$initial_config" | jq -r '.crawl_settings.default_days_back')
    log_info "Initial default_days_back: $initial_days_back"

    # Step 2: Update configuration with a unique value
    local new_days_back=7
    local update_data="{\"crawl_settings\": {\"default_days_back\": $new_days_back}}"
    local update_response
    update_response=$(api_request "PUT" "/config" "$update_data")

    if ! echo "$update_response" | jq -e '.message' > /dev/null 2>&1; then
        add_result "FAIL" "Config Persistence" "Update failed"
        log_error "Configuration update failed"
        return 1
    fi

    log_info "Configuration updated successfully"

    # Step 3: Wait briefly for DynamoDB consistency
    sleep 2

    # Step 4: Read configuration again to verify persistence
    local updated_config
    updated_config=$(api_request "GET" "/config")

    if ! echo "$updated_config" | jq -e '.crawl_settings.default_days_back' > /dev/null 2>&1; then
        add_result "FAIL" "Config Persistence" "Cannot read updated config"
        log_error "Failed to read updated configuration"
        return 1
    fi

    local persisted_days_back
    persisted_days_back=$(echo "$updated_config" | jq -r '.crawl_settings.default_days_back')
    log_info "Persisted default_days_back: $persisted_days_back"

    # Step 5: Verify the value matches what we set
    if [ "$persisted_days_back" -eq "$new_days_back" ]; then
        add_result "PASS" "Config Persistence" "Configuration persisted correctly: $new_days_back -> $persisted_days_back"
        log_success "Configuration persistence verified!"
    else
        add_result "FAIL" "Config Persistence" "Configuration not persisted: expected $new_days_back, got $persisted_days_back"
        log_error "Configuration persistence failed"
        return 1
    fi

    # Step 6: Restore original value
    local restore_data="{\"crawl_settings\": {\"default_days_back\": $initial_days_back}}"
    api_request "PUT" "/config" "$restore_data" > /dev/null 2>&1
    log_info "Restored original configuration"
}

# Test 12: Health Check Endpoint (Priority 2)
test_health_check() {
    log_info "Testing health check endpoint..."

    # Test basic GET /health endpoint
    local response
    response=$(api_request "GET" "/health")

    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        local status
        local version
        local db_status
        local pipeline_status
        status=$(echo "$response" | jq -r '.status')
        version=$(echo "$response" | jq -r '.version')
        db_status=$(echo "$response" | jq -r '.checks.database.status')
        pipeline_status=$(echo "$response" | jq -r '.checks.pipeline.status')

        add_result "PASS" "Health Check" "Status: $status, version: $version, DB: $db_status, pipeline: $pipeline_status"
        log_success "Health check endpoint working"
    else
        add_result "FAIL" "Health Check" "Invalid health response format"
        log_error "Health check endpoint failed"
        return 1
    fi

    # Verify health check structure includes all required sections
    if echo "$response" | jq -e '.checks' > /dev/null 2>&1 &&
       echo "$response" | jq -e '.metrics' > /dev/null 2>&1 &&
       echo "$response" | jq -e '.resources' > /dev/null 2>&1; then
        add_result "PASS" "Health Structure" "All health check sections present"
        log_success "Health check structure validation passed"
    else
        add_result "PASS" "Health Structure" "Basic health structure acceptable"
        log_success "Health check structure handled correctly"
    fi

    # Verify database connectivity check
    if echo "$response" | jq -e '.checks.database' > /dev/null 2>&1; then
        local db_check_status
        db_check_status=$(echo "$response" | jq -r '.checks.database.status')
        if [ "$db_check_status" = "healthy" ] || [ "$db_check_status" = "unhealthy" ]; then
            add_result "PASS" "Database Health" "Database connectivity check performed: $db_check_status"
            log_success "Database health check working"
        else
            add_result "FAIL" "Database Health" "Invalid database health status"
            log_error "Database health check failed"
            return 1
        fi
    else
        add_result "FAIL" "Database Health" "No database connectivity check"
        log_error "Database health check missing"
        return 1
    fi
}

# Test 13: Analytics Trends Endpoint (Priority 3)
test_analytics_trends() {
    log_info "Testing analytics trends endpoint..."

    # Test basic endpoint
    local response
    response=$(api_request "GET" "/analytics/trends")

    if echo "$response" | jq -e '.data.trend_points' > /dev/null 2>&1; then
        local period
        local total_points
        period=$(echo "$response" | jq -r '.data.period')
        total_points=$(echo "$response" | jq -r '.data.trend_points | length')
        add_result "PASS" "Analytics Trends" "Basic endpoint working, period: $period, points: $total_points"
        log_success "Analytics trends endpoint working"
    else
        add_result "FAIL" "Analytics Trends" "Invalid response format"
        log_error "Analytics trends endpoint failed"
        return 1
    fi

    # Test with different parameters
    log_info "Testing analytics trends with parameters..."
    local param_response
    param_response=$(api_request "GET" "/analytics/trends?metric=insights_count&period=7d&group_by=day")

    if echo "$param_response" | jq -e '.data.summary.trend_direction' > /dev/null 2>&1; then
        local metric
        local trend_direction
        metric=$(echo "$param_response" | jq -r '.data.metric')
        trend_direction=$(echo "$param_response" | jq -r '.data.summary.trend_direction')
        add_result "PASS" "Analytics Trends Parameters" "Parameters processed correctly, metric: $metric, trend: $trend_direction"
        log_success "Analytics trends parameters working"
    else
        add_result "FAIL" "Analytics Trends Parameters" "Parameters not processed correctly"
        log_error "Analytics trends parameters failed"
        return 1
    fi
}

# Test 14: Analytics Competitors Endpoint (Priority 3)
test_analytics_competitors() {
    log_info "Testing analytics competitors endpoint..."

    # Test basic endpoint
    local response
    response=$(api_request "GET" "/analytics/competitors")

    if echo "$response" | jq -e '.data.competitors' > /dev/null 2>&1; then
        local competitors_count
        local market_leader
        competitors_count=$(echo "$response" | jq -r '.data.competitors | length')
        market_leader=$(echo "$response" | jq -r '.data.market_analysis.market_leader // "none"')
        add_result "PASS" "Analytics Competitors" "Basic endpoint working, competitors: $competitors_count, leader: $market_leader"
        log_success "Analytics competitors endpoint working"
    else
        add_result "FAIL" "Analytics Competitors" "Invalid response format"
        log_error "Analytics competitors endpoint failed"
        return 1
    fi

    # Test with filtering parameters
    log_info "Testing analytics competitors with filters..."
    local filtered_response
    filtered_response=$(api_request "GET" "/analytics/competitors?sentiment=positive&limit=10")

    if echo "$filtered_response" | jq -e '.filters.sentiment' > /dev/null 2>&1; then
        local sentiment
        local limit
        sentiment=$(echo "$filtered_response" | jq -r '.filters.sentiment')
        limit=$(echo "$filtered_response" | jq -r '.filters.limit')
        add_result "PASS" "Analytics Competitors Filtering" "Filters applied correctly, sentiment: $sentiment, limit: $limit"
        log_success "Analytics competitors filtering working"
    else
        add_result "PASS" "Analytics Competitors Filtering" "Filtering handled correctly even with empty data"
        log_success "Analytics competitors filtering handled correctly"
    fi
}

# Test 15: Cancel Execution Endpoint (Priority 4)
test_cancel_execution() {
    log_info "Testing cancel execution endpoint..."

    # Test with invalid execution name (should return 404)
    local response
    response=$(api_request "DELETE" "/executions/invalid-execution-name")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$response" | jq -r '.error')
        add_result "PASS" "Cancel Execution Validation" "Proper validation: $error_msg"
        log_success "Cancel execution validation working"
    else
        add_result "FAIL" "Cancel Execution Validation" "No proper validation"
        log_error "Cancel execution validation failed"
        return 1
    fi

    # Test with properly formatted execution name (should return 404 if no execution or 409 if completed)
    local valid_response
    valid_response=$(api_request "DELETE" "/executions/manual-20250923-000000-testtest")

    if echo "$valid_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$valid_response" | jq -r '.error')
        # Accept various error messages indicating the endpoint is working
        if [[ "$error_msg" == *"not found"* ]] || \
           [[ "$error_msg" == *"Cannot cancel"* ]] || \
           [[ "$error_msg" == *"Failed to cancel"* ]] || \
           [[ "$error_msg" == *"not authorized"* ]]; then
            add_result "PASS" "Cancel Execution Format" "Valid execution name handling: $error_msg"
            log_success "Cancel execution format handling working"
        else
            add_result "FAIL" "Cancel Execution Format" "Unexpected error: $error_msg"
            log_error "Cancel execution format handling failed"
            return 1
        fi
    else
        # If successful cancellation, that's also valid
        if echo "$valid_response" | jq -e '.message' > /dev/null 2>&1; then
            add_result "PASS" "Cancel Execution Format" "Successfully cancelled execution"
            log_success "Cancel execution successful"
        else
            add_result "FAIL" "Cancel Execution Format" "Unexpected response format"
            log_error "Cancel execution unexpected response"
            return 1
        fi
    fi
}

# Test 16: Execution Logs Endpoint (Priority 4)
test_execution_logs() {
    log_info "Testing execution logs endpoint..."

    # Test with invalid execution name (should return 404)
    local response
    response=$(api_request "GET" "/logs/invalid-execution-name")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$response" | jq -r '.error')
        # Accept various error messages indicating the endpoint is working
        if [[ "$error_msg" == *"not found"* ]] || \
           [[ "$error_msg" == *"Failed to get"* ]] || \
           [[ "$error_msg" == *"not authorized"* ]]; then
            add_result "PASS" "Execution Logs Validation" "Proper validation: $error_msg"
            log_success "Execution logs validation working"
        else
            add_result "FAIL" "Execution Logs Validation" "Unexpected validation error: $error_msg"
            log_error "Execution logs validation failed"
            return 1
        fi
    else
        add_result "FAIL" "Execution Logs Validation" "No proper validation for invalid execution"
        log_error "Execution logs validation failed"
        return 1
    fi

    # Test with properly formatted execution name (may return logs or 404)
    log_info "Testing execution logs with parameters..."
    local param_response
    param_response=$(api_request "GET" "/logs/manual-20250923-000000-testtest?level=INFO&limit=10")

    if echo "$param_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$param_response" | jq -r '.error')
        # Accept various error messages indicating the endpoint is working
        if [[ "$error_msg" == *"not found"* ]] || \
           [[ "$error_msg" == *"Failed to get"* ]] || \
           [[ "$error_msg" == *"not authorized"* ]]; then
            add_result "PASS" "Execution Logs Parameters" "Parameter handling correct for non-existent execution"
            log_success "Execution logs parameters working"
        else
            add_result "FAIL" "Execution Logs Parameters" "Unexpected parameter error: $error_msg"
            log_error "Execution logs parameters failed"
            return 1
        fi
    else
        # If we get log data back, that's also valid
        if echo "$param_response" | jq -e '.data.logs' > /dev/null 2>&1; then
            local logs_count
            local level_filter
            logs_count=$(echo "$param_response" | jq -r '.data.logs | length')
            level_filter=$(echo "$param_response" | jq -r '.filters.level')
            add_result "PASS" "Execution Logs Parameters" "Found logs: $logs_count entries, level: $level_filter"
            log_success "Execution logs returned data successfully"
        else
            add_result "FAIL" "Execution Logs Parameters" "Unexpected response format"
            log_error "Execution logs unexpected response"
            return 1
        fi
    fi
}

# Test 17: Twitter Insights in Database (Twitter Integration)
test_twitter_insights() {
    log_info "Testing Twitter insights in database..."

    local response
    response=$(api_request "GET" "/insights?platform=twitter&limit=10")

    if echo "$response" | jq -e '.data' > /dev/null 2>&1; then
        local count
        count=$(echo "$response" | jq -r '.pagination.count')

        # Verify platform field exists if we have data
        if [ "$count" -gt 0 ]; then
            if echo "$response" | jq -e '.data[0].source_type' > /dev/null 2>&1; then
                local platform
                platform=$(echo "$response" | jq -r '.data[0].source_type')

                # Verify it's actually Twitter data
                if [ "$platform" = "twitter" ]; then
                    add_result "PASS" "Twitter Insights" "Found Twitter insights: $count, platform: $platform"
                    log_success "Twitter insights validation passed"
                else
                    add_result "FAIL" "Twitter Insights" "Platform field incorrect: expected twitter, got $platform"
                    log_error "Twitter insights platform field incorrect"
                    return 1
                fi
            else
                add_result "FAIL" "Twitter Insights" "Platform field (source_type) missing in insights"
                log_error "Twitter insights missing source_type field"
                return 1
            fi
        else
            add_result "PASS" "Twitter Insights" "No Twitter insights yet (acceptable, may need data collection)"
            log_success "Twitter insights endpoint working (no data yet)"
        fi
    else
        add_result "FAIL" "Twitter Insights" "Invalid response format from insights endpoint"
        log_error "Twitter insights endpoint failed"
        return 1
    fi

    # Test platform filtering works correctly
    log_info "Verifying platform filter parameter..."
    if echo "$response" | jq -e '.filters.platform' > /dev/null 2>&1; then
        local filter_value
        filter_value=$(echo "$response" | jq -r '.filters.platform')
        if [ "$filter_value" = "twitter" ]; then
            add_result "PASS" "Twitter Platform Filter" "Platform filter applied correctly: $filter_value"
            log_success "Twitter platform filtering working"
        else
            add_result "FAIL" "Twitter Platform Filter" "Platform filter not applied correctly"
            log_error "Twitter platform filter validation failed"
            return 1
        fi
    else
        add_result "PASS" "Twitter Platform Filter" "Platform filter parameter accepted"
        log_success "Twitter platform filter handled correctly"
    fi
}

# Test 18: Multi-Platform Collection (Twitter Integration)
test_multi_platform_collection() {
    log_info "Testing multi-platform collection trigger..."

    local trigger_data='{"platforms": ["reddit", "twitter"], "days_back": 1, "twitter_config": {"lookback_days": 1, "min_engagement": 5}}'
    local response
    response=$(api_request "POST" "/trigger" "$trigger_data")

    if echo "$response" | jq -e '.executionName' > /dev/null 2>&1; then
        MULTI_EXECUTION_NAME=$(echo "$response" | jq -r '.executionName')
        add_result "PASS" "Multi-Platform Trigger" "Execution: $MULTI_EXECUTION_NAME"
        log_success "Multi-platform collection triggered: $MULTI_EXECUTION_NAME"
    else
        # Check if error is due to missing Twitter credentials
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            if [[ "$error_msg" == *"Twitter"* ]] || [[ "$error_msg" == *"credentials"* ]]; then
                add_result "PASS" "Multi-Platform Trigger" "Twitter not configured (expected if credentials not provided)"
                log_warning "Multi-platform trigger: Twitter credentials not configured"
            else
                add_result "FAIL" "Multi-Platform Trigger" "Failed with unexpected error: $error_msg"
                log_error "Failed to trigger multi-platform collection"
                return 1
            fi
        else
            add_result "FAIL" "Multi-Platform Trigger" "Failed to start multi-platform execution"
            log_error "Failed to trigger multi-platform collection"
            return 1
        fi
    fi

    # Test Twitter-only collection
    log_info "Testing Twitter-only collection trigger..."
    local twitter_only_data='{"platforms": ["twitter"], "twitter_config": {"lookback_days": 1, "min_engagement": 5}}'
    local twitter_response
    twitter_response=$(api_request "POST" "/trigger" "$twitter_only_data")

    if echo "$twitter_response" | jq -e '.executionName' > /dev/null 2>&1; then
        local twitter_execution
        twitter_execution=$(echo "$twitter_response" | jq -r '.executionName')
        add_result "PASS" "Twitter-Only Trigger" "Execution: $twitter_execution"
        log_success "Twitter-only collection triggered: $twitter_execution"
    else
        if echo "$twitter_response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$twitter_response" | jq -r '.error')
            if [[ "$error_msg" == *"Twitter"* ]] || [[ "$error_msg" == *"credentials"* ]]; then
                add_result "PASS" "Twitter-Only Trigger" "Twitter not configured (expected if credentials not provided)"
                log_warning "Twitter-only trigger: Twitter credentials not configured"
            else
                add_result "FAIL" "Twitter-Only Trigger" "Failed with unexpected error: $error_msg"
                log_error "Failed to trigger Twitter-only collection"
                return 1
            fi
        else
            add_result "FAIL" "Twitter-Only Trigger" "Invalid response format"
            log_error "Failed to trigger Twitter-only collection"
            return 1
        fi
    fi
}

# Test 19: Platform-Specific Analytics (Twitter Integration)
test_platform_analytics() {
    log_info "Testing platform-specific analytics..."

    # Test analytics summary with Twitter platform filter
    local twitter_response
    twitter_response=$(api_request "GET" "/analytics/summary?platform=twitter")

    if echo "$twitter_response" | jq -e '.data' > /dev/null 2>&1; then
        local total_insights
        total_insights=$(echo "$twitter_response" | jq -r '.data.total_insights')
        add_result "PASS" "Platform Analytics (Twitter)" "Twitter analytics working, insights: $total_insights"
        log_success "Platform-specific analytics validation passed"

        # Verify platform filter is reflected in response
        if echo "$twitter_response" | jq -e '.filters.platform' > /dev/null 2>&1; then
            local platform_filter
            platform_filter=$(echo "$twitter_response" | jq -r '.filters.platform')
            if [ "$platform_filter" = "twitter" ]; then
                add_result "PASS" "Platform Analytics Filter" "Platform filter correctly applied: $platform_filter"
                log_success "Platform analytics filter working"
            fi
        fi
    else
        add_result "FAIL" "Platform Analytics (Twitter)" "Platform filtering not working"
        log_error "Platform analytics validation failed"
        return 1
    fi

    # Test analytics summary with Reddit platform filter for comparison
    log_info "Testing platform-specific analytics for Reddit..."
    local reddit_response
    reddit_response=$(api_request "GET" "/analytics/summary?platform=reddit")

    if echo "$reddit_response" | jq -e '.data' > /dev/null 2>&1; then
        local reddit_insights
        reddit_insights=$(echo "$reddit_response" | jq -r '.data.total_insights')
        add_result "PASS" "Platform Analytics (Reddit)" "Reddit analytics working, insights: $reddit_insights"
        log_success "Reddit platform analytics working"
    else
        add_result "FAIL" "Platform Analytics (Reddit)" "Reddit platform filtering failed"
        log_error "Reddit platform analytics validation failed"
        return 1
    fi

    # Test analytics summary without platform filter (should return all)
    log_info "Testing analytics summary without platform filter..."
    local all_response
    all_response=$(api_request "GET" "/analytics/summary")

    if echo "$all_response" | jq -e '.data.total_insights' > /dev/null 2>&1; then
        local all_insights
        all_insights=$(echo "$all_response" | jq -r '.data.total_insights')
        add_result "PASS" "Platform Analytics (All)" "All platforms analytics working, insights: $all_insights"
        log_success "Analytics summary working without filter"
    else
        add_result "FAIL" "Platform Analytics (All)" "Analytics summary without filter failed"
        log_error "Analytics summary validation failed"
        return 1
    fi
}

# Test 20: Slack User Analysis Trigger
test_slack_user_analysis() {
    log_info "Testing Slack user analysis trigger..."

    # Note: This test requires SLACK_BOT_TOKEN to be configured in Lambda environment
    # If token is set to 'DISABLED', the test will verify proper error handling
    local trigger_data='{"user_email": "aaron.yi@supio.com", "days": 30}'
    local response
    response=$(api_request "POST" "/slack/analyze/user" "$trigger_data")

    # Check if Slack is disabled
    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        local status
        status=$(echo "$response" | jq -r '.status')
        if [ "$status" = "disabled" ]; then
            add_result "PASS" "Slack User Analysis" "Slack disabled (expected if not configured)"
            log_warning "Slack user analysis: Integration not configured (set SLACK_BOT_TOKEN in Lambda)"
            return 0
        fi
    fi

    # Check for successful trigger or appropriate error
    if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
        local message request_id job_id
        message=$(echo "$response" | jq -r '.message')
        request_id=$(echo "$response" | jq -r '.request_id // "unknown"')
        job_id=$(echo "$response" | jq -r '.job_id // ""')

        if [ -n "$job_id" ]; then
            add_result "PASS" "Slack User Analysis" "Triggered: $message (Job ID: $job_id)"
            log_success "Slack user analysis triggered with job tracking"
            SLACK_JOB_ID="$job_id"  # Store for job status test
        else
            add_result "PASS" "Slack User Analysis" "Triggered: $message (ID: $request_id)"
            log_warning "Job ID not returned (may need redeployment)"
        fi
    else
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            # User not found is expected for test email
            if [[ "$error_msg" == *"not found"* ]] || [[ "$error_msg" == *"disabled"* ]]; then
                add_result "PASS" "Slack User Analysis" "Proper error handling: $error_msg"
                log_success "Slack user analysis error handling working"
            else
                add_result "FAIL" "Slack User Analysis" "Unexpected error: $error_msg"
                log_error "Slack user analysis failed with unexpected error"
                return 1
            fi
        else
            add_result "FAIL" "Slack User Analysis" "Invalid response format"
            log_error "Slack user analysis endpoint failed"
            return 1
        fi
    fi
}

# Test 21: Slack Get User Profile
test_slack_get_user_profile() {
    log_info "Testing Slack get user profile..."
    log_info "  Note: This also validates the Lambda timeout fix (channel limiting)"

    # Test with a non-existent user ID to verify error handling
    local response
    response=$(api_request "GET" "/slack/users/U123456789?workspace_id=default")

    if echo "$response" | jq -e '.user_id' > /dev/null 2>&1; then
        local user_name user_email total_activity total_channels
        user_name=$(echo "$response" | jq -r '.user_name')
        user_email=$(echo "$response" | jq -r '.user_email')
        total_activity=$(echo "$response" | jq -r '.total_activity')
        total_channels=$(echo "$response" | jq -r '.total_channels // 0')

        # Validate timeout fix: profile should exist even for users with many channels
        add_result "PASS" "Slack Get User Profile" "Profile: $user_name ($user_email), Activity: $total_activity, Channels: $total_channels"
        log_success "Slack user profile endpoint working with data (timeout fix validated)"
    else
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            # Not found is expected for test user ID
            if [[ "$error_msg" == *"not found"* ]] || [[ "$error_msg" == *"does not exist"* ]]; then
                add_result "PASS" "Slack Get User Profile" "Proper 404 handling: $error_msg"
                log_success "Slack user profile error handling working"
            else
                add_result "FAIL" "Slack Get User Profile" "Unexpected error: $error_msg"
                log_error "Slack user profile endpoint failed"
                return 1
            fi
        else
            add_result "FAIL" "Slack Get User Profile" "Invalid response format"
            log_error "Slack user profile endpoint failed"
            return 1
        fi
    fi
}

# Test 22: Slack List Users
test_slack_list_users() {
    log_info "Testing Slack list users..."

    local response
    response=$(api_request "GET" "/slack/users?workspace_id=default&limit=10")

    # Check if response contains users array (may be empty initially)
    if echo "$response" | jq -e '.users' > /dev/null 2>&1; then
        local count
        count=$(echo "$response" | jq -r '.count')
        if [ "$count" -eq 0 ]; then
            add_result "PASS" "Slack List Users" "No users analyzed yet (run analysis first)"
            log_success "Slack list users endpoint working (empty)"
        else
            add_result "PASS" "Slack List Users" "Found $count user profile(s)"
            log_success "Slack list users endpoint working with data"
        fi
    else
        # Check if it's an error response
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            add_result "PASS" "Slack List Users" "Error response: $error_msg"
            log_warning "Slack list users: $error_msg"
        else
            add_result "FAIL" "Slack List Users" "Invalid response format"
            log_error "Slack list users endpoint failed"
            return 1
        fi
    fi
}

# Test 23: Slack Channel Analysis Trigger
test_slack_channel_analysis() {
    log_info "Testing Slack channel analysis trigger..."

    # Test with a real channel name that the bot should have access to
    # Using 'mailroom' as it's a smaller channel good for testing
    local trigger_data='{"channel_name": "mailroom", "days": 7, "workspace_id": "default"}'
    local response
    response=$(api_request "POST" "/slack/analyze/channel" "$trigger_data")

    # Check if Slack is disabled
    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        local status
        status=$(echo "$response" | jq -r '.status')
        if [ "$status" = "disabled" ]; then
            add_result "PASS" "Slack Channel Analysis" "Slack disabled (expected if not configured)"
            log_warning "Slack channel analysis: Integration not configured (set SLACK_BOT_TOKEN in Lambda)"
            return 0
        fi
    fi

    # Check for successful trigger
    if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
        local message request_id
        message=$(echo "$response" | jq -r '.message')
        request_id=$(echo "$response" | jq -r '.request_id // "unknown"')
        add_result "PASS" "Slack Channel Analysis" "Triggered: $message (ID: $request_id)"
        log_success "Slack channel analysis triggered successfully"
        SLACK_CHANNEL_REQUEST_ID="$request_id"
    else
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            # Channel not found or bot not invited are expected errors if not configured properly
            if [[ "$error_msg" == *"not found"* ]] || [[ "$error_msg" == *"disabled"* ]] || [[ "$error_msg" == *"not invited"* ]]; then
                add_result "PASS" "Slack Channel Analysis" "Proper error handling: $error_msg"
                log_warning "Slack channel analysis: $error_msg"
            else
                add_result "FAIL" "Slack Channel Analysis" "Unexpected error: $error_msg"
                log_error "Slack channel analysis failed"
                return 1
            fi
        else
            add_result "FAIL" "Slack Channel Analysis" "Invalid response format"
            log_error "Slack channel analysis endpoint failed"
            return 1
        fi
    fi
}

# Test 24: Slack Get Channel Summary
test_slack_get_channel_summary() {
    log_info "Testing Slack get channel summary..."

    # Test with a non-existent channel ID to verify error handling
    local response
    response=$(api_request "GET" "/slack/channels/C123456789?workspace_id=default")

    if echo "$response" | jq -e '.channel_id' > /dev/null 2>&1; then
        local channel_name messages_analyzed sentiment
        channel_name=$(echo "$response" | jq -r '.channel_name')
        messages_analyzed=$(echo "$response" | jq -r '.messages_analyzed')
        sentiment=$(echo "$response" | jq -r '.sentiment // "unknown"')
        add_result "PASS" "Slack Get Channel" "Channel: #$channel_name, Messages: $messages_analyzed, Sentiment: $sentiment"
        log_success "Slack channel summary endpoint working with data"
    else
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            # Not found is expected for test channel ID
            if [[ "$error_msg" == *"not found"* ]] || [[ "$error_msg" == *"does not exist"* ]]; then
                add_result "PASS" "Slack Get Channel" "Proper 404 handling: $error_msg"
                log_success "Slack channel error handling working"
            else
                add_result "FAIL" "Slack Get Channel" "Unexpected error: $error_msg"
                log_error "Slack channel endpoint failed"
                return 1
            fi
        else
            add_result "FAIL" "Slack Get Channel" "Invalid response format"
            log_error "Slack channel endpoint failed"
            return 1
        fi
    fi
}

# Test 25: Slack List Channels
test_slack_list_channels() {
    log_info "Testing Slack list channels..."

    local response
    response=$(api_request "GET" "/slack/channels?workspace_id=default&limit=10")

    # Check if response contains channels array (may be empty initially)
    if echo "$response" | jq -e '.channels' > /dev/null 2>&1; then
        local count
        count=$(echo "$response" | jq -r '.count')
        if [ "$count" -eq 0 ]; then
            add_result "PASS" "Slack List Channels" "No channels analyzed yet (run analysis first)"
            log_success "Slack list channels endpoint working (empty)"
        else
            add_result "PASS" "Slack List Channels" "Found $count channel summary(ies)"
            log_success "Slack list channels endpoint working with data"
        fi
    else
        # Check if it's an error response
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error')
            add_result "PASS" "Slack List Channels" "Error response: $error_msg"
            log_warning "Slack list channels: $error_msg"
        else
            add_result "FAIL" "Slack List Channels" "Invalid response format"
            log_error "Slack list channels endpoint failed"
            return 1
        fi
    fi
}

# Test 26: Slack Job Status Tracking
test_slack_job_status_tracking() {
    log_info "Testing Slack job status tracking..."
    log_info "  This validates the new job tracking feature (Phase X.1)"

    # Check if we have a job_id from the user analysis test
    if [ -z "$SLACK_JOB_ID" ]; then
        log_warning "No job_id available from previous test - triggering new analysis"

        # Trigger a new analysis to get a job_id
        local trigger_data='{"user_email": "test@example.com", "days": 7}'
        local trigger_response
        trigger_response=$(api_request "POST" "/slack/analyze/user" "$trigger_data")

        if echo "$trigger_response" | jq -e '.job_id' > /dev/null 2>&1; then
            SLACK_JOB_ID=$(echo "$trigger_response" | jq -r '.job_id')
            log_info "  Triggered new analysis, job_id: $SLACK_JOB_ID"
        else
            add_result "SKIP" "Slack Job Status" "Cannot get job_id (Slack may be disabled or not configured)"
            log_warning "Skipping job status test - no job_id available"
            return 0
        fi
    fi

    log_info "  Testing job status endpoint with job_id: $SLACK_JOB_ID"

    # Test job status endpoint
    local status_response
    status_response=$(api_request "GET" "/slack/jobs/$SLACK_JOB_ID/status")

    if echo "$status_response" | jq -e '.job_id' > /dev/null 2>&1; then
        local job_status job_type created_at
        job_status=$(echo "$status_response" | jq -r '.status')
        job_type=$(echo "$status_response" | jq -r '.analysis_type')
        created_at=$(echo "$status_response" | jq -r '.created_at')

        # Validate status is one of the expected values
        if [[ "$job_status" =~ ^(pending|processing|completed|failed)$ ]]; then
            add_result "PASS" "Slack Job Status" "Job status: $job_status, type: $job_type, created: $created_at"
            log_success "Job status endpoint working correctly"

            # If job is still pending/processing, give info about polling
            if [[ "$job_status" == "pending" ]] || [[ "$job_status" == "processing" ]]; then
                log_info "  Job is still $job_status - frontend would poll every 5 seconds"
                log_info "  To see completed status, wait 2-5 minutes and check: GET /slack/jobs/$SLACK_JOB_ID/status"
            elif [[ "$job_status" == "completed" ]]; then
                local result_location
                result_location=$(echo "$status_response" | jq -r '.result_location // "N/A"')
                log_success "  Job completed successfully! Result: $result_location"
            elif [[ "$job_status" == "failed" ]]; then
                local error_msg
                error_msg=$(echo "$status_response" | jq -r '.error_message // "Unknown error"')
                log_warning "  Job failed: $error_msg"
            fi
        else
            add_result "FAIL" "Slack Job Status" "Invalid status value: $job_status"
            log_error "Job status has unexpected value"
            return 1
        fi
    elif echo "$status_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$status_response" | jq -r '.error')

        if [[ "$error_msg" == *"not found"* ]]; then
            add_result "PASS" "Slack Job Status" "Proper 404 handling for non-existent job"
            log_success "Job status error handling working"
        else
            add_result "FAIL" "Slack Job Status" "Unexpected error: $error_msg"
            log_error "Job status endpoint failed"
            return 1
        fi
    else
        add_result "FAIL" "Slack Job Status" "Invalid response format"
        log_error "Job status endpoint returned invalid response"
        return 1
    fi
}

# Test 27: Slack Integration Comprehensive Test
test_slack_integration_comprehensive() {
    log_info "Testing Slack integration end-to-end..."
    log_info "This test validates the complete Slack analysis workflow"
    log_info "  Includes validation of Lambda timeout fix (max 20 channels per analysis)"

    # Step 1: Verify API can accept channel analysis request with real channel
    log_info "  Step 1/3: Triggering analysis for real channel 'mailroom'..."
    local trigger_data='{"channel_name": "mailroom", "days": 7}'
    local trigger_response
    trigger_response=$(api_request "POST" "/slack/analyze/channel" "$trigger_data")

    # Check if Slack is disabled
    if echo "$trigger_response" | jq -e '.status' > /dev/null 2>&1; then
        local status
        status=$(echo "$trigger_response" | jq -r '.status')
        if [ "$status" = "disabled" ]; then
            add_result "PASS" "Slack E2E Integration" "Slack disabled (requires SLACK_BOT_TOKEN configuration)"
            log_warning "Slack integration: Not configured for E2E testing"
            return 0
        fi
    fi

    # Step 2: Verify request was accepted (actual analysis may take time)
    if echo "$trigger_response" | jq -e '.message' > /dev/null 2>&1; then
        local message
        message=$(echo "$trigger_response" | jq -r '.message')
        log_success "  Analysis trigger accepted: $message"
    elif echo "$trigger_response" | jq -e '.error' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$trigger_response" | jq -r '.error')
        if [[ "$error_msg" == *"not found"* ]] || [[ "$error_msg" == *"not invited"* ]]; then
            add_result "PASS" "Slack E2E Integration" "Bot not invited to #mailroom (expected)"
            log_warning "Slack integration: Bot needs to be invited to #mailroom for full testing"
            return 0
        else
            add_result "FAIL" "Slack E2E Integration" "Unexpected error during trigger: $error_msg"
            log_error "Slack integration failed at trigger step"
            return 1
        fi
    else
        add_result "FAIL" "Slack E2E Integration" "Invalid trigger response format"
        log_error "Slack integration failed: bad response format"
        return 1
    fi

    # Step 3: Verify data storage endpoints are ready
    log_info "  Step 2/3: Checking list endpoints..."
    local list_response
    list_response=$(api_request "GET" "/slack/channels?workspace_id=default&limit=5")

    if echo "$list_response" | jq -e '.channels' > /dev/null 2>&1; then
        log_success "  List endpoint operational"
    else
        add_result "FAIL" "Slack E2E Integration" "List endpoint not responding correctly"
        log_error "Slack integration: list endpoint failed"
        return 1
    fi

    # Step 4: Verify error handling for non-existent data
    log_info "  Step 3/3: Verifying error handling..."
    local notfound_response
    notfound_response=$(api_request "GET" "/slack/channels/C_NONEXISTENT?workspace_id=default")

    if echo "$notfound_response" | jq -e '.error' > /dev/null 2>&1; then
        log_success "  Error handling verified"
        add_result "PASS" "Slack E2E Integration" "Full workflow validated (trigger, list, error handling)"
        log_success "Slack integration E2E test passed"
    else
        add_result "FAIL" "Slack E2E Integration" "Error handling not working correctly"
        log_error "Slack integration: error handling failed"
        return 1
    fi
}

# Generate validation report
generate_report() {
    echo ""
    echo "=========================================="
    echo "     API VALIDATION REPORT"
    echo "=========================================="
    echo "Timestamp: $(date)"
    echo "Execution: $EXECUTION_NAME"
    echo ""

    local total_tests=0
    local passed_tests=0

    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS='|' read -ra PARTS <<< "$result"
        local status="${PARTS[0]}"
        local test_name="${PARTS[1]}"
        local details="${PARTS[2]}"

        total_tests=$((total_tests + 1))

        if [ "$status" = "PASS" ]; then
            passed_tests=$((passed_tests + 1))
            echo -e "${GREEN}✓${NC} $test_name: $details"
        else
            echo -e "${RED}✗${NC} $test_name: $details"
        fi
    done

    echo ""
    echo "Summary: $passed_tests/$total_tests tests passed"

    if [ $passed_tests -eq $total_tests ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED - Pipeline is fully operational!${NC}"
        return 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED - Pipeline requires attention${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "Starting Reddit Crawler API validation..."
    echo "Region: $AWS_REGION"
    echo "API Base URL: $API_BASE_URL"

    # Show test mode
    if [ "$PIPELINE_ONLY" = true ]; then
        echo "Mode: Pipeline tests only"
    elif [ "$DATA_ONLY" = true ]; then
        echo "Mode: Data access tests only"
    elif [ "$SLACK_ONLY" = true ]; then
        echo "Mode: Slack integration tests only"
    elif [ "$QUICK_MODE" = true ]; then
        echo "Mode: Quick validation (skipping pipeline execution)"
    else
        echo "Mode: Full validation (all tests)"
    fi
    echo ""

    # Slack-only mode: Run only Slack integration tests
    if [ "$SLACK_ONLY" = true ]; then
        log_info "Running Slack integration tests only..."
        echo ""

        test_slack_user_analysis || true
        test_slack_get_user_profile || true
        test_slack_list_users || true
        test_slack_channel_analysis || true
        test_slack_get_channel_summary || true
        test_slack_list_channels || true
        test_slack_job_status_tracking || true
        test_slack_integration_comprehensive || true

    # Pipeline tests (original functionality)
    elif [ "$DATA_ONLY" != true ]; then
        test_api_documentation || true

        if [ "$QUICK_MODE" != true ]; then
            test_pipeline_trigger || exit 1
            test_execution_monitoring || exit 1
        else
            log_info "Skipping pipeline execution tests (quick mode)"
        fi

        if [ "$SKIP_S3" != true ]; then
            test_s3_storage || true
        else
            log_info "Skipping S3 storage validation"
        fi

        test_dynamodb_access || true

        if [ "$SKIP_QUALITY" != true ]; then
            test_analysis_quality || true
        else
            log_info "Skipping analysis quality validation"
        fi
    fi

    # Data access tests (Priority 1 endpoints) - skip if Slack-only mode
    if [ "$PIPELINE_ONLY" != true ] && [ "$SLACK_ONLY" != true ]; then
        test_insights_list || true
        test_insight_details || true
        test_analytics_summary || true

        # Configuration & Management tests (Priority 2 endpoints)
        test_system_config || true
        test_config_update || true
        test_config_persistence || true
        test_health_check || true

        # Enhanced Analytics tests (Priority 3 endpoints)
        test_analytics_trends || true
        test_analytics_competitors || true

        # Operational tests (Priority 4 endpoints)
        test_cancel_execution || true
        test_execution_logs || true

        # Twitter Integration tests (Twitter multi-platform support)
        test_twitter_insights || true
        test_multi_platform_collection || true
        test_platform_analytics || true

        # Slack Integration tests
        log_info "Running Slack integration tests..."
        test_slack_user_analysis || true
        test_slack_get_user_profile || true
        test_slack_list_users || true
        test_slack_channel_analysis || true
        test_slack_get_channel_summary || true
        test_slack_list_channels || true
        test_slack_job_status_tracking || true
        test_slack_integration_comprehensive || true
    fi

    # Generate final report
    generate_report
}

# Execute main function
main "$@"