"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentFlowAiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const opensearch = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
class ContentFlowAiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Tables
        this.createDynamoDBTables();
        // S3 Buckets
        this.createS3Buckets();
        // Cognito User Pool
        this.createCognitoUserPool();
        // API Gateway
        this.createApiGateway();
        // SQS Queues
        this.createSQSQueues();
        // SNS Topics
        this.createSNSTopics();
        // EventBridge
        this.createEventBridge();
        // OpenSearch for Analytics
        this.createOpenSearchCluster();
        // CloudWatch Log Groups
        this.createCloudWatchLogGroups();
        // IAM Roles and Policies
        this.createIAMRoles();
        // Outputs
        this.createOutputs();
    }
    createDynamoDBTables() {
        // Users Table
        this.userTable = new dynamodb.Table(this, 'UsersTable', {
            tableName: 'contentflow-users',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Add GSI for email lookup
        this.userTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
        });
        // Content Ideas Table
        this.contentIdeasTable = new dynamodb.Table(this, 'ContentIdeasTable', {
            tableName: 'contentflow-content-ideas',
            partitionKey: { name: 'ideaId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for user-based queries
        this.contentIdeasTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
        });
        // Generated Content Table
        this.generatedContentTable = new dynamodb.Table(this, 'GeneratedContentTable', {
            tableName: 'contentflow-generated-content',
            partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for user and idea-based queries
        this.generatedContentTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
        });
        this.generatedContentTable.addGlobalSecondaryIndex({
            indexName: 'IdeaIdIndex',
            partitionKey: { name: 'ideaId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
        });
        // Engagement Feedback Table
        this.engagementFeedbackTable = new dynamodb.Table(this, 'EngagementFeedbackTable', {
            tableName: 'contentflow-engagement-feedback',
            partitionKey: { name: 'feedbackId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for content and user-based queries
        this.engagementFeedbackTable.addGlobalSecondaryIndex({
            indexName: 'ContentIdIndex',
            partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
        });
        this.engagementFeedbackTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
        });
        // Audience Profiles Table
        this.audienceProfilesTable = new dynamodb.Table(this, 'AudienceProfilesTable', {
            tableName: 'contentflow-audience-profiles',
            partitionKey: { name: 'profileId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Add GSI for user-based queries
        this.audienceProfilesTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING },
        });
    }
    createS3Buckets() {
        // Content Storage Bucket
        this.contentStorageBucket = new s3.Bucket(this, 'ContentStorageBucket', {
            bucketName: `contentflow-content-storage-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldVersions',
                    enabled: true,
                    noncurrentVersionExpiration: cdk.Duration.days(90),
                },
            ],
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedOrigins: ['*'], // Restrict in production
                    allowedHeaders: ['*'],
                    maxAge: 3000,
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
        });
        // Analytics Bucket
        this.analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
            bucketName: `contentflow-analytics-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            lifecycleRules: [
                {
                    id: 'ArchiveOldData',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
    createCognitoUserPool() {
        this.userPool = new cognito.UserPool(this, 'ContentFlowUserPool', {
            userPoolName: 'contentflow-users',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                givenName: {
                    required: false,
                    mutable: true,
                },
                familyName: {
                    required: false,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.userPoolClient = new cognito.UserPoolClient(this, 'ContentFlowUserPoolClient', {
            userPool: this.userPool,
            userPoolClientName: 'contentflow-web-client',
            generateSecret: false,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
            },
            refreshTokenValidity: cdk.Duration.days(30),
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
        });
    }
    createApiGateway() {
        this.api = new apigateway.RestApi(this, 'ContentFlowApi', {
            restApiName: 'ContentFlow AI API',
            description: 'API for ContentFlow AI content generation platform',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict in production
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                    'X-Amz-User-Agent',
                ],
            },
            deployOptions: {
                stageName: 'prod',
                throttle: {
                    rateLimit: 1000,
                    burstLimit: 2000,
                },
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
            },
        });
        // Create API resource structure
        const authResource = this.api.root.addResource('auth');
        const contentResource = this.api.root.addResource('content');
        const audienceResource = this.api.root.addResource('audience');
        const platformResource = this.api.root.addResource('platform');
        const feedbackResource = this.api.root.addResource('feedback');
        const analyticsResource = this.api.root.addResource('analytics');
        // Add nested resources
        authResource.addResource('register');
        authResource.addResource('login');
        authResource.addResource('profile');
        contentResource.addResource('generate');
        contentResource.addResource('history');
        contentResource.addResource('{id}');
        audienceResource.addResource('analyze');
        audienceResource.addResource('profile');
        platformResource.addResource('optimize');
        platformResource.addResource('templates');
        platformResource.addResource('guidelines');
        feedbackResource.addResource('submit');
        feedbackResource.addResource('analytics');
        feedbackResource.addResource('insights');
        analyticsResource.addResource('dashboard');
        analyticsResource.addResource('reports');
    }
    createSQSQueues() {
        // Content Generation Queue
        const contentGenerationQueue = new sqs.Queue(this, 'ContentGenerationQueue', {
            queueName: 'contentflow-content-generation',
            visibilityTimeout: cdk.Duration.minutes(15),
            messageRetentionPeriod: cdk.Duration.days(14),
            deadLetterQueue: {
                queue: new sqs.Queue(this, 'ContentGenerationDLQ', {
                    queueName: 'contentflow-content-generation-dlq',
                }),
                maxReceiveCount: 3,
            },
        });
        // Feedback Processing Queue
        const feedbackProcessingQueue = new sqs.Queue(this, 'FeedbackProcessingQueue', {
            queueName: 'contentflow-feedback-processing',
            visibilityTimeout: cdk.Duration.minutes(10),
            messageRetentionPeriod: cdk.Duration.days(14),
            deadLetterQueue: {
                queue: new sqs.Queue(this, 'FeedbackProcessingDLQ', {
                    queueName: 'contentflow-feedback-processing-dlq',
                }),
                maxReceiveCount: 3,
            },
        });
        // Analytics Processing Queue
        const analyticsProcessingQueue = new sqs.Queue(this, 'AnalyticsProcessingQueue', {
            queueName: 'contentflow-analytics-processing',
            visibilityTimeout: cdk.Duration.minutes(5),
            messageRetentionPeriod: cdk.Duration.days(7),
        });
    }
    createSNSTopics() {
        // Content Generation Notifications
        const contentGenerationTopic = new sns.Topic(this, 'ContentGenerationTopic', {
            topicName: 'contentflow-content-generation',
            displayName: 'ContentFlow Content Generation Notifications',
        });
        // Feedback Notifications
        const feedbackTopic = new sns.Topic(this, 'FeedbackTopic', {
            topicName: 'contentflow-feedback',
            displayName: 'ContentFlow Feedback Notifications',
        });
        // System Alerts
        const systemAlertsTopic = new sns.Topic(this, 'SystemAlertsTopic', {
            topicName: 'contentflow-system-alerts',
            displayName: 'ContentFlow System Alerts',
        });
    }
    createEventBridge() {
        // Custom Event Bus for ContentFlow events
        const contentFlowEventBus = new events.EventBus(this, 'ContentFlowEventBus', {
            eventBusName: 'contentflow-events',
        });
        // Event rules can be added here for specific event patterns
    }
    createOpenSearchCluster() {
        // OpenSearch Serverless Collection for Analytics
        const analyticsCollection = new opensearch.CfnCollection(this, 'AnalyticsCollection', {
            name: 'contentflow-analytics',
            type: 'SEARCH',
            description: 'OpenSearch collection for ContentFlow analytics and insights',
        });
        // Security policy for the collection
        const securityPolicy = new opensearch.CfnSecurityPolicy(this, 'AnalyticsSecurityPolicy', {
            name: 'contentflow-analytics-security-policy',
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${analyticsCollection.name}`],
                    },
                ],
                AWSOwnedKey: true,
            }),
        });
        analyticsCollection.addDependency(securityPolicy);
    }
    createCloudWatchLogGroups() {
        // API Gateway Log Group
        new logs.LogGroup(this, 'ApiGatewayLogGroup', {
            logGroupName: '/aws/apigateway/contentflow-ai',
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Lambda Log Groups (will be created automatically by Lambda functions)
        const lambdaLogGroups = [
            'auth-service',
            'content-generation-service',
            'audience-analysis-service',
            'platform-optimization-service',
            'feedback-processing-service',
            'analytics-service',
        ];
        lambdaLogGroups.forEach((serviceName) => {
            new logs.LogGroup(this, `${serviceName}LogGroup`, {
                logGroupName: `/aws/lambda/contentflow-${serviceName}`,
                retention: logs.RetentionDays.ONE_MONTH,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
        });
    }
    createIAMRoles() {
        // Lambda Execution Role with necessary permissions
        const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
            roleName: 'contentflow-lambda-execution-role',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Add permissions for DynamoDB
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
            ],
            resources: [
                this.userTable.tableArn,
                this.contentIdeasTable.tableArn,
                this.generatedContentTable.tableArn,
                this.engagementFeedbackTable.tableArn,
                this.audienceProfilesTable.tableArn,
                `${this.userTable.tableArn}/index/*`,
                `${this.contentIdeasTable.tableArn}/index/*`,
                `${this.generatedContentTable.tableArn}/index/*`,
                `${this.engagementFeedbackTable.tableArn}/index/*`,
                `${this.audienceProfilesTable.tableArn}/index/*`,
            ],
        }));
        // Add permissions for S3
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
            ],
            resources: [
                this.contentStorageBucket.bucketArn,
                `${this.contentStorageBucket.bucketArn}/*`,
                this.analyticsBucket.bucketArn,
                `${this.analyticsBucket.bucketArn}/*`,
            ],
        }));
        // Add permissions for Bedrock
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: ['*'], // Bedrock models don't have specific ARNs
        }));
        // Add permissions for Comprehend
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'comprehend:DetectSentiment',
                'comprehend:DetectEntities',
                'comprehend:DetectKeyPhrases',
                'comprehend:DetectLanguage',
            ],
            resources: ['*'],
        }));
        // Add permissions for SQS
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: ['arn:aws:sqs:*:*:contentflow-*'],
        }));
        // Add permissions for SNS
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sns:Publish',
            ],
            resources: ['arn:aws:sns:*:*:contentflow-*'],
        }));
        // Add permissions for EventBridge
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'events:PutEvents',
            ],
            resources: ['arn:aws:events:*:*:event-bus/contentflow-*'],
        }));
        // Add permissions for Cognito
        lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:ListUsers',
            ],
            resources: [this.userPool.userPoolArn],
        }));
    }
    createOutputs() {
        // API Gateway URL
        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.api.url,
            description: 'ContentFlow AI API Gateway URL',
            exportName: 'ContentFlowApiUrl',
        });
        // User Pool ID
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: 'ContentFlowUserPoolId',
        });
        // User Pool Client ID
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: 'ContentFlowUserPoolClientId',
        });
        // DynamoDB Table Names
        new cdk.CfnOutput(this, 'UsersTableName', {
            value: this.userTable.tableName,
            description: 'Users DynamoDB Table Name',
            exportName: 'ContentFlowUsersTableName',
        });
        new cdk.CfnOutput(this, 'ContentIdeasTableName', {
            value: this.contentIdeasTable.tableName,
            description: 'Content Ideas DynamoDB Table Name',
            exportName: 'ContentFlowContentIdeasTableName',
        });
        new cdk.CfnOutput(this, 'GeneratedContentTableName', {
            value: this.generatedContentTable.tableName,
            description: 'Generated Content DynamoDB Table Name',
            exportName: 'ContentFlowGeneratedContentTableName',
        });
        // S3 Bucket Names
        new cdk.CfnOutput(this, 'ContentStorageBucketName', {
            value: this.contentStorageBucket.bucketName,
            description: 'Content Storage S3 Bucket Name',
            exportName: 'ContentFlowContentStorageBucketName',
        });
        new cdk.CfnOutput(this, 'AnalyticsBucketName', {
            value: this.analyticsBucket.bucketName,
            description: 'Analytics S3 Bucket Name',
            exportName: 'ContentFlowAnalyticsBucketName',
        });
    }
}
exports.ContentFlowAiStack = ContentFlowAiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudGZsb3ctYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb250ZW50Zmxvdy1haS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBQ3JELHVEQUF5QztBQUN6Qyx1RUFBeUQ7QUFFekQseURBQTJDO0FBQzNDLDJEQUE2QztBQUM3QyxpRUFBbUQ7QUFDbkQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsaUZBQW1FO0FBR25FLE1BQWEsa0JBQW1CLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFZL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFFNUIsYUFBYTtRQUNiLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUV2QixvQkFBb0I7UUFDcEIsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFFN0IsY0FBYztRQUNkLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRXhCLGFBQWE7UUFDYixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFdkIsYUFBYTtRQUNiLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUV2QixjQUFjO1FBQ2QsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsMkJBQTJCO1FBQzNCLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBRS9CLHdCQUF3QjtRQUN4QixJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUVqQyx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRXRCLFVBQVU7UUFDVixJQUFJLENBQUMsYUFBYSxFQUFF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RSxzQ0FBc0M7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsa0JBQWtCO1FBQ2xCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMEJBQTBCLEVBQUU7WUFDbEQsS0FBSyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVO1lBQzNDLFdBQVcsRUFBRSxnQ0FBZ0M7WUFDN0MsVUFBVSxFQUFFLHFDQUFxQztTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVU7WUFDdEMsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsZ0NBQWdDO1NBQzdDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTltQkQsZ0RBOG1CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XHJcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcclxuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xyXG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmVybGVzcyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIENvbnRlbnRGbG93QWlTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbnRlbnRJZGVhc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZ2VuZXJhdGVkQ29udGVudFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZW5nYWdlbWVudEZlZWRiYWNrVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSBhdWRpZW5jZVByb2ZpbGVzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSBjb250ZW50U3RvcmFnZUJ1Y2tldDogczMuQnVja2V0O1xyXG4gIHB1YmxpYyByZWFkb25seSBhbmFseXRpY3NCdWNrZXQ6IHMzLkJ1Y2tldDtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gRHluYW1vREIgVGFibGVzXHJcbiAgICB0aGlzLmNyZWF0ZUR5bmFtb0RCVGFibGVzKCk7XHJcblxyXG4gICAgLy8gUzMgQnVja2V0c1xyXG4gICAgdGhpcy5jcmVhdGVTM0J1Y2tldHMoKTtcclxuXHJcbiAgICAvLyBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgdGhpcy5jcmVhdGVDb2duaXRvVXNlclBvb2woKTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheVxyXG4gICAgdGhpcy5jcmVhdGVBcGlHYXRld2F5KCk7XHJcblxyXG4gICAgLy8gU1FTIFF1ZXVlc1xyXG4gICAgdGhpcy5jcmVhdGVTUVNRdWV1ZXMoKTtcclxuXHJcbiAgICAvLyBTTlMgVG9waWNzXHJcbiAgICB0aGlzLmNyZWF0ZVNOU1RvcGljcygpO1xyXG5cclxuICAgIC8vIEV2ZW50QnJpZGdlXHJcbiAgICB0aGlzLmNyZWF0ZUV2ZW50QnJpZGdlKCk7XHJcblxyXG4gICAgLy8gT3BlblNlYXJjaCBmb3IgQW5hbHl0aWNzXHJcbiAgICB0aGlzLmNyZWF0ZU9wZW5TZWFyY2hDbHVzdGVyKCk7XHJcblxyXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXBzXHJcbiAgICB0aGlzLmNyZWF0ZUNsb3VkV2F0Y2hMb2dHcm91cHMoKTtcclxuXHJcbiAgICAvLyBJQU0gUm9sZXMgYW5kIFBvbGljaWVzXHJcbiAgICB0aGlzLmNyZWF0ZUlBTVJvbGVzKCk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgdGhpcy5jcmVhdGVPdXRwdXRzKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNyZWF0ZUR5bmFtb0RCVGFibGVzKCkge1xyXG4gICAgLy8gVXNlcnMgVGFibGVcclxuICAgIHRoaXMudXNlclRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdVc2Vyc1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdjb250ZW50Zmxvdy11c2VycycsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxyXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBDaGFuZ2UgdG8gUkVUQUlOIGZvciBwcm9kdWN0aW9uXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgR1NJIGZvciBlbWFpbCBsb29rdXBcclxuICAgIHRoaXMudXNlclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRW1haWxJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29udGVudCBJZGVhcyBUYWJsZVxyXG4gICAgdGhpcy5jb250ZW50SWRlYXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQ29udGVudElkZWFzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ2NvbnRlbnRmbG93LWNvbnRlbnQtaWRlYXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkZWFJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcclxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBHU0kgZm9yIHVzZXItYmFzZWQgcXVlcmllc1xyXG4gICAgdGhpcy5jb250ZW50SWRlYXNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1VzZXJJZEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR2VuZXJhdGVkIENvbnRlbnQgVGFibGVcclxuICAgIHRoaXMuZ2VuZXJhdGVkQ29udGVudFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdHZW5lcmF0ZWRDb250ZW50VGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ2NvbnRlbnRmbG93LWdlbmVyYXRlZC1jb250ZW50JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjb250ZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd2ZXJzaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxyXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIEdTSSBmb3IgdXNlciBhbmQgaWRlYS1iYXNlZCBxdWVyaWVzXHJcbiAgICB0aGlzLmdlbmVyYXRlZENvbnRlbnRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ1VzZXJJZEluZGV4JyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd1c2VySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkQXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5nZW5lcmF0ZWRDb250ZW50VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdJZGVhSWRJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWRlYUlkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEVuZ2FnZW1lbnQgRmVlZGJhY2sgVGFibGVcclxuICAgIHRoaXMuZW5nYWdlbWVudEZlZWRiYWNrVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0VuZ2FnZW1lbnRGZWVkYmFja1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdjb250ZW50Zmxvdy1lbmdhZ2VtZW50LWZlZWRiYWNrJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdmZWVkYmFja0lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxyXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIEdTSSBmb3IgY29udGVudCBhbmQgdXNlci1iYXNlZCBxdWVyaWVzXHJcbiAgICB0aGlzLmVuZ2FnZW1lbnRGZWVkYmFja1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnQ29udGVudElkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NvbnRlbnRJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmVuZ2FnZW1lbnRGZWVkYmFja1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnVXNlcklkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBdWRpZW5jZSBQcm9maWxlcyBUYWJsZVxyXG4gICAgdGhpcy5hdWRpZW5jZVByb2ZpbGVzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0F1ZGllbmNlUHJvZmlsZXNUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnY29udGVudGZsb3ctYXVkaWVuY2UtcHJvZmlsZXMnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Byb2ZpbGVJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcclxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBHU0kgZm9yIHVzZXItYmFzZWQgcXVlcmllc1xyXG4gICAgdGhpcy5hdWRpZW5jZVByb2ZpbGVzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICdVc2VySWRJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiAndXBkYXRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVTM0J1Y2tldHMoKSB7XHJcbiAgICAvLyBDb250ZW50IFN0b3JhZ2UgQnVja2V0XHJcbiAgICB0aGlzLmNvbnRlbnRTdG9yYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQ29udGVudFN0b3JhZ2VCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBjb250ZW50Zmxvdy1jb250ZW50LXN0b3JhZ2UtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcclxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxyXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXHJcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXHJcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgICAgY29yczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxyXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLCAvLyBSZXN0cmljdCBpbiBwcm9kdWN0aW9uXHJcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXHJcbiAgICAgICAgICBtYXhBZ2U6IDMwMDAsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gQ2hhbmdlIHRvIFJFVEFJTiBmb3IgcHJvZHVjdGlvblxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQW5hbHl0aWNzIEJ1Y2tldFxyXG4gICAgdGhpcy5hbmFseXRpY3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBbmFseXRpY3NCdWNrZXQnLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGBjb250ZW50Zmxvdy1hbmFseXRpY3MtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcclxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxyXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZERhdGEnLFxyXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcclxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXHJcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlQ29nbml0b1VzZXJQb29sKCkge1xyXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdDb250ZW50Rmxvd1VzZXJQb29sJywge1xyXG4gICAgICB1c2VyUG9vbE5hbWU6ICdjb250ZW50Zmxvdy11c2VycycsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XHJcbiAgICAgICAgZW1haWw6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGF1dG9WZXJpZnk6IHtcclxuICAgICAgICBlbWFpbDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XHJcbiAgICAgICAgZW1haWw6IHtcclxuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdpdmVuTmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGZhbWlseU5hbWU6IHtcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIG11dGFibGU6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnQ29udGVudEZsb3dVc2VyUG9vbENsaWVudCcsIHtcclxuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXHJcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ2NvbnRlbnRmbG93LXdlYi1jbGllbnQnLFxyXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXHJcbiAgICAgIGF1dGhGbG93czoge1xyXG4gICAgICAgIHVzZXJQYXNzd29yZDogdHJ1ZSxcclxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBvQXV0aDoge1xyXG4gICAgICAgIGZsb3dzOiB7XHJcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2NvcGVzOiBbY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLCBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELCBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRV0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXHJcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcclxuICAgICAgaWRUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlQXBpR2F0ZXdheSgpIHtcclxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnQ29udGVudEZsb3dBcGknLCB7XHJcbiAgICAgIHJlc3RBcGlOYW1lOiAnQ29udGVudEZsb3cgQUkgQVBJJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIENvbnRlbnRGbG93IEFJIGNvbnRlbnQgZ2VuZXJhdGlvbiBwbGF0Zm9ybScsXHJcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLCAvLyBSZXN0cmljdCBpbiBwcm9kdWN0aW9uXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICAgICdYLUFtei1Vc2VyLUFnZW50JyxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXHJcbiAgICAgICAgdGhyb3R0bGU6IHtcclxuICAgICAgICAgIHJhdGVMaW1pdDogMTAwMCxcclxuICAgICAgICAgIGJ1cnN0TGltaXQ6IDIwMDAsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXHJcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBBUEkgcmVzb3VyY2Ugc3RydWN0dXJlXHJcbiAgICBjb25zdCBhdXRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XHJcbiAgICBjb25zdCBjb250ZW50UmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdjb250ZW50Jyk7XHJcbiAgICBjb25zdCBhdWRpZW5jZVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXVkaWVuY2UnKTtcclxuICAgIGNvbnN0IHBsYXRmb3JtUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdwbGF0Zm9ybScpO1xyXG4gICAgY29uc3QgZmVlZGJhY2tSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2ZlZWRiYWNrJyk7XHJcbiAgICBjb25zdCBhbmFseXRpY3NSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FuYWx5dGljcycpO1xyXG5cclxuICAgIC8vIEFkZCBuZXN0ZWQgcmVzb3VyY2VzXHJcbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3JlZ2lzdGVyJyk7XHJcbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2xvZ2luJyk7XHJcbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2ZpbGUnKTtcclxuXHJcbiAgICBjb250ZW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2dlbmVyYXRlJyk7XHJcbiAgICBjb250ZW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2hpc3RvcnknKTtcclxuICAgIGNvbnRlbnRSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG5cclxuICAgIGF1ZGllbmNlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FuYWx5emUnKTtcclxuICAgIGF1ZGllbmNlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Byb2ZpbGUnKTtcclxuXHJcbiAgICBwbGF0Zm9ybVJlc291cmNlLmFkZFJlc291cmNlKCdvcHRpbWl6ZScpO1xyXG4gICAgcGxhdGZvcm1SZXNvdXJjZS5hZGRSZXNvdXJjZSgndGVtcGxhdGVzJyk7XHJcbiAgICBwbGF0Zm9ybVJlc291cmNlLmFkZFJlc291cmNlKCdndWlkZWxpbmVzJyk7XHJcblxyXG4gICAgZmVlZGJhY2tSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VibWl0Jyk7XHJcbiAgICBmZWVkYmFja1Jlc291cmNlLmFkZFJlc291cmNlKCdhbmFseXRpY3MnKTtcclxuICAgIGZlZWRiYWNrUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2luc2lnaHRzJyk7XHJcblxyXG4gICAgYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Rhc2hib2FyZCcpO1xyXG4gICAgYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3JlcG9ydHMnKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlU1FTUXVldWVzKCkge1xyXG4gICAgLy8gQ29udGVudCBHZW5lcmF0aW9uIFF1ZXVlXHJcbiAgICBjb25zdCBjb250ZW50R2VuZXJhdGlvblF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnQ29udGVudEdlbmVyYXRpb25RdWV1ZScsIHtcclxuICAgICAgcXVldWVOYW1lOiAnY29udGVudGZsb3ctY29udGVudC1nZW5lcmF0aW9uJyxcclxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcclxuICAgICAgbWVzc2FnZVJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxyXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcclxuICAgICAgICBxdWV1ZTogbmV3IHNxcy5RdWV1ZSh0aGlzLCAnQ29udGVudEdlbmVyYXRpb25ETFEnLCB7XHJcbiAgICAgICAgICBxdWV1ZU5hbWU6ICdjb250ZW50Zmxvdy1jb250ZW50LWdlbmVyYXRpb24tZGxxJyxcclxuICAgICAgICB9KSxcclxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBGZWVkYmFjayBQcm9jZXNzaW5nIFF1ZXVlXHJcbiAgICBjb25zdCBmZWVkYmFja1Byb2Nlc3NpbmdRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0ZlZWRiYWNrUHJvY2Vzc2luZ1F1ZXVlJywge1xyXG4gICAgICBxdWV1ZU5hbWU6ICdjb250ZW50Zmxvdy1mZWVkYmFjay1wcm9jZXNzaW5nJyxcclxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDEwKSxcclxuICAgICAgbWVzc2FnZVJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxyXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcclxuICAgICAgICBxdWV1ZTogbmV3IHNxcy5RdWV1ZSh0aGlzLCAnRmVlZGJhY2tQcm9jZXNzaW5nRExRJywge1xyXG4gICAgICAgICAgcXVldWVOYW1lOiAnY29udGVudGZsb3ctZmVlZGJhY2stcHJvY2Vzc2luZy1kbHEnLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFuYWx5dGljcyBQcm9jZXNzaW5nIFF1ZXVlXHJcbiAgICBjb25zdCBhbmFseXRpY3NQcm9jZXNzaW5nUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdBbmFseXRpY3NQcm9jZXNzaW5nUXVldWUnLCB7XHJcbiAgICAgIHF1ZXVlTmFtZTogJ2NvbnRlbnRmbG93LWFuYWx5dGljcy1wcm9jZXNzaW5nJyxcclxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICBtZXNzYWdlUmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVTTlNUb3BpY3MoKSB7XHJcbiAgICAvLyBDb250ZW50IEdlbmVyYXRpb24gTm90aWZpY2F0aW9uc1xyXG4gICAgY29uc3QgY29udGVudEdlbmVyYXRpb25Ub3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0NvbnRlbnRHZW5lcmF0aW9uVG9waWMnLCB7XHJcbiAgICAgIHRvcGljTmFtZTogJ2NvbnRlbnRmbG93LWNvbnRlbnQtZ2VuZXJhdGlvbicsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiAnQ29udGVudEZsb3cgQ29udGVudCBHZW5lcmF0aW9uIE5vdGlmaWNhdGlvbnMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gRmVlZGJhY2sgTm90aWZpY2F0aW9uc1xyXG4gICAgY29uc3QgZmVlZGJhY2tUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0ZlZWRiYWNrVG9waWMnLCB7XHJcbiAgICAgIHRvcGljTmFtZTogJ2NvbnRlbnRmbG93LWZlZWRiYWNrJyxcclxuICAgICAgZGlzcGxheU5hbWU6ICdDb250ZW50RmxvdyBGZWVkYmFjayBOb3RpZmljYXRpb25zJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN5c3RlbSBBbGVydHNcclxuICAgIGNvbnN0IHN5c3RlbUFsZXJ0c1RvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnU3lzdGVtQWxlcnRzVG9waWMnLCB7XHJcbiAgICAgIHRvcGljTmFtZTogJ2NvbnRlbnRmbG93LXN5c3RlbS1hbGVydHMnLFxyXG4gICAgICBkaXNwbGF5TmFtZTogJ0NvbnRlbnRGbG93IFN5c3RlbSBBbGVydHMnLFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNyZWF0ZUV2ZW50QnJpZGdlKCkge1xyXG4gICAgLy8gQ3VzdG9tIEV2ZW50IEJ1cyBmb3IgQ29udGVudEZsb3cgZXZlbnRzXHJcbiAgICBjb25zdCBjb250ZW50Rmxvd0V2ZW50QnVzID0gbmV3IGV2ZW50cy5FdmVudEJ1cyh0aGlzLCAnQ29udGVudEZsb3dFdmVudEJ1cycsIHtcclxuICAgICAgZXZlbnRCdXNOYW1lOiAnY29udGVudGZsb3ctZXZlbnRzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEV2ZW50IHJ1bGVzIGNhbiBiZSBhZGRlZCBoZXJlIGZvciBzcGVjaWZpYyBldmVudCBwYXR0ZXJuc1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVPcGVuU2VhcmNoQ2x1c3RlcigpIHtcclxuICAgIC8vIE9wZW5TZWFyY2ggU2VydmVybGVzcyBDb2xsZWN0aW9uIGZvciBBbmFseXRpY3NcclxuICAgIGNvbnN0IGFuYWx5dGljc0NvbGxlY3Rpb24gPSBuZXcgb3BlbnNlYXJjaC5DZm5Db2xsZWN0aW9uKHRoaXMsICdBbmFseXRpY3NDb2xsZWN0aW9uJywge1xyXG4gICAgICBuYW1lOiAnY29udGVudGZsb3ctYW5hbHl0aWNzJyxcclxuICAgICAgdHlwZTogJ1NFQVJDSCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnT3BlblNlYXJjaCBjb2xsZWN0aW9uIGZvciBDb250ZW50RmxvdyBhbmFseXRpY3MgYW5kIGluc2lnaHRzJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNlY3VyaXR5IHBvbGljeSBmb3IgdGhlIGNvbGxlY3Rpb25cclxuICAgIGNvbnN0IHNlY3VyaXR5UG9saWN5ID0gbmV3IG9wZW5zZWFyY2guQ2ZuU2VjdXJpdHlQb2xpY3kodGhpcywgJ0FuYWx5dGljc1NlY3VyaXR5UG9saWN5Jywge1xyXG4gICAgICBuYW1lOiAnY29udGVudGZsb3ctYW5hbHl0aWNzLXNlY3VyaXR5LXBvbGljeScsXHJcbiAgICAgIHR5cGU6ICdlbmNyeXB0aW9uJyxcclxuICAgICAgcG9saWN5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgUnVsZXM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHthbmFseXRpY3NDb2xsZWN0aW9uLm5hbWV9YF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgQVdTT3duZWRLZXk6IHRydWUsXHJcbiAgICAgIH0pLFxyXG4gICAgfSk7XHJcblxyXG4gICAgYW5hbHl0aWNzQ29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KHNlY3VyaXR5UG9saWN5KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3JlYXRlQ2xvdWRXYXRjaExvZ0dyb3VwcygpIHtcclxuICAgIC8vIEFQSSBHYXRld2F5IExvZyBHcm91cFxyXG4gICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUdhdGV3YXlMb2dHcm91cCcsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiAnL2F3cy9hcGlnYXRld2F5L2NvbnRlbnRmbG93LWFpJyxcclxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIExvZyBHcm91cHMgKHdpbGwgYmUgY3JlYXRlZCBhdXRvbWF0aWNhbGx5IGJ5IExhbWJkYSBmdW5jdGlvbnMpXHJcbiAgICBjb25zdCBsYW1iZGFMb2dHcm91cHMgPSBbXHJcbiAgICAgICdhdXRoLXNlcnZpY2UnLFxyXG4gICAgICAnY29udGVudC1nZW5lcmF0aW9uLXNlcnZpY2UnLFxyXG4gICAgICAnYXVkaWVuY2UtYW5hbHlzaXMtc2VydmljZScsXHJcbiAgICAgICdwbGF0Zm9ybS1vcHRpbWl6YXRpb24tc2VydmljZScsXHJcbiAgICAgICdmZWVkYmFjay1wcm9jZXNzaW5nLXNlcnZpY2UnLFxyXG4gICAgICAnYW5hbHl0aWNzLXNlcnZpY2UnLFxyXG4gICAgXTtcclxuXHJcbiAgICBsYW1iZGFMb2dHcm91cHMuZm9yRWFjaCgoc2VydmljZU5hbWUpID0+IHtcclxuICAgICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgYCR7c2VydmljZU5hbWV9TG9nR3JvdXBgLCB7XHJcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvY29udGVudGZsb3ctJHtzZXJ2aWNlTmFtZX1gLFxyXG4gICAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcclxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVJQU1Sb2xlcygpIHtcclxuICAgIC8vIExhbWJkYSBFeGVjdXRpb24gUm9sZSB3aXRoIG5lY2Vzc2FyeSBwZXJtaXNzaW9uc1xyXG4gICAgY29uc3QgbGFtYmRhRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcclxuICAgICAgcm9sZU5hbWU6ICdjb250ZW50Zmxvdy1sYW1iZGEtZXhlY3V0aW9uLXJvbGUnLFxyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcclxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXHJcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIER5bmFtb0RCXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcclxuICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcclxuICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcclxuICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcclxuICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXHJcbiAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXHJcbiAgICAgICAgICAnZHluYW1vZGI6QmF0Y2hHZXRJdGVtJyxcclxuICAgICAgICAgICdkeW5hbW9kYjpCYXRjaFdyaXRlSXRlbScsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgIHRoaXMudXNlclRhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgdGhpcy5jb250ZW50SWRlYXNUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgIHRoaXMuZ2VuZXJhdGVkQ29udGVudFRhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgdGhpcy5lbmdhZ2VtZW50RmVlZGJhY2tUYWJsZS50YWJsZUFybixcclxuICAgICAgICAgIHRoaXMuYXVkaWVuY2VQcm9maWxlc1RhYmxlLnRhYmxlQXJuLFxyXG4gICAgICAgICAgYCR7dGhpcy51c2VyVGFibGUudGFibGVBcm59L2luZGV4LypgLFxyXG4gICAgICAgICAgYCR7dGhpcy5jb250ZW50SWRlYXNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXHJcbiAgICAgICAgICBgJHt0aGlzLmdlbmVyYXRlZENvbnRlbnRUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXHJcbiAgICAgICAgICBgJHt0aGlzLmVuZ2FnZW1lbnRGZWVkYmFja1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcclxuICAgICAgICAgIGAke3RoaXMuYXVkaWVuY2VQcm9maWxlc1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcclxuICAgICAgICBdLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBBZGQgcGVybWlzc2lvbnMgZm9yIFMzXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxyXG4gICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXHJcbiAgICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcclxuICAgICAgICAgICdzMzpMaXN0QnVja2V0JyxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgdGhpcy5jb250ZW50U3RvcmFnZUJ1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgICBgJHt0aGlzLmNvbnRlbnRTdG9yYWdlQnVja2V0LmJ1Y2tldEFybn0vKmAsXHJcbiAgICAgICAgICB0aGlzLmFuYWx5dGljc0J1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgICBgJHt0aGlzLmFuYWx5dGljc0J1Y2tldC5idWNrZXRBcm59LypgLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgQmVkcm9ja1xyXG4gICAgbGFtYmRhRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbScsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLCAvLyBCZWRyb2NrIG1vZGVscyBkb24ndCBoYXZlIHNwZWNpZmljIEFSTnNcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBDb21wcmVoZW5kXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdjb21wcmVoZW5kOkRldGVjdFNlbnRpbWVudCcsXHJcbiAgICAgICAgICAnY29tcHJlaGVuZDpEZXRlY3RFbnRpdGllcycsXHJcbiAgICAgICAgICAnY29tcHJlaGVuZDpEZXRlY3RLZXlQaHJhc2VzJyxcclxuICAgICAgICAgICdjb21wcmVoZW5kOkRldGVjdExhbmd1YWdlJyxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgU1FTXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdzcXM6U2VuZE1lc3NhZ2UnLFxyXG4gICAgICAgICAgJ3NxczpSZWNlaXZlTWVzc2FnZScsXHJcbiAgICAgICAgICAnc3FzOkRlbGV0ZU1lc3NhZ2UnLFxyXG4gICAgICAgICAgJ3NxczpHZXRRdWV1ZUF0dHJpYnV0ZXMnLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6c3FzOio6Kjpjb250ZW50Zmxvdy0qJ10sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgU05TXHJcbiAgICBsYW1iZGFFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdzbnM6UHVibGlzaCcsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpzbnM6KjoqOmNvbnRlbnRmbG93LSonXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gQWRkIHBlcm1pc3Npb25zIGZvciBFdmVudEJyaWRnZVxyXG4gICAgbGFtYmRhRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAnZXZlbnRzOlB1dEV2ZW50cycsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpldmVudHM6KjoqOmV2ZW50LWJ1cy9jb250ZW50Zmxvdy0qJ10sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyBmb3IgQ29nbml0b1xyXG4gICAgbGFtYmRhRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyJyxcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXHJcbiAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJyxcclxuICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXInLFxyXG4gICAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2VycycsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNyZWF0ZU91dHB1dHMoKSB7XHJcbiAgICAvLyBBUEkgR2F0ZXdheSBVUkxcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5VXJsJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbnRlbnRGbG93IEFJIEFQSSBHYXRld2F5IFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdDb250ZW50Rmxvd0FwaVVybCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBVc2VyIFBvb2wgSURcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0NvbnRlbnRGbG93VXNlclBvb2xJZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBVc2VyIFBvb2wgQ2xpZW50IElEXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQ29udGVudEZsb3dVc2VyUG9vbENsaWVudElkJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIER5bmFtb0RCIFRhYmxlIE5hbWVzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlcnNUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVXNlcnMgRHluYW1vREIgVGFibGUgTmFtZScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdDb250ZW50Rmxvd1VzZXJzVGFibGVOYW1lJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb250ZW50SWRlYXNUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmNvbnRlbnRJZGVhc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDb250ZW50IElkZWFzIER5bmFtb0RCIFRhYmxlIE5hbWUnLFxyXG4gICAgICBleHBvcnROYW1lOiAnQ29udGVudEZsb3dDb250ZW50SWRlYXNUYWJsZU5hbWUnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dlbmVyYXRlZENvbnRlbnRUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmdlbmVyYXRlZENvbnRlbnRUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2VuZXJhdGVkIENvbnRlbnQgRHluYW1vREIgVGFibGUgTmFtZScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdDb250ZW50Rmxvd0dlbmVyYXRlZENvbnRlbnRUYWJsZU5hbWUnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUzMgQnVja2V0IE5hbWVzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29udGVudFN0b3JhZ2VCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5jb250ZW50U3RvcmFnZUJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbnRlbnQgU3RvcmFnZSBTMyBCdWNrZXQgTmFtZScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdDb250ZW50Rmxvd0NvbnRlbnRTdG9yYWdlQnVja2V0TmFtZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW5hbHl0aWNzQnVja2V0TmFtZScsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYW5hbHl0aWNzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQW5hbHl0aWNzIFMzIEJ1Y2tldCBOYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ0NvbnRlbnRGbG93QW5hbHl0aWNzQnVja2V0TmFtZScsXHJcbiAgICB9KTtcclxuICB9XHJcbn0iXX0=