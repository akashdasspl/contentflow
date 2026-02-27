// Theme and topic extraction service using Amazon Comprehend
// Requirements: 1.2

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
  ContentIntent,
} from '../types';

export interface ThemeExtractionResult {
  themes: string[];
  topics: string[];
  entities: Array<{
    text: string;
    type: string;
    confidence: number;
  }>;
  keyPhrases: Array<{
    text: string;
    confidence: number;
  }>;
  sentiment: {
    sentiment: string;
    confidence: number;
  };
  intent: ContentIntent;
  overallConfidence: number;
  processingTime: number;
}

export interface ThemeExtractionOptions {
  maxThemes?: number;
  maxTopics?: number;
  minConfidence?: number;
  enableSentimentAnalysis?: boolean;
  enableEntityExtraction?: boolean;
}

export class ThemeExtractionService {
  private client: ComprehendClient;
  private readonly DEFAULT_OPTIONS: Required<ThemeExtractionOptions> = {
    maxThemes: 10,
    maxTopics: 15,
    minConfidence: 0.5,
    enableSentimentAnalysis: true,
    enableEntityExtraction: true,
  };

  constructor() {
    this.client = comprehendClient;
  }

  /**
   * Extract themes and topics from content text
   * Requirements: 1.2 - Extract key themes and topics within 5 seconds
   */
  async extractThemesAndTopics(
    text: string,
    options: ThemeExtractionOptions = {}
  ): Promise<ThemeExtractionResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      logInfo('Starting theme and topic extraction', {
        textLength: text.length,
        options: mergedOptions,
      });

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text content is required for theme extraction');
      }

      if (text.length > 5000) {
        logWarning('Text length exceeds recommended limit', { length: text.length });
        // Truncate to first 5000 characters to stay within Comprehend limits
        text = text.substring(0, 5000);
      }

      // Detect language first
      const language = await this.detectLanguage(text);
      logInfo('Language detected', { language });

      // Run analysis operations in parallel for performance optimization
      const [keyPhrases, entitiesResult, sentimentResult] = await Promise.all([
        this.extractKeyPhrases(text, language),
        mergedOptions.enableEntityExtraction ? this.extractEntities(text, language) : Promise.resolve([]),
        mergedOptions.enableSentimentAnalysis ? this.analyzeSentiment(text, language) : Promise.resolve(null),
      ]);

      // Type-safe assignments
      const entities = entitiesResult as Array<{ text: string; type: string; score: number }>;
      const sentiment = sentimentResult as ComprehendSentimentResponse | null;

      // Process and combine results
      const themes = this.extractThemesFromAnalysis(keyPhrases, entities, mergedOptions);
      const topics = this.extractTopicsFromAnalysis(keyPhrases, entities, mergedOptions);
      const intent = this.determineContentIntent(text, sentiment, keyPhrases);
      const overallConfidence = this.calculateOverallConfidence(keyPhrases, entities, sentiment);

      const processingTime = Date.now() - startTime;

      // Ensure processing time meets requirement (5 seconds)
      if (processingTime > 5000) {
        logWarning('Theme extraction exceeded 5-second requirement', {
          processingTime,
          textLength: text.length,
        });
      }

      const result: ThemeExtractionResult = {
        themes,
        topics,
        entities: entities.map(entity => ({
          text: entity.text,
          type: entity.type,
          confidence: entity.score,
        })),
        keyPhrases: keyPhrases.map(phrase => ({
          text: phrase.text,
          confidence: phrase.score,
        })),
        sentiment: sentiment ? {
          sentiment: sentiment.sentiment,
          confidence: Math.max(
            sentiment.sentimentScore.positive,
            sentiment.sentimentScore.negative,
            sentiment.sentimentScore.neutral,
            sentiment.sentimentScore.mixed
          ),
        } : { sentiment: 'NEUTRAL', confidence: 0 },
        intent,
        overallConfidence,
        processingTime,
      };

      logInfo('Theme and topic extraction completed', {
        themesCount: themes.length,
        topicsCount: topics.length,
        entitiesCount: entities.length,
        keyPhrasesCount: keyPhrases.length,
        processingTime,
        overallConfidence,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError('Theme extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        textLength: text.length,
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
        LanguageCode: languageCode as any, // Cast to satisfy AWS SDK types
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
      logError('Key phrase extraction failed', error);
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
        LanguageCode: languageCode as any, // Cast to satisfy AWS SDK types
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
      logError('Entity extraction failed', error);
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
        LanguageCode: languageCode as any, // Cast to satisfy AWS SDK types
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
      logError('Sentiment analysis failed', error);
      return null;
    }
  }

  /**
   * Extract themes from analysis results
   */
  private extractThemesFromAnalysis(
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    options: Required<ThemeExtractionOptions>
  ): string[] {
    const themes = new Set<string>();

    // Extract themes from high-confidence key phrases
    keyPhrases
      .filter(phrase => phrase.score >= options.minConfidence)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxThemes)
      .forEach(phrase => {
        // Clean and normalize the phrase
        const cleanedPhrase = this.cleanPhrase(phrase.text);
        if (cleanedPhrase && this.isValidTheme(cleanedPhrase)) {
          themes.add(cleanedPhrase);
        }
      });

    // Extract themes from high-confidence entities
    entities
      .filter(entity => entity.score >= options.minConfidence)
      .filter(entity => ['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT', 'TITLE'].includes(entity.type))
      .sort((a, b) => b.score - a.score)
      .forEach(entity => {
        const cleanedEntity = this.cleanPhrase(entity.text);
        if (cleanedEntity && this.isValidTheme(cleanedEntity) && themes.size < options.maxThemes) {
          themes.add(cleanedEntity);
        }
      });

    return Array.from(themes).slice(0, options.maxThemes);
  }

  /**
   * Extract topics from analysis results
   */
  private extractTopicsFromAnalysis(
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    options: Required<ThemeExtractionOptions>
  ): string[] {
    const topics = new Set<string>();

    // Extract topics from all key phrases (broader than themes)
    keyPhrases
      .filter(phrase => phrase.score >= Math.max(0.3, options.minConfidence - 0.2))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxTopics)
      .forEach(phrase => {
        const cleanedPhrase = this.cleanPhrase(phrase.text);
        if (cleanedPhrase && this.isValidTopic(cleanedPhrase)) {
          topics.add(cleanedPhrase);
        }
      });

    // Extract topics from entities
    entities
      .filter(entity => entity.score >= Math.max(0.3, options.minConfidence - 0.2))
      .sort((a, b) => b.score - a.score)
      .forEach(entity => {
        const cleanedEntity = this.cleanPhrase(entity.text);
        if (cleanedEntity && this.isValidTopic(cleanedEntity) && topics.size < options.maxTopics) {
          topics.add(cleanedEntity);
        }
      });

    return Array.from(topics).slice(0, options.maxTopics);
  }

  /**
   * Determine content intent based on analysis
   */
  private determineContentIntent(
    text: string,
    sentiment: ComprehendSentimentResponse | null,
    keyPhrases: Array<{ text: string; score: number }>
  ): ContentIntent {
    const textLower = text.toLowerCase();
    const phrases = keyPhrases.map(p => p.text.toLowerCase());

    // Check for promotional intent
    const promotionalKeywords = ['buy', 'purchase', 'sale', 'discount', 'offer', 'deal', 'price', 'free', 'limited time'];
    const hasPromotionalKeywords = promotionalKeywords.some(keyword => 
      textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))
    );

    if (hasPromotionalKeywords) {
      return 'promotional';
    }

    // Check for educational intent
    const educationalKeywords = ['learn', 'how to', 'tutorial', 'guide', 'step', 'explain', 'understand', 'knowledge'];
    const hasEducationalKeywords = educationalKeywords.some(keyword => 
      textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))
    );

    if (hasEducationalKeywords) {
      return 'educational';
    }

    // Check for entertainment intent
    const entertainmentKeywords = ['fun', 'funny', 'entertainment', 'story', 'joke', 'amusing', 'interesting'];
    const hasEntertainmentKeywords = entertainmentKeywords.some(keyword => 
      textLower.includes(keyword) || phrases.some(phrase => phrase.includes(keyword))
    );

    if (hasEntertainmentKeywords || (sentiment?.sentiment === 'POSITIVE' && sentiment.sentimentScore.positive > 0.7)) {
      return 'entertainment';
    }

    // Default to informational
    return 'informational';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    sentiment: ComprehendSentimentResponse | null
  ): number {
    const scores: number[] = [];

    // Average key phrase confidence
    if (keyPhrases.length > 0) {
      const avgKeyPhraseScore = keyPhrases.reduce((sum, phrase) => sum + phrase.score, 0) / keyPhrases.length;
      scores.push(avgKeyPhraseScore);
    }

    // Average entity confidence
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

    // Return weighted average
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  /**
   * Clean and normalize phrases
   */
  private cleanPhrase(phrase: string): string {
    return phrase
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate if a phrase is a valid theme
   */
  private isValidTheme(phrase: string): boolean {
    // Filter out common stop words and very short phrases
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    const words = phrase.split(' ');
    
    return phrase.length >= 3 && 
           words.length <= 4 && 
           !stopWords.includes(phrase) &&
           !words.every(word => stopWords.includes(word));
  }

  /**
   * Validate if a phrase is a valid topic
   */
  private isValidTopic(phrase: string): boolean {
    // Topics can be broader than themes
    return phrase.length >= 2 && phrase.length <= 50;
  }

  /**
   * Update content idea with extracted themes and topics
   */
  async updateContentIdeaWithThemes(
    ideaId: string,
    userId: string,
    extractionResult: ThemeExtractionResult
  ): Promise<void> {
    try {
      const { contentIdeaService } = await import('./database');
      
      await contentIdeaService.updateContentIdea(ideaId, userId, {
        extractedThemes: extractionResult.themes,
        intent: extractionResult.intent,
        confidenceScore: extractionResult.overallConfidence,
      });

      logInfo('Content idea updated with theme extraction results', {
        ideaId,
        userId,
        themesCount: extractionResult.themes.length,
        intent: extractionResult.intent,
        confidence: extractionResult.overallConfidence,
      });
    } catch (error) {
      logError('Failed to update content idea with themes', {
        error: error instanceof Error ? error.message : String(error),
        ideaId,
        userId,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const themeExtractionService = new ThemeExtractionService();