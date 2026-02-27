# ContentFlow AI

ContentFlow AI is an AI-driven platform that transforms a single content idea into personalized, platform-optimized content across multiple formats including blogs, social media posts, captions, and scripts. The system analyzes target audience, intent, and platform requirements to generate tailored content and continuously improves through engagement feedback learning.

## Architecture

The platform is built using AWS serverless technologies:

- **Compute**: AWS Lambda functions for all business logic
- **API Management**: Amazon API Gateway for REST API endpoints
- **Authentication**: Amazon Cognito for user management
- **AI Services**: Amazon Bedrock for content generation, Amazon Comprehend for text analysis
- **Storage**: DynamoDB for structured data, S3 for content storage, OpenSearch for analytics
- **Messaging**: SQS for asynchronous processing, SNS for notifications, EventBridge for event routing
- **Monitoring**: CloudWatch for logging and metrics, X-Ray for distributed tracing

## Project Structure

```
contentflow-ai/
├── bin/                    # CDK app entry point
│   └── contentflow-ai.ts
├── lib/                    # CDK stack definitions
│   └── contentflow-ai-stack.ts
├── src/                    # Source code
│   ├── types/             # TypeScript interfaces and types
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   └── index.ts
│   ├── services/          # AWS service clients and database layer
│   │   ├── aws-clients.ts
│   │   └── database.ts
│   └── lambda/            # Lambda function handlers (to be created)
├── test/                  # Test files
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── cdk.json              # CDK configuration
└── jest.config.js        # Jest test configuration
```

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- TypeScript installed (`npm install -g typescript`)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd contentflow-ai
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Configuration

### Environment Variables

The following environment variables need to be set:

```bash
# AWS Configuration
AWS_REGION=us-east-1
CDK_DEFAULT_ACCOUNT=<your-aws-account-id>
CDK_DEFAULT_REGION=us-east-1

# DynamoDB Table Names (set automatically by CDK)
USERS_TABLE_NAME=contentflow-users
CONTENT_IDEAS_TABLE_NAME=contentflow-content-ideas
GENERATED_CONTENT_TABLE_NAME=contentflow-generated-content
ENGAGEMENT_FEEDBACK_TABLE_NAME=contentflow-engagement-feedback
AUDIENCE_PROFILES_TABLE_NAME=contentflow-audience-profiles

# S3 Bucket Names (set automatically by CDK)
CONTENT_STORAGE_BUCKET_NAME=contentflow-content-storage-<account>-<region>
ANALYTICS_BUCKET_NAME=contentflow-analytics-<account>-<region>

# Security
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRATION_TIME=1h
PASSWORD_MIN_LENGTH=8

# API Configuration
CORS_ORIGINS=*
CONTENT_GENERATION_RATE_LIMIT=10
AUTH_RATE_LIMIT=5

# AI Models
BEDROCK_TEXT_GENERATION_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_TEXT_ANALYSIS_MODEL=anthropic.claude-3-haiku-20240307-v1:0
```

## Deployment

### Deploy to AWS

1. Bootstrap CDK (first time only):
```bash
cdk bootstrap
```

2. Deploy the stack:
```bash
npm run deploy
```

3. View the deployed resources:
```bash
cdk ls
```

### Local Development

1. Synthesize CloudFormation template:
```bash
npm run synth
```

2. Compare deployed stack with current state:
```bash
npm run diff
```

3. Run tests:
```bash
npm test
```

## AWS Resources Created

### DynamoDB Tables

1. **contentflow-users**: User profiles and preferences
2. **contentflow-content-ideas**: Original content ideas submitted by users
3. **contentflow-generated-content**: AI-generated content with versions
4. **contentflow-engagement-feedback**: Performance metrics and feedback
5. **contentflow-audience-profiles**: Audience analysis and segmentation data

### S3 Buckets

1. **contentflow-content-storage**: Stores generated content files
2. **contentflow-analytics**: Analytics data and reports

### API Gateway

- REST API with CORS enabled
- Rate limiting and throttling configured
- CloudWatch logging enabled

### Cognito User Pool

- Email-based authentication
- Password policy enforcement
- Account recovery via email

### SQS Queues

- Content generation processing queue
- Feedback processing queue
- Analytics processing queue
- Dead letter queues for error handling

### SNS Topics

- Content generation notifications
- Feedback notifications
- System alerts

### OpenSearch

- Serverless collection for analytics and insights

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile

### Content Generation
- `POST /content/generate` - Generate content from idea
- `GET /content/{id}` - Get generated content
- `PUT /content/{id}` - Update content
- `GET /content/history` - User content history

### Audience Analysis
- `POST /audience/analyze` - Analyze audience from content
- `GET /audience/profile/{userId}` - Get audience profile
- `PUT /audience/profile/{userId}` - Update audience profile

### Platform Optimization
- `POST /platform/optimize` - Optimize content for platform
- `GET /platform/templates` - Get platform templates
- `GET /platform/guidelines/{platform}` - Platform guidelines

### Feedback
- `POST /feedback/submit` - Submit engagement feedback
- `GET /feedback/analytics/{userId}` - User analytics
- `GET /feedback/insights` - Performance insights

### Analytics
- `GET /analytics/dashboard` - Analytics dashboard data
- `GET /analytics/reports` - Generate reports

## Data Models

### Core Entities

- **UserProfile**: User account and preferences
- **ContentIdea**: Original content concept from user
- **GeneratedContent**: AI-generated content with metadata
- **EngagementFeedback**: Performance metrics and user feedback
- **AudienceProfile**: Target audience characteristics and behavior

### Supported Platforms

- Blog posts
- Twitter/X
- Facebook
- Instagram
- LinkedIn
- YouTube
- TikTok

### Content Types

- Blog posts (800-2000 words)
- Social media posts (platform-specific limits)
- Captions with hashtags and CTAs
- Scripts with timing cues
- Email content
- Ad copy

## Security Features

- JWT-based authentication
- Data encryption at rest and in transit
- IAM roles with least privilege access
- API rate limiting and throttling
- Input validation and sanitization
- CORS configuration
- CloudWatch monitoring and alerting

## Monitoring and Logging

- CloudWatch Logs for all Lambda functions
- API Gateway access logging
- Performance metrics and alarms
- Error tracking and alerting
- Distributed tracing with X-Ray

## Development Guidelines

### Code Structure

- Use TypeScript for type safety
- Follow AWS Lambda best practices
- Implement proper error handling
- Use structured logging
- Write comprehensive tests

### Testing

- Unit tests for business logic
- Integration tests for AWS services
- Property-based tests for correctness
- Performance tests for scalability

### Deployment

- Use CDK for infrastructure as code
- Environment-specific configurations
- Blue-green deployments for zero downtime
- Automated rollback on failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team.