// Core data model interfaces for ContentFlow AI

export interface UserProfile {
  userId: string;
  email: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  brandVoice: string;
  targetAudience: AudienceProfile;
  preferredPlatforms: Platform[];
  contentStyle: string;
}

export interface ContentIdea {
  ideaId: string;
  userId: string;
  content: string;
  extractedThemes: string[];
  targetAudience: AudienceProfile;
  intent: ContentIntent;
  confidenceScore: number;
  createdAt: string;
}

export interface GeneratedContent {
  contentId: string;
  ideaId: string;
  userId: string;
  platform: Platform;
  contentType: ContentType;
  generatedText: string;
  metadata: ContentMetadata;
  version: number;
  status: ContentStatus;
  createdAt: string;
}

export interface ContentMetadata {
  wordCount: number;
  hashtags: string[];
  seoKeywords: string[];
  readingTime: number;
  characterCount?: number;
  timingCues?: TimingCue[];
  callToAction?: string;
  // Blog-specific metadata
  title?: string;
  metaDescription?: string;
  contentStructure?: any;
  // Social media-specific metadata
  platformOptimized?: boolean;
  engagementElements?: any;
  // Caption-specific metadata
  visualContent?: boolean;
  engagementOptimized?: boolean;
  emojiCount?: number;
  // Script-specific metadata
  scriptDuration?: number;
  scriptType?: string;
  speakerNotes?: boolean;
  estimatedWords?: number;
  // Quality and safety metadata
  qualityScore?: number;
  grammarScore?: number;
  coherenceScore?: number;
  safetyScore?: number;
  qualityIssues?: any[];
  safetyFlags?: any[];
  qualityRecommendations?: string[];
  // Platform optimization metadata
  optimizationTimestamp?: string;
  seoScore?: number;
  seoRecommendations?: string[];
  seoImprovements?: any[];
  engagementScore?: number;
  platformCompliance?: boolean;
  socialMediaRecommendations?: string[];
  bestPracticesApplied?: any[];
  brandVoiceApplied?: boolean;
  brandVoice?: string;
  brandVoiceConsistencyScore?: number;
  brandVoiceRecommendations?: string[];
  brandVoiceProcessingTime?: number;
  crossPlatformConsistency?: any;
  visualOptimized?: boolean;
  visualElements?: string[];
  scriptOptimized?: boolean;
  timingOptimized?: boolean;
  deliveryNotes?: string[];
  pacing?: string;
}

export interface TimingCue {
  timestamp: string;
  action: string;
  note: string;
}

export interface EngagementFeedback {
  feedbackId: string;
  contentId: string;
  userId: string;
  platform: Platform;
  metrics: EngagementMetrics;
  timestamp: string;
}

export interface EngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  clickThroughRate: number;
  engagementRate: number;
  impressions?: number;
  reach?: number;
}

export interface AudienceProfile {
  profileId: string;
  userId: string;
  demographics: Demographics;
  behaviorPatterns: BehaviorPatterns;
  updatedAt: string;
}

export interface Demographics {
  ageRange: string;
  location: string;
  interests: string[];
  gender?: string;
  income?: string;
  education?: string;
}

export interface BehaviorPatterns {
  preferredContentTypes: ContentType[];
  engagementTimes: string[];
  platformUsage: Record<Platform, PlatformUsage>;
}

export interface PlatformUsage {
  frequency: string;
  engagementRate: number;
  preferredContentLength: string;
  bestPostingTimes: string[];
}

// Enums and Union Types
export type Platform = 
  | 'blog' 
  | 'twitter' 
  | 'facebook' 
  | 'instagram' 
  | 'linkedin' 
  | 'youtube' 
  | 'tiktok';

export type ContentType = 
  | 'blog-post' 
  | 'social-post' 
  | 'caption' 
  | 'script' 
  | 'email' 
  | 'ad-copy';

export type ContentIntent = 
  | 'informational' 
  | 'promotional' 
  | 'educational' 
  | 'entertainment';

export type ContentStatus = 
  | 'draft' 
  | 'generated' 
  | 'reviewed' 
  | 'published' 
  | 'archived';

// API Request/Response Types
export interface ContentGenerationRequest {
  userId: string;
  contentIdea: string;
  targetPlatforms: Platform[];
  contentTypes: ContentType[];
  preferences?: UserPreferences;
  variationCount?: number;
  customizationOptions?: ContentCustomizationOptions;
}

export interface ContentCustomizationOptions {
  tone?: 'formal' | 'casual' | 'professional' | 'friendly' | 'authoritative' | 'conversational';
  length?: 'short' | 'medium' | 'long';
  style?: 'creative' | 'straightforward' | 'technical' | 'storytelling';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  includeCallToAction?: boolean;
  targetKeywords?: string[];
  avoidTopics?: string[];
}

