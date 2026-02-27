// Audience analysis service using Amazon Comprehend
// Requirements: 2.1, 2.4

import {
  DetectKeyPhrasesCommand,
  DetectEntitiesCommand,
  DetectSentimentCommand,
  DetectDominantLanguageCommand,
  ComprehendClient,
} from '@aws-sdk/client-comprehend';
import { comprehendClient } from './aws-clients';
import { logInfo, logError, logWarning, measureExecutionTime, retryOperation } from '../utils';
import {
  ComprehendAnalysisRequest,
  ComprehendKeyPhrasesResponse,
  ComprehendEntitiesResponse,
  ComprehendSentimentResponse,
  AudienceProfile,
  Demographics,
  BehaviorPatterns,
  Platform,
  ContentType,
  PlatformUsage,
} from '../types';

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

export class AudienceAnalysisService {
  private client: ComprehendClient;
  private readonly DEFAULT_OPTIONS: Required<AudienceAnalysisOptions> = {
    includeHistoricalData: true,
    minConfidence: 0.5,
    maxInsights: 10,
    enableBehaviorPrediction: true,
  };

  constructor() {
    this.client = comprehendClient;
  }

  /**
   * Analyze target audience characteristics from content text
   * Requirements: 2.1 - Identify target demographic characteristics
   * Requirements: 2.4 - Provide confidence scores for analysis results
   */
  async analyzeAudience(
    text: string,
    userId?: string,
    options: AudienceAnalysisOptions = {}
  ): Promise<AudienceAnalysisResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      logInfo('Starting audience analysis', {
        textLength: text.length,
        userId,
        options: mergedOptions,
      });

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text content is required for audience analysis');
      }

      if (text.length > 5000) {
        logWarning('Text length exceeds recommended limit', { length: text.length });
        // Truncate to first 5000 characters to stay within Comprehend limits
        text = text.substring(0, 5000);
      }

      // Detect language first
      const language = await this.detectLanguage(text);
      logInfo('Language detected for audience analysis', { language });

      // Run analysis operations in parallel for performance optimization
      const [keyPhrases, entities, sentiment] = await Promise.all([
        this.extractKeyPhrases(text, language),
        this.extractEntities(text, language),
        this.analyzeSentiment(text, language),
      ]);

      // Get historical audience data if available and requested
      let historicalProfile: AudienceProfile | null = null;
      if (userId && mergedOptions.includeHistoricalData) {
        historicalProfile = await this.getHistoricalAudienceProfile(userId);
      }

      // Analyze demographics from content and entities
      const demographics = await this.analyzeDemographics(text, entities, keyPhrases, historicalProfile);

      // Analyze behavior patterns from content characteristics
      const behaviorPatterns = await this.analyzeBehaviorPatterns(text, sentiment, keyPhrases, historicalProfile);

      // Calculate confidence score
      const confidenceScore = this.calculateAudienceConfidence(keyPhrases, entities, sentiment, historicalProfile);

      // Generate insights and recommendations
      const insights = this.generateAudienceInsights(demographics, behaviorPatterns, sentiment, mergedOptions);
      const recommendedPlatforms = this.recommendPlatforms(demographics, behaviorPatterns, sentiment);

      const processingTime = Date.now() - startTime;

      const result: AudienceAnalysisResult = {
        demographics,
        behaviorPatterns,
        confidenceScore,
        processingTime,
        insights,
        recommendedPlatforms,
        targetAgeRange: demographics.ageRange,
        primaryInterests: demographics.interests.slice(0, 5),
      };

      logInfo('Audience analysis completed', {
        userId,
        confidenceScore,
        processingTime,
        demographicsFound: Object.keys(demographics).length,
        insightsGenerated: insights.length,
        recommendedPlatforms: recommendedPlatforms.length,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError('Audience analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        textLength: text.length,
        userId,
      });
      throw error;
    }
  }

  /**
   * Detect the dominant language of the text
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      const command = new DetectDominantLanguageCommand({
        Text: text,
      });

      const response = await retryOperation(
        () => this.client.send(command),
        3,
        1000
      );

      const dominantLanguage = response.Languages?.[0];
      return dominantLanguage?.LanguageCode || 'en';
    } catch (error) {
      logWarning('Language detection failed, defaulting to English', error);
      return 'en';
    }
  }

  /**
   * Extract key phrases using Amazon Comprehend
   */
  private async extractKeyPhrases(text: string, languageCode: string): Promise<Array<{ text: string; score: number }>> {
    try {
      const command = new DetectKeyPhrasesCommand({
        Text: text,
        LanguageCode: languageCode as any,
      });

      const response = await retryOperation(
        () => this.client.send(command),
        3,
        1000
      );

      return response.KeyPhrases?.map(phrase => ({
        text: phrase.Text || '',
        score: phrase.Score || 0,
      })) || [];
    } catch (error) {
      logError('Key phrase extraction failed in audience analysis', error);
      return [];
    }
  }

  /**
   * Extract entities using Amazon Comprehend
   */
  private async extractEntities(text: string, languageCode: string): Promise<Array<{ text: string; type: string; score: number }>> {
    try {
      const command = new DetectEntitiesCommand({
        Text: text,
        LanguageCode: languageCode as any,
      });

      const response = await retryOperation(
        () => this.client.send(command),
        3,
        1000
      );

      return response.Entities?.map(entity => ({
        text: entity.Text || '',
        type: entity.Type || 'OTHER',
        score: entity.Score || 0,
      })) || [];
    } catch (error) {
      logError('Entity extraction failed in audience analysis', error);
      return [];
    }
  }

  /**
   * Analyze sentiment using Amazon Comprehend
   */
  private async analyzeSentiment(text: string, languageCode: string): Promise<ComprehendSentimentResponse | null> {
    try {
      const command = new DetectSentimentCommand({
        Text: text,
        LanguageCode: languageCode as any,
      });

      const response = await retryOperation(
        () => this.client.send(command),
        3,
        1000
      );

      return {
        sentiment: response.Sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED',
        sentimentScore: {
          positive: response.SentimentScore?.Positive || 0,
          negative: response.SentimentScore?.Negative || 0,
          neutral: response.SentimentScore?.Neutral || 0,
          mixed: response.SentimentScore?.Mixed || 0,
        },
      };
    } catch (error) {
      logError('Sentiment analysis failed in audience analysis', error);
      return null;
    }
  }

  /**
   * Get historical audience profile for a user
   */
  private async getHistoricalAudienceProfile(userId: string): Promise<AudienceProfile | null> {
    try {
      const { audienceProfileService } = await import('./database');
      const profiles = await audienceProfileService.getUserAudienceProfiles(userId, 1);
      return profiles.length > 0 ? profiles[0] : null;
    } catch (error) {
      logWarning('Failed to retrieve historical audience profile', { userId, error });
      return null;
    }
  }

  /**
   * Analyze demographics from content and entities
   */
  private async analyzeDemographics(
    text: string,
    entities: Array<{ text: string; type: string; score: number }>,
    keyPhrases: Array<{ text: string; score: number }>,
    historicalProfile: AudienceProfile | null
  ): Promise<Demographics> {
    const textLower = text.toLowerCase();
    const phrases = keyPhrases.map(p => p.text.toLowerCase());
    const locations = entities.filter(e => e.type === 'LOCATION' && e.score > 0.5);

    // Analyze age range from content indicators
    const ageRange = this.determineAgeRange(textLower, phrases, historicalProfile);

    // Analyze location from entities and content
    const location = this.determineLocation(locations, textLower, historicalProfile);

    // Extract interests from key phrases and entities
    const interests = this.extractInterests(keyPhrases, entities, textLower);

    // Analyze gender indicators (optional, with sensitivity)
    const gender = this.analyzeGenderIndicators(textLower, phrases, historicalProfile);

    // Analyze income/education level indicators
    const income = this.analyzeIncomeIndicators(textLower, phrases, historicalProfile);
    const education = this.analyzeEducationIndicators(textLower, phrases, historicalProfile);

    return {
      ageRange,
      location,
      interests,
      gender,
      income,
      education,
    };
  }

  /**
   * Determine age range from content analysis
   */
  private determineAgeRange(
    textLower: string,
    phrases: string[],
    historicalProfile: AudienceProfile | null
  ): string {
    // Use historical data if available
    if (historicalProfile?.demographics.ageRange) {
      return historicalProfile.demographics.ageRange;
    }

    // Age-related keywords and phrases
    const ageIndicators = {
      'Gen Z': ['tiktok', 'snapchat', 'gaming', 'streaming', 'memes', 'viral', 'trendy'],
      'Millennials': ['instagram', 'facebook', 'career', 'startup', 'freelance', 'travel', 'experiences'],
      'Gen X': ['linkedin', 'professional', 'management', 'family', 'mortgage', 'retirement planning'],
      'Baby Boomers': ['traditional', 'established', 'grandchildren', 'retirement', 'health', 'stability'],
    };

    const scores: Record<string, number> = {};

    Object.entries(ageIndicators).forEach(([generation, keywords]) => {
      scores[generation] = keywords.reduce((score, keyword) => {
        if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });

    // Find the generation with the highest score
    const topGeneration = Object.entries(scores).reduce((max, [gen, score]) => 
      score > max.score ? { generation: gen, score } : max, 
      { generation: '25-34', score: 0 }
    );

    // Map generations to age ranges
    const ageRangeMap: Record<string, string> = {
      'Gen Z': '18-24',
      'Millennials': '25-34',
      'Gen X': '35-54',
      'Baby Boomers': '55+',
    };

    return ageRangeMap[topGeneration.generation] || '25-34';
  }

  /**
   * Determine location from entities and content
   */
  private determineLocation(
    locations: Array<{ text: string; type: string; score: number }>,
    textLower: string,
    historicalProfile: AudienceProfile | null
  ): string {
    // Use historical data if available
    if (historicalProfile?.demographics.location) {
      return historicalProfile.demographics.location;
    }

    // Use detected location entities
    if (locations.length > 0) {
      const topLocation = locations.sort((a, b) => b.score - a.score)[0];
      return topLocation.text;
    }

    // Look for location indicators in text
    const locationKeywords = {
      'United States': ['usa', 'america', 'us', 'american'],
      'United Kingdom': ['uk', 'britain', 'british', 'england'],
      'Canada': ['canada', 'canadian'],
      'Australia': ['australia', 'australian', 'aussie'],
      'Global': ['international', 'worldwide', 'global'],
    };

    for (const [location, keywords] of Object.entries(locationKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        return location;
      }
    }

    return 'Global';
  }

  /**
   * Extract interests from key phrases and entities
   */
  private extractInterests(
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    textLower: string
  ): string[] {
    const interests = new Set<string>();

    // Extract from high-confidence key phrases
    keyPhrases
      .filter(phrase => phrase.score > 0.5)
      .slice(0, 15)
      .forEach(phrase => {
        const cleanedPhrase = this.cleanInterest(phrase.text);
        if (cleanedPhrase && this.isValidInterest(cleanedPhrase)) {
          interests.add(cleanedPhrase);
        }
      });

    // Extract from relevant entities
    entities
      .filter(entity => ['ORGANIZATION', 'EVENT', 'TITLE'].includes(entity.type) && entity.score > 0.5)
      .slice(0, 10)
      .forEach(entity => {
        const cleanedEntity = this.cleanInterest(entity.text);
        if (cleanedEntity && this.isValidInterest(cleanedEntity)) {
          interests.add(cleanedEntity);
        }
      });

    // Add category-based interests
    const categoryInterests = this.categorizeInterests(textLower);
    categoryInterests.forEach(interest => interests.add(interest));

    return Array.from(interests).slice(0, 10);
  }

  /**
   * Categorize interests based on content
   */
  private categorizeInterests(textLower: string): string[] {
    const categories = {
      'Technology': ['tech', 'software', 'ai', 'digital', 'innovation', 'startup'],
      'Business': ['business', 'entrepreneur', 'marketing', 'sales', 'finance'],
      'Health & Fitness': ['health', 'fitness', 'wellness', 'exercise', 'nutrition'],
      'Travel': ['travel', 'vacation', 'adventure', 'explore', 'destination'],
      'Food': ['food', 'cooking', 'recipe', 'restaurant', 'cuisine'],
      'Fashion': ['fashion', 'style', 'clothing', 'trends', 'beauty'],
      'Entertainment': ['entertainment', 'movies', 'music', 'games', 'celebrity'],
      'Education': ['education', 'learning', 'course', 'skill', 'knowledge'],
      'Sports': ['sports', 'football', 'basketball', 'soccer', 'athletics'],
      'Arts': ['art', 'design', 'creative', 'photography', 'painting'],
    };

    const foundInterests: string[] = [];

    Object.entries(categories).forEach(([category, keywords]) => {
      const score = keywords.reduce((count, keyword) => 
        textLower.includes(keyword) ? count + 1 : count, 0
      );
      
      if (score >= 2) {
        foundInterests.push(category);
      }
    });

    return foundInterests;
  }

  /**
   * Analyze gender indicators (with sensitivity and privacy considerations)
   */
  private analyzeGenderIndicators(
    textLower: string,
    phrases: string[],
    historicalProfile: AudienceProfile | null
  ): string | undefined {
    // Use historical data if available
    if (historicalProfile?.demographics.gender) {
      return historicalProfile.demographics.gender;
    }

    // Note: Gender analysis should be done carefully and only when relevant
    // This is a simplified approach and should be enhanced with more sophisticated methods
    const genderIndicators = {
      'Female': ['women', 'female', 'ladies', 'girls', 'she', 'her'],
      'Male': ['men', 'male', 'guys', 'boys', 'he', 'his'],
    };

    const scores: Record<string, number> = { Female: 0, Male: 0 };

    Object.entries(genderIndicators).forEach(([gender, keywords]) => {
      scores[gender] = keywords.reduce((score, keyword) => {
        if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });

    // Only return if there's a clear indication (score > 2)
    const maxScore = Math.max(scores.Female, scores.Male);
    if (maxScore > 2) {
      return scores.Female > scores.Male ? 'Female' : 'Male';
    }

    return undefined;
  }

  /**
   * Analyze income level indicators
   */
  private analyzeIncomeIndicators(
    textLower: string,
    phrases: string[],
    historicalProfile: AudienceProfile | null
  ): string | undefined {
    if (historicalProfile?.demographics.income) {
      return historicalProfile.demographics.income;
    }

    const incomeIndicators = {
      'High': ['luxury', 'premium', 'executive', 'investment', 'high-end', 'exclusive'],
      'Medium': ['professional', 'career', 'middle class', 'suburban', 'comfortable'],
      'Budget-conscious': ['budget', 'affordable', 'deal', 'discount', 'save money', 'frugal'],
    };

    const scores: Record<string, number> = {};

    Object.entries(incomeIndicators).forEach(([level, keywords]) => {
      scores[level] = keywords.reduce((score, keyword) => {
        if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 1) {
      return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
    }

    return undefined;
  }

  /**
   * Analyze education level indicators
   */
  private analyzeEducationIndicators(
    textLower: string,
    phrases: string[],
    historicalProfile: AudienceProfile | null
  ): string | undefined {
    if (historicalProfile?.demographics.education) {
      return historicalProfile.demographics.education;
    }

    const educationIndicators = {
      'Graduate': ['phd', 'masters', 'graduate', 'research', 'academic', 'university'],
      'College': ['college', 'bachelor', 'degree', 'student', 'campus'],
      'High School': ['high school', 'teenager', 'teen', 'young adult'],
    };

    const scores: Record<string, number> = {};

    Object.entries(educationIndicators).forEach(([level, keywords]) => {
      scores[level] = keywords.reduce((score, keyword) => {
        if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 1) {
      return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
    }

    return undefined;
  }

  /**
   * Analyze behavior patterns from content characteristics
   */
  private async analyzeBehaviorPatterns(
    text: string,
    sentiment: ComprehendSentimentResponse | null,
    keyPhrases: Array<{ text: string; score: number }>,
    historicalProfile: AudienceProfile | null
  ): Promise<BehaviorPatterns> {
    const textLower = text.toLowerCase();
    const phrases = keyPhrases.map(p => p.text.toLowerCase());

    // Determine preferred content types
    const preferredContentTypes = this.determinePreferredContentTypes(textLower, phrases);

    // Determine engagement times based on content characteristics
    const engagementTimes = this.determineEngagementTimes(textLower, phrases, historicalProfile);

    // Analyze platform usage patterns
    const platformUsage = this.analyzePlatformUsage(textLower, phrases, sentiment, historicalProfile);

    return {
      preferredContentTypes,
      engagementTimes,
      platformUsage,
    };
  }

  /**
   * Determine preferred content types
   */
  private determinePreferredContentTypes(textLower: string, phrases: string[]): ContentType[] {
    const contentTypeIndicators = {
      'blog-post': ['article', 'blog', 'detailed', 'in-depth', 'comprehensive'],
      'social-post': ['social', 'quick', 'update', 'share', 'post'],
      'caption': ['photo', 'image', 'visual', 'picture', 'caption'],
      'script': ['video', 'script', 'presentation', 'speech', 'talk'],
      'email': ['newsletter', 'email', 'subscription', 'update'],
      'ad-copy': ['promotion', 'sale', 'offer', 'deal', 'advertisement'],
    };

    const scores: Record<ContentType, number> = {
      'blog-post': 0,
      'social-post': 0,
      'caption': 0,
      'script': 0,
      'email': 0,
      'ad-copy': 0,
    };

    Object.entries(contentTypeIndicators).forEach(([type, keywords]) => {
      scores[type as ContentType] = keywords.reduce((score, keyword) => {
        if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
          return score + 1;
        }
        return score;
      }, 0);
    });

    // Return content types with scores > 0, sorted by score
    return Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)
      .map(([type, _]) => type as ContentType)
      .slice(0, 3);
  }

  /**
   * Determine engagement times
   */
  private determineEngagementTimes(
    textLower: string,
    phrases: string[],
    historicalProfile: AudienceProfile | null
  ): string[] {
    // Use historical data if available
    if (historicalProfile?.behaviorPatterns.engagementTimes) {
      return historicalProfile.behaviorPatterns.engagementTimes;
    }

    // Default engagement times based on content characteristics
    const timeIndicators = {
      'morning': ['morning', 'breakfast', 'commute', 'start of day'],
      'lunch': ['lunch', 'midday', 'break', 'noon'],
      'evening': ['evening', 'after work', 'dinner', 'end of day'],
      'weekend': ['weekend', 'saturday', 'sunday', 'leisure'],
    };

    const foundTimes: string[] = [];

    Object.entries(timeIndicators).forEach(([time, keywords]) => {
      const hasIndicator = keywords.some(keyword => 
        textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))
      );
      
      if (hasIndicator) {
        foundTimes.push(time);
      }
    });

    // Default times if none found
    return foundTimes.length > 0 ? foundTimes : ['morning', 'evening'];
  }

  /**
   * Analyze platform usage patterns
   */
  private analyzePlatformUsage(
    textLower: string,
    phrases: string[],
    sentiment: ComprehendSentimentResponse | null,
    historicalProfile: AudienceProfile | null
  ): Record<Platform, PlatformUsage> {
    const platforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    const usage: Record<Platform, PlatformUsage> = {} as Record<Platform, PlatformUsage>;

    platforms.forEach(platform => {
      // Use historical data if available
      if (historicalProfile?.behaviorPatterns.platformUsage[platform]) {
        usage[platform] = historicalProfile.behaviorPatterns.platformUsage[platform];
        return;
      }

      // Determine platform usage based on content characteristics
      const platformScore = this.calculatePlatformScore(platform, textLower, phrases, sentiment);
      
      usage[platform] = {
        frequency: platformScore > 0.7 ? 'high' : platformScore > 0.4 ? 'medium' : 'low',
        engagementRate: platformScore,
        preferredContentLength: this.getPreferredContentLength(platform, textLower),
        bestPostingTimes: this.getBestPostingTimes(platform),
      };
    });

    return usage;
  }

  /**
   * Calculate platform score based on content characteristics
   */
  private calculatePlatformScore(
    platform: Platform,
    textLower: string,
    phrases: string[],
    sentiment: ComprehendSentimentResponse | null
  ): number {
    const platformIndicators: Record<Platform, string[]> = {
      blog: ['detailed', 'comprehensive', 'article', 'in-depth', 'analysis'],
      twitter: ['quick', 'news', 'update', 'trending', 'hashtag'],
      facebook: ['community', 'family', 'friends', 'share', 'social'],
      instagram: ['visual', 'photo', 'image', 'aesthetic', 'lifestyle'],
      linkedin: ['professional', 'career', 'business', 'networking', 'industry'],
      youtube: ['video', 'tutorial', 'entertainment', 'watch', 'subscribe'],
      tiktok: ['short', 'viral', 'trendy', 'creative', 'young'],
    };

    const keywords = platformIndicators[platform] || [];
    let score = 0;

    keywords.forEach(keyword => {
      if (textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))) {
        score += 0.2;
      }
    });

    // Adjust score based on sentiment for certain platforms
    if (sentiment) {
      if (platform === 'instagram' && sentiment.sentiment === 'POSITIVE') {
        score += 0.1;
      }
      if (platform === 'linkedin' && sentiment.sentiment === 'NEUTRAL') {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get preferred content length for platform
   */
  private getPreferredContentLength(platform: Platform, textLower: string): string {
    const lengthPreferences: Record<Platform, string> = {
      blog: 'long',
      twitter: 'short',
      facebook: 'medium',
      instagram: 'short',
      linkedin: 'medium',
      youtube: 'long',
      tiktok: 'short',
    };

    // Adjust based on content characteristics
    if (textLower.includes('detailed') || textLower.includes('comprehensive')) {
      return 'long';
    }
    if (textLower.includes('quick') || textLower.includes('brief')) {
      return 'short';
    }

    return lengthPreferences[platform] || 'medium';
  }

  /**
   * Get best posting times for platform
   */
  private getBestPostingTimes(platform: Platform): string[] {
    const defaultTimes: Record<Platform, string[]> = {
      blog: ['9:00 AM', '2:00 PM'],
      twitter: ['9:00 AM', '12:00 PM', '5:00 PM'],
      facebook: ['1:00 PM', '3:00 PM'],
      instagram: ['11:00 AM', '2:00 PM', '5:00 PM'],
      linkedin: ['8:00 AM', '12:00 PM', '5:00 PM'],
      youtube: ['2:00 PM', '8:00 PM'],
      tiktok: ['6:00 AM', '10:00 AM', '7:00 PM'],
    };

    return defaultTimes[platform] || ['12:00 PM', '6:00 PM'];
  }

  /**
   * Calculate overall audience analysis confidence score
   */
  private calculateAudienceConfidence(
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    sentiment: ComprehendSentimentResponse | null,
    historicalProfile: AudienceProfile | null
  ): number {
    const scores: number[] = [];

    // Key phrase confidence
    if (keyPhrases.length > 0) {
      const avgKeyPhraseScore = keyPhrases.reduce((sum, phrase) => sum + phrase.score, 0) / keyPhrases.length;
      scores.push(avgKeyPhraseScore);
    }

    // Entity confidence
    if (entities.length > 0) {
      const avgEntityScore = entities.reduce((sum, entity) => sum + entity.score, 0) / entities.length;
      scores.push(avgEntityScore);
    }

    // Sentiment confidence
    if (sentiment) {
      const sentimentConfidence = Math.max(
        sentiment.sentimentScore.positive,
        sentiment.sentimentScore.negative,
        sentiment.sentimentScore.neutral,
        sentiment.sentimentScore.mixed
      );
      scores.push(sentimentConfidence);
    }

    // Historical data bonus
    if (historicalProfile) {
      scores.push(0.8); // Boost confidence when historical data is available
    }

    // Calculate weighted average
    const baseConfidence = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.3;

    // Apply minimum confidence threshold
    return Math.max(baseConfidence, 0.3);
  }

  /**
   * Generate audience insights
   */
  private generateAudienceInsights(
    demographics: Demographics,
    behaviorPatterns: BehaviorPatterns,
    sentiment: ComprehendSentimentResponse | null,
    options: Required<AudienceAnalysisOptions>
  ): string[] {
    const insights: string[] = [];

    // Age-based insights
    if (demographics.ageRange) {
      insights.push(`Target audience is primarily ${demographics.ageRange} years old`);
    }

    // Location-based insights
    if (demographics.location && demographics.location !== 'Global') {
      insights.push(`Content resonates with ${demographics.location} audience`);
    }

    // Interest-based insights
    if (demographics.interests.length > 0) {
      insights.push(`Primary interests include ${demographics.interests.slice(0, 3).join(', ')}`);
    }

    // Behavior pattern insights
    if (behaviorPatterns.preferredContentTypes.length > 0) {
      insights.push(`Audience prefers ${behaviorPatterns.preferredContentTypes[0]} content format`);
    }

    // Sentiment-based insights
    if (sentiment) {
      if (sentiment.sentiment === 'POSITIVE') {
        insights.push('Content has positive emotional appeal for the audience');
      } else if (sentiment.sentiment === 'NEGATIVE') {
        insights.push('Content addresses audience concerns or challenges');
      }
    }

    // Platform-specific insights
    const highEngagementPlatforms = Object.entries(behaviorPatterns.platformUsage)
      .filter(([_, usage]) => usage.frequency === 'high')
      .map(([platform, _]) => platform);

    if (highEngagementPlatforms.length > 0) {
      insights.push(`High engagement expected on ${highEngagementPlatforms.join(', ')}`);
    }

    return insights.slice(0, options.maxInsights);
  }

  /**
   * Recommend platforms based on audience analysis
   */
  private recommendPlatforms(
    demographics: Demographics,
    behaviorPatterns: BehaviorPatterns,
    sentiment: ComprehendSentimentResponse | null
  ): Platform[] {
    const platformScores: Record<Platform, number> = {
      blog: 0,
      twitter: 0,
      facebook: 0,
      instagram: 0,
      linkedin: 0,
      youtube: 0,
      tiktok: 0,
    };

    // Score based on age range
    const ageScoring: Record<string, Record<Platform, number>> = {
      '18-24': { tiktok: 0.9, instagram: 0.8, twitter: 0.6, youtube: 0.7, facebook: 0.4, linkedin: 0.3, blog: 0.3 },
      '25-34': { instagram: 0.8, twitter: 0.7, linkedin: 0.7, youtube: 0.6, facebook: 0.6, blog: 0.5, tiktok: 0.4 },
      '35-54': { facebook: 0.8, linkedin: 0.9, blog: 0.7, youtube: 0.6, twitter: 0.5, instagram: 0.4, tiktok: 0.2 },
      '55+': { facebook: 0.9, blog: 0.8, linkedin: 0.6, youtube: 0.5, twitter: 0.4, instagram: 0.3, tiktok: 0.1 },
    };

    if (demographics.ageRange && ageScoring[demographics.ageRange]) {
      Object.entries(ageScoring[demographics.ageRange]).forEach(([platform, score]) => {
        platformScores[platform as Platform] += score;
      });
    }

    // Score based on interests
    demographics.interests.forEach(interest => {
      const interestLower = interest.toLowerCase();
      if (interestLower.includes('business') || interestLower.includes('professional')) {
        platformScores.linkedin += 0.3;
        platformScores.blog += 0.2;
      }
      if (interestLower.includes('visual') || interestLower.includes('fashion') || interestLower.includes('food')) {
        platformScores.instagram += 0.3;
      }
      if (interestLower.includes('technology') || interestLower.includes('news')) {
        platformScores.twitter += 0.3;
        platformScores.blog += 0.2;
      }
      if (interestLower.includes('entertainment') || interestLower.includes('music')) {
        platformScores.youtube += 0.3;
        platformScores.tiktok += 0.2;
      }
    });

    // Score based on platform usage patterns
    Object.entries(behaviorPatterns.platformUsage).forEach(([platform, usage]) => {
      if (usage.frequency === 'high') {
        platformScores[platform as Platform] += 0.4;
      } else if (usage.frequency === 'medium') {
        platformScores[platform as Platform] += 0.2;
      }
    });

    // Return top 3 platforms
    return Object.entries(platformScores)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3)
      .map(([platform, _]) => platform as Platform);
  }

  /**
   * Clean and normalize interest text
   */
  private cleanInterest(interest: string): string {
    return interest
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate if text is a valid interest
   */
  private isValidInterest(interest: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    const words = interest.split(' ');
    
    return interest.length >= 3 && 
           interest.length <= 30 &&
           words.length <= 3 && 
           !stopWords.includes(interest) &&
           !words.every(word => stopWords.includes(word));
  }

  /**
   * Create or update audience profile for a user
   * Requirements: 2.3 - Incorporate historical audience preferences
   */
  async createOrUpdateAudienceProfile(
    userId: string,
    analysisResult: AudienceAnalysisResult
  ): Promise<AudienceProfile> {
    try {
      const { audienceProfileService } = await import('./database');
      const { generateProfileId, getCurrentTimestamp } = await import('../utils');
      
      // Check if user already has an audience profile
      const existingProfiles = await audienceProfileService.getUserAudienceProfiles(userId, 1);
      
      if (existingProfiles.length > 0) {
        // Update existing profile with intelligent merging
        const existingProfile = existingProfiles[0];
        const mergedProfile = await this.mergeAudienceProfiles(existingProfile, analysisResult);
        
        const updatedProfile = await audienceProfileService.updateAudienceProfile(
          existingProfile.profileId,
          userId,
          {
            demographics: mergedProfile.demographics,
            behaviorPatterns: mergedProfile.behaviorPatterns,
            updatedAt: getCurrentTimestamp(),
          }
        );

        logInfo('Audience profile updated with historical data merge', {
          userId,
          profileId: existingProfile.profileId,
          confidenceScore: analysisResult.confidenceScore,
          mergedInterests: mergedProfile.demographics.interests.length,
          mergedPlatforms: Object.keys(mergedProfile.behaviorPatterns.platformUsage).length,
        });

        return updatedProfile;
      } else {
        // Create new profile
        const newProfile: AudienceProfile = {
          profileId: generateProfileId(),
          userId,
          demographics: analysisResult.demographics,
          behaviorPatterns: analysisResult.behaviorPatterns,
          updatedAt: getCurrentTimestamp(),
        };

        await audienceProfileService.createAudienceProfile(newProfile);

        logInfo('New audience profile created', {
          userId,
          profileId: newProfile.profileId,
          confidenceScore: analysisResult.confidenceScore,
        });

        return newProfile;
      }
    } catch (error) {
      logError('Failed to create or update audience profile', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Merge existing audience profile with new analysis results
   * Requirements: 2.3 - Incorporate historical audience preferences
   */
  private async mergeAudienceProfiles(
    existingProfile: AudienceProfile,
    newAnalysis: AudienceAnalysisResult
  ): Promise<{ demographics: Demographics; behaviorPatterns: BehaviorPatterns }> {
    // Merge demographics with weighted preference for stable characteristics
    const mergedDemographics: Demographics = {
      // Age range: prefer existing if confidence is high, otherwise use new
      ageRange: this.shouldUpdateDemographic(existingProfile.demographics.ageRange, newAnalysis.demographics.ageRange, newAnalysis.confidenceScore) 
        ? newAnalysis.demographics.ageRange 
        : existingProfile.demographics.ageRange,
      
      // Location: prefer existing unless new analysis has high confidence
      location: this.shouldUpdateDemographic(existingProfile.demographics.location, newAnalysis.demographics.location, newAnalysis.confidenceScore)
        ? newAnalysis.demographics.location
        : existingProfile.demographics.location,
      
      // Interests: merge and deduplicate, keeping top 10
      interests: this.mergeInterests(existingProfile.demographics.interests, newAnalysis.demographics.interests),
      
      // Optional fields: update only if new analysis provides them and existing doesn't have them
      gender: newAnalysis.demographics.gender || existingProfile.demographics.gender,
      income: newAnalysis.demographics.income || existingProfile.demographics.income,
      education: newAnalysis.demographics.education || existingProfile.demographics.education,
    };

    // Merge behavior patterns with preference for accumulated data
    const mergedBehaviorPatterns: BehaviorPatterns = {
      // Content types: merge and prioritize based on frequency
      preferredContentTypes: this.mergeContentTypes(
        existingProfile.behaviorPatterns.preferredContentTypes,
        newAnalysis.behaviorPatterns.preferredContentTypes
      ),
      
      // Engagement times: merge and deduplicate
      engagementTimes: this.mergeEngagementTimes(
        existingProfile.behaviorPatterns.engagementTimes,
        newAnalysis.behaviorPatterns.engagementTimes
      ),
      
      // Platform usage: merge with weighted averages
      platformUsage: this.mergePlatformUsage(
        existingProfile.behaviorPatterns.platformUsage,
        newAnalysis.behaviorPatterns.platformUsage
      ),
    };

    return {
      demographics: mergedDemographics,
      behaviorPatterns: mergedBehaviorPatterns,
    };
  }

  /**
   * Determine if a demographic field should be updated
   */
  private shouldUpdateDemographic(existingValue: string, newValue: string, confidence: number): boolean {
    // Don't update if values are the same
    if (existingValue === newValue) return false;
    
    // Update if existing value is empty/default
    if (!existingValue || existingValue === 'Global' || existingValue === '25-34') return true;
    
    // Update only if new analysis has high confidence (>0.7)
    return confidence > 0.7;
  }

  /**
   * Merge interest arrays, prioritizing frequency and relevance
   */
  private mergeInterests(existingInterests: string[], newInterests: string[]): string[] {
    const interestCounts = new Map<string, number>();
    
    // Count existing interests (give them weight of 2 for historical preference)
    existingInterests.forEach(interest => {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 2);
    });
    
    // Count new interests (weight of 1)
    newInterests.forEach(interest => {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
    });
    
    // Sort by count and return top 10
    return Array.from(interestCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([interest]) => interest);
  }

  /**
   * Merge content type preferences
   */
  private mergeContentTypes(existingTypes: ContentType[], newTypes: ContentType[]): ContentType[] {
    const typeCounts = new Map<ContentType, number>();
    
    // Weight existing types higher (historical preference)
    existingTypes.forEach((type, index) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + (3 - index * 0.5));
    });
    
    // Add new types with lower weight
    newTypes.forEach((type, index) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + (2 - index * 0.3));
    });
    
    // Return top 3 content types
    return Array.from(typeCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * Merge engagement times
   */
  private mergeEngagementTimes(existingTimes: string[], newTimes: string[]): string[] {
    const timeSet = new Set([...existingTimes, ...newTimes]);
    return Array.from(timeSet);
  }

  /**
   * Merge platform usage with weighted averages
   */
  private mergePlatformUsage(
    existingUsage: Record<Platform, PlatformUsage>,
    newUsage: Record<Platform, PlatformUsage>
  ): Record<Platform, PlatformUsage> {
    const platforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    const mergedUsage: Record<Platform, PlatformUsage> = {} as Record<Platform, PlatformUsage>;
    
    platforms.forEach(platform => {
      const existing = existingUsage[platform];
      const newData = newUsage[platform];
      
      if (existing && newData) {
        // Merge with weighted average (70% existing, 30% new)
        mergedUsage[platform] = {
          frequency: this.mergeFrequency(existing.frequency, newData.frequency),
          engagementRate: existing.engagementRate * 0.7 + newData.engagementRate * 0.3,
          preferredContentLength: existing.preferredContentLength, // Keep existing preference
          bestPostingTimes: this.mergeBestPostingTimes(existing.bestPostingTimes, newData.bestPostingTimes),
        };
      } else if (existing) {
        // Keep existing data
        mergedUsage[platform] = existing;
      } else if (newData) {
        // Use new data
        mergedUsage[platform] = newData;
      } else {
        // Create default
        mergedUsage[platform] = {
          frequency: 'low',
          engagementRate: 0.1,
          preferredContentLength: 'medium',
          bestPostingTimes: this.getBestPostingTimes(platform),
        };
      }
    });
    
    return mergedUsage;
  }

  /**
   * Merge frequency values
   */
  private mergeFrequency(existing: string, newFreq: string): string {
    const frequencyValues = { low: 1, medium: 2, high: 3 };
    const existingValue = frequencyValues[existing as keyof typeof frequencyValues] || 1;
    const newValue = frequencyValues[newFreq as keyof typeof frequencyValues] || 1;
    
    // Weighted average (70% existing, 30% new)
    const merged = Math.round(existingValue * 0.7 + newValue * 0.3);
    
    const reverseMap = { 1: 'low', 2: 'medium', 3: 'high' };
    return reverseMap[merged as keyof typeof reverseMap] || 'medium';
  }

  /**
   * Merge best posting times
   */
  private mergeBestPostingTimes(existingTimes: string[], newTimes: string[]): string[] {
    const timeSet = new Set([...existingTimes, ...newTimes]);
    return Array.from(timeSet).slice(0, 3); // Keep top 3 times
  }

  /**
   * Get all audience profiles for a user with pagination
   * Requirements: 2.3 - User audience profile storage and retrieval
   */
  async getUserAudienceProfiles(userId: string, limit: number = 10): Promise<AudienceProfile[]> {
    try {
      const { audienceProfileService } = await import('./database');
      const profiles = await audienceProfileService.getUserAudienceProfiles(userId, limit);
      
      logInfo('Retrieved user audience profiles', {
        userId,
        profileCount: profiles.length,
        limit,
      });
      
      return profiles;
    } catch (error) {
      logError('Failed to retrieve user audience profiles', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Update specific aspects of an audience profile
   * Requirements: 2.3 - Audience profile updating mechanisms
   */
  async updateAudienceProfileField(
    userId: string,
    field: 'demographics' | 'behaviorPatterns',
    updates: Partial<Demographics> | Partial<BehaviorPatterns>
  ): Promise<AudienceProfile> {
    try {
      const { audienceProfileService } = await import('./database');
      const { getCurrentTimestamp } = await import('../utils');
      
      // Get the user's current profile
      const profiles = await audienceProfileService.getUserAudienceProfiles(userId, 1);
      if (profiles.length === 0) {
        throw new Error('No audience profile found for user');
      }
      
      const existingProfile = profiles[0];
      const updateData: Partial<AudienceProfile> = {
        updatedAt: getCurrentTimestamp(),
      };
      
      if (field === 'demographics') {
        updateData.demographics = {
          ...existingProfile.demographics,
          ...(updates as Partial<Demographics>),
        };
      } else if (field === 'behaviorPatterns') {
        updateData.behaviorPatterns = {
          ...existingProfile.behaviorPatterns,
          ...(updates as Partial<BehaviorPatterns>),
        };
      }
      
      const updatedProfile = await audienceProfileService.updateAudienceProfile(
        existingProfile.profileId,
        userId,
        updateData
      );
      
      logInfo('Audience profile field updated', {
        userId,
        profileId: existingProfile.profileId,
        field,
        updatedFields: Object.keys(updates),
      });
      
      return updatedProfile;
    } catch (error) {
      logError('Failed to update audience profile field', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        field,
      });
      throw error;
    }
  }

  /**
   * Get audience profile evolution over time
   * Requirements: 2.3 - Historical audience preferences tracking
   */
  async getAudienceProfileHistory(userId: string, limit: number = 5): Promise<AudienceProfile[]> {
    try {
      const profiles = await this.getUserAudienceProfiles(userId, limit);
      
      // Sort by updatedAt to show evolution
      const sortedProfiles = profiles.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      logInfo('Retrieved audience profile history', {
        userId,
        historyCount: sortedProfiles.length,
      });
      
      return sortedProfiles;
    } catch (error) {
      logError('Failed to retrieve audience profile history', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const audienceAnalysisService = new AudienceAnalysisService();