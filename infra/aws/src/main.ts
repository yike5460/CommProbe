import { App, Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaPython from '@aws-cdk/aws-lambda-python-alpha';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export class LegalCrawlerStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // ===========================================
    // Get Reddit API credentials from context
    // ===========================================
    const redditClientId = this.node.tryGetContext('redditClientId');
    const redditClientSecret = this.node.tryGetContext('redditClientSecret');
    
    if (!redditClientId || !redditClientSecret) {
      throw new Error(
        'Reddit API credentials are required. Please provide them using:\n' +
        'npx cdk deploy --context redditClientId=YOUR_CLIENT_ID --context redditClientSecret=YOUR_CLIENT_SECRET\n' +
        'Or set them in cdk.json under "context" section.'
      );
    }

    // ===========================================
    // S3 Buckets
    // ===========================================
    const rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
      bucketName: `supio-raw-data-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldData',
          expiration: Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY, // For dev - change to RETAIN for production
      autoDeleteObjects: true, // For dev - remove for production
    });

    // ===========================================
    // DynamoDB Table
    // ===========================================
    const insightsTable = new dynamodb.Table(this, 'SupioInsights', {
      tableName: 'supio-insights',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY, // For dev - change to RETAIN for production
      pointInTimeRecovery: true,
    });

    // Add GSI for priority access
    insightsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // ===========================================
    // Lambda Layer for Python Dependencies
    // ===========================================
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/layer'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output/python && cp -au . /asset-output/',
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Dependencies for Reddit crawler Lambda functions',
    });

    // ===========================================
    // Lambda Functions
    // ===========================================
    
    // Collector Lambda
    const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/collector')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        REDDIT_CLIENT_ID: redditClientId,
        REDDIT_CLIENT_SECRET: redditClientSecret,
        REDDIT_USER_AGENT: this.node.tryGetContext('redditUserAgent') || 'legal-crawler/1.0',
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant S3 permissions to collector
    rawDataBucket.grantReadWrite(collectorFunction);

    // Analyzer Lambda (Bedrock integration)
    const analyzerFunction = new lambda.Function(this, 'AnalyzerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/analyzer')),
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      memorySize: 2048,
      environment: {
        BUCKET_NAME: rawDataBucket.bucketName,
        MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Bedrock permissions to analyzer
    analyzerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        ],
      })
    );

    // Grant S3 permissions to analyzer
    rawDataBucket.grantRead(analyzerFunction);

    // Storer Lambda (DynamoDB writer)
    const storerFunction = new lambda.Function(this, 'StorerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/storer')),
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      memorySize: 512,
      environment: {
        TABLE_NAME: insightsTable.tableName,
      },
      layers: [dependenciesLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB permissions to storer
    insightsTable.grantReadWriteData(storerFunction);

    // ===========================================
    // Step Functions State Machine
    // ===========================================
    
    // Task definitions
    const collectTask = new sfnTasks.LambdaInvoke(this, 'CollectPosts', {
      lambdaFunction: collectorFunction,
      outputPath: '$.Payload',
    });

    const analyzeTask = new sfnTasks.LambdaInvoke(this, 'AnalyzePosts', {
      lambdaFunction: analyzerFunction,
      outputPath: '$.Payload',
    });

    const storeTask = new sfnTasks.LambdaInvoke(this, 'StoreInsights', {
      lambdaFunction: storerFunction,
      outputPath: '$.Payload',
    });

    // Chain the tasks
    const definition = collectTask
      .next(analyzeTask)
      .next(storeTask);

    // Create state machine
    const stateMachine = new sfn.StateMachine(this, 'RedditInsightsPipeline', {
      definition,
      timeout: Duration.hours(1),
      stateMachineName: 'supio-reddit-insights-pipeline',
      logs: {
        destination: new logs.LogGroup(this, 'StateMachineLogGroup', {
          retention: logs.RetentionDays.ONE_WEEK,
        }),
        level: sfn.LogLevel.ALL,
      },
    });

    // ===========================================
    // EventBridge Scheduling
    // ===========================================
    
    // Weekly schedule for Reddit collection
    new events.Rule(this, 'WeeklyRedditCollection', {
      ruleName: 'supio-weekly-reddit-insights',
      description: 'Trigger Reddit collection every Monday morning',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        weekDay: 'MON',
      }),
      targets: [new eventsTargets.SfnStateMachine(stateMachine)],
    });

    // ===========================================
    // Manual Trigger Lambda (optional)
    // ===========================================
    
    const triggerFunction = new lambda.Function(this, 'TriggerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromInline(`
import boto3
import json
import os

def handler(event, context):
    """Manually trigger the Step Functions state machine"""
    sfn = boto3.client('stepfunctions')
    
    response = sfn.start_execution(
        stateMachineArn=os.environ['STATE_MACHINE_ARN'],
        input=json.dumps({
            'manual_trigger': True,
            'trigger_time': context.aws_request_id
        })
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'executionArn': response['executionArn'],
            'startDate': str(response['startDate'])
        })
    }
      `),
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      environment: {
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permission to trigger state machine
    stateMachine.grantStartExecution(triggerFunction);
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const app = new App();

new LegalCrawlerStack(app, 'legal-crawler-dev', { env: devEnv });

app.synth();