export interface ContentGenerationResponse {
  requestId: string;
  generatedContent: GeneratedContent[];
  variations?: ContentVariation[];
  processingTime: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

export interface ContentVariation {
  variationId: string;
  contentId: string;
  generatedText: string;
  metadata: ContentMetadata;
  rankingScore: number;
  variationType: VariationType;
  customizationApplied: ContentCustomizationOptions;
  createdAt: string;
}

export type VariationType = 
  | 'tone-variation'
  | 'length-variation' 
  | 'style-variation'
  | 'format-variation'
  | 'keyword-variation';

export interface AuthenticationRequest {
  email: string;
  password: string;
}

export interface AuthenticationResponse {
  token: string;
  refreshToken: string;
  user: UserProfile;
  expiresIn: number;
}

export interface RegistrationRequest {
  email: string;
  password: string;
  preferences?: Partial<UserPreferences>;
}

export interface FeedbackSubmissionRequest {
  contentId: string;
  platform: Platform;
  metrics: EngagementMetrics;
  timestamp?: string;
}

export interface AnalyticsRequest {
  userId: string;
  dateRange: DateRange;
  platforms?: Platform[];
  contentTypes?: ContentType[];
}

export interface AnalyticsResponse {
  userId: string;
  dateRange: DateRange;
  totalContent: number;
  totalEngagement: number;
  platformBreakdown: Record<Platform, PlatformAnalytics>;
  trends: AnalyticsTrend[];
  insights: string[];
}

export interface PlatformAnalytics {
  contentCount: number;
  totalEngagement: number;
  averageEngagementRate: number;
  topPerformingContent: GeneratedContent[];
}

export interface AnalyticsTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  period: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ValidationError extends APIError {
  field: string;
  value: any;
  constraint: string;
}

// Lambda Event Types
export interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  pathParameters: Record<string, string> | null;
  queryStringParameters: Record<string, string> | null;
  headers: Record<string, string>;
  body: string | null;
  requestContext: {
    requestId: string;
    identity: {
      sourceIp: string;
      userAgent: string;
    };
    authorizer?: {
      userId: string;
      email: string;
    };
  };
}

export interface SQSEvent {
  Records: SQSRecord[];
}

export interface SQSRecord {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: Record<string, any>;
  messageAttributes: Record<string, any>;
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// DynamoDB Types
export interface DynamoDBItem {
  [key: string]: any;
}

export interface DynamoDBQueryParams {
  TableName: string;
  KeyConditionExpression?: string;
  FilterExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, any>;
  IndexName?: string;
  Limit?: number;
  ScanIndexForward?: boolean;
}

// S3 Types
export interface S3Object {
  bucket: string;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

// Bedrock Types
export interface BedrockRequest {
  modelId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface BedrockResponse {
  completion: string;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
}

// Comprehend Types
export interface ComprehendAnalysisRequest {
  text: string;
  languageCode: string;
}

export interface ComprehendSentimentResponse {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  sentimentScore: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
}

export interface ComprehendEntitiesResponse {
  entities: Array<{
    text: string;
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
  }>;
}

export interface ComprehendKeyPhrasesResponse {
  keyPhrases: Array<{
    text: string;
    score: number;
    beginOffset: number;
    endOffset: number;
  }>;
}

// Configuration Types
export interface AppConfig {
  aws: {
    region: string;
    dynamoDbTables: {
      users: string;
      contentIdeas: string;
      generatedContent: string;
      engagementFeedback: string;
      audienceProfiles: string;
    };
    s3Buckets: {
      contentStorage: string;
      analytics: string;
    };
    bedrock: {
      modelIds: {
        textGeneration: string;
        textAnalysis: string;
      };
    };
  };
  api: {
    corsOrigins: string[];
    rateLimits: {
      contentGeneration: number;
      authentication: number;
    };
  };
  security: {
    jwtSecret: string;
    jwtExpirationTime: string;
    passwordMinLength: number;
  };
}

// Audience Analysis Types
export interface AudienceAnalysisResult {
  demographics: Demographics;
  behaviorPatterns: BehaviorPatterns;
  confidenceScore: number;
  processingTime: number;
  insights: string[];
  recommendedPlatforms: Platform[];
  targetAgeRange: string;
  primaryInterests: string[];
}

export interface AudienceAnalysisOptions {
  includeHistoricalData?: boolean;
  minConfidence?: number;
  maxInsights?: number;
  enableBehaviorPrediction?: boolean;
}

// Intent Classification Types
export interface IntentClassificationResult {
  intent: ContentIntent;
  confidenceScore: number;
  processingTime: number;
  alternativeIntents: Array<{
    intent: ContentIntent;
    confidence: number;
  }>;
  features: IntentFeatures;
  modelVersion: string;
}

export interface IntentFeatures {
  keyPhrases: Array<{ text: string; score: number }>;
  entities: Array<{ text: string; type: string; score: number }>;
  sentiment: ComprehendSentimentResponse | null;
  textMetrics: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    questionCount: number;
    exclamationCount: number;
    callToActionIndicators: number;
  };
  contentIndicators: {
    promotional: number;
    informational: number;
    educational: number;
    entertainment: number;
  };
}

export interface IntentClassificationOptions {
  useMLModel?: boolean;
  minConfidence?: number;
  includeAlternatives?: boolean;
  maxAlternatives?: number;
  enableFeatureExtraction?: boolean;
}

// Utility Types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;