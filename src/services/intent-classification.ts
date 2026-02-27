// Intent classification service using Amazon Comprehend and machine learning
// Requirements: 2.2

import {
  DetectKeyPhrasesCommand,
  DetectEntitiesCommand,
  DetectSentimentCommand,
  DetectDominantLanguageCommand,
  ComprehendClient,
} from '@aws-sdk/client-comprehend';
import {
  InvokeEndpointCommand,
  SageMakerRuntimeClient,
} from '@aws-sdk/client-sagemaker-runtime';
import { comprehendClient, sageMakerClient } from './aws-clients';
import { logInfo, logError, logWarning, measureExecutionTime, retryOperation, getEnvVar } from '../utils';
import {
  ContentIntent,
  ComprehendSentimentResponse,
} from '../types';

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

export class IntentClassificationService {
  private client: ComprehendClient;
  private sageMakerClient: SageMakerRuntimeClient;
  private readonly DEFAULT_OPTIONS: Required<IntentClassificationOptions> = {
    useMLModel: true,
    minConfidence: 0.5,
    includeAlternatives: true,
    maxAlternatives: 3,
    enableFeatureExtraction: true,
  };

  // ML model endpoint name (configured via environment variable)
  private readonly ML_ENDPOINT_NAME = getEnvVar('INTENT_CLASSIFICATION_ENDPOINT', '');

  constructor() {
    this.client = comprehendClient;
    this.sageMakerClient = sageMakerClient;
  }

  /**
   * Classify content intent using hybrid approach (rule-based + ML)
   * Requirements: 2.2 - Classify content purpose as informational, promotional, educational, or entertainment
   */
  async classifyIntent(
    text: string,
    options: IntentClassificationOptions = {}
  ): Promise<IntentClassificationResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      logInfo('Starting intent classification', {
        textLength: text.length,
        options: mergedOptions,
      });

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text content is required for intent classification');
      }

      if (text.length > 5000) {
        logWarning('Text length exceeds recommended limit', { length: text.length });
        // Truncate to first 5000 characters to stay within Comprehend limits
        text = text.substring(0, 5000);
      }

      // Detect language first
      const language = await this.detectLanguage(text);
      logInfo('Language detected for intent classification', { language });

      // Extract features for classification
      let features: IntentFeatures | null = null;
      if (mergedOptions.enableFeatureExtraction) {
        features = await this.extractFeatures(text, language);
      }

      // Perform intent classification using hybrid approach
      let mlResult: IntentClassificationResult | null = null;
      let ruleBasedResult: IntentClassificationResult;

      // Try ML model first if enabled and endpoint is available
      if (mergedOptions.useMLModel && this.ML_ENDPOINT_NAME) {
        try {
          mlResult = await this.classifyWithMLModel(text, features, mergedOptions);
          logInfo('ML model classification completed', {
            intent: mlResult.intent,
            confidence: mlResult.confidenceScore,
          });
        } catch (error) {
          logWarning('ML model classification failed, falling back to rule-based', error);
        }
      }

      // Always perform rule-based classification as fallback or primary method
      ruleBasedResult = await this.classifyWithRules(text, features, mergedOptions);
      logInfo('Rule-based classification completed', {
        intent: ruleBasedResult.intent,
        confidence: ruleBasedResult.confidenceScore,
      });

      // Combine results if both are available
      const finalResult = this.combineClassificationResults(
        mlResult,
        ruleBasedResult,
        mergedOptions
      );

      const processingTime = Date.now() - startTime;
      finalResult.processingTime = processingTime;

      logInfo('Intent classification completed', {
        intent: finalResult.intent,
        confidenceScore: finalResult.confidenceScore,
        processingTime,
        modelUsed: mlResult ? 'hybrid' : 'rule-based',
        alternativeIntents: finalResult.alternativeIntents.length,
      });

      return finalResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError('Intent classification failed', {
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
   * Extract features for intent classification
   */
  private async extractFeatures(text: string, languageCode: string): Promise<IntentFeatures> {
    try {
      // Run analysis operations in parallel for performance optimization
      const [keyPhrases, entities, sentiment] = await Promise.all([
        this.extractKeyPhrases(text, languageCode),
        this.extractEntities(text, languageCode),
        this.analyzeSentiment(text, languageCode),
      ]);

      // Calculate text metrics
      const textMetrics = this.calculateTextMetrics(text);

      // Calculate content indicators
      const contentIndicators = this.calculateContentIndicators(text, keyPhrases, entities, sentiment);

      return {
        keyPhrases,
        entities,
        sentiment,
        textMetrics,
        contentIndicators,
      };
    } catch (error) {
      logError('Feature extraction failed', error);
      // Return minimal features to allow classification to continue
      return {
        keyPhrases: [],
        entities: [],
        sentiment: null,
        textMetrics: this.calculateTextMetrics(text),
        contentIndicators: this.calculateContentIndicators(text, [], [], null),
      };
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
      logError('Key phrase extraction failed in intent classification', error);
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
      logError('Entity extraction failed in intent classification', error);
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
      logError('Sentiment analysis failed in intent classification', error);
      return null;
    }
  }

  /**
   * Calculate text metrics for intent classification
   */
  private calculateTextMetrics(text: string): IntentFeatures['textMetrics'] {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    const questions = (text.match(/\?/g) || []).length;
    const exclamations = (text.match(/!/g) || []).length;

    // Count call-to-action indicators
    const ctaIndicators = [
      'buy now', 'click here', 'sign up', 'subscribe', 'download', 'get started',
      'learn more', 'contact us', 'call now', 'order today', 'limited time',
      'act now', 'don\'t miss', 'hurry', 'exclusive', 'special offer'
    ];
    
    const textLower = text.toLowerCase();
    const callToActionIndicators = ctaIndicators.reduce((count, indicator) => {
      return count + (textLower.includes(indicator) ? 1 : 0);
    }, 0);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      questionCount: questions,
      exclamationCount: exclamations,
      callToActionIndicators,
    };
  }

  /**
   * Calculate content indicators for each intent type
   */
  private calculateContentIndicators(
    text: string,
    keyPhrases: Array<{ text: string; score: number }>,
    entities: Array<{ text: string; type: string; score: number }>,
    sentiment: ComprehendSentimentResponse | null
  ): IntentFeatures['contentIndicators'] {
    const textLower = text.toLowerCase();
    const phrases = keyPhrases.map(p => p.text.toLowerCase());

    // Promotional indicators
    const promotionalKeywords = [
      'sale', 'discount', 'offer', 'deal', 'buy', 'purchase', 'price', 'cost',
      'free', 'limited', 'exclusive', 'special', 'promotion', 'coupon',
      'save', 'cheap', 'affordable', 'best price', 'now', 'today'
    ];

    // Informational indicators
    const informationalKeywords = [
      'what', 'how', 'why', 'when', 'where', 'who', 'information', 'facts',
      'data', 'statistics', 'research', 'study', 'report', 'news', 'update',
      'analysis', 'overview', 'summary', 'details', 'explanation'
    ];

    // Educational indicators
    const educationalKeywords = [
      'learn', 'teach', 'education', 'course', 'lesson', 'tutorial', 'guide',
      'how to', 'step by step', 'instruction', 'training', 'skill', 'knowledge',
      'understand', 'explain', 'demonstrate', 'example', 'practice', 'study'
    ];

    // Entertainment indicators
    const entertainmentKeywords = [
      'fun', 'funny', 'entertainment', 'game', 'play', 'enjoy', 'laugh',
      'humor', 'joke', 'story', 'movie', 'music', 'video', 'show',
      'celebrity', 'gossip', 'trending', 'viral', 'meme', 'amazing'
    ];

    const calculateScore = (keywords: string[]): number => {
      let score = 0;
      
      keywords.forEach(keyword => {
        // Check in main text
        if (textLower.includes(keyword)) {
          score += 1;
        }
        
        // Check in key phrases (weighted higher)
        if (phrases.some(phrase => phrase.includes(keyword))) {
          score += 1.5;
        }
      });

      // Normalize score (0-1 range)
      return Math.min(score / keywords.length, 1.0);
    };

    let promotional = calculateScore(promotionalKeywords);
    let informational = calculateScore(informationalKeywords);
    let educational = calculateScore(educationalKeywords);
    let entertainment = calculateScore(entertainmentKeywords);

    // Adjust scores based on sentiment
    if (sentiment) {
      if (sentiment.sentiment === 'POSITIVE') {
        promotional += 0.1;
        entertainment += 0.1;
      } else if (sentiment.sentiment === 'NEUTRAL') {
        informational += 0.1;
        educational += 0.1;
      }
    }

    // Adjust scores based on entities
    entities.forEach(entity => {
      if (entity.type === 'ORGANIZATION' && entity.score > 0.7) {
        promotional += 0.05;
        informational += 0.05;
      }
      if (entity.type === 'PERSON' && entity.score > 0.7) {
        entertainment += 0.05;
        informational += 0.05;
      }
    });

    return {
      promotional: Math.min(promotional, 1.0),
      informational: Math.min(informational, 1.0),
      educational: Math.min(educational, 1.0),
      entertainment: Math.min(entertainment, 1.0),
    };
  }

  /**
   * Classify intent using machine learning model
   */
  private async classifyWithMLModel(
    text: string,
    features: IntentFeatures | null,
    options: Required<IntentClassificationOptions>
  ): Promise<IntentClassificationResult> {
    try {
      // Prepare input for ML model
      const modelInput = {
        text: text,
        features: features ? {
          word_count: features.textMetrics.wordCount,
          sentence_count: features.textMetrics.sentenceCount,
          question_count: features.textMetrics.questionCount,
          exclamation_count: features.textMetrics.exclamationCount,
          cta_indicators: features.textMetrics.callToActionIndicators,
          promotional_score: features.contentIndicators.promotional,
          informational_score: features.contentIndicators.informational,
          educational_score: features.contentIndicators.educational,
          entertainment_score: features.contentIndicators.entertainment,
          sentiment: features.sentiment?.sentiment || 'NEUTRAL',
          sentiment_confidence: features.sentiment ? Math.max(
            features.sentiment.sentimentScore.positive,
            features.sentiment.sentimentScore.negative,
            features.sentiment.sentimentScore.neutral,
            features.sentiment.sentimentScore.mixed
          ) : 0,
        } : null,
      };

      const command = new InvokeEndpointCommand({
        EndpointName: this.ML_ENDPOINT_NAME,
        ContentType: 'application/json',
        Body: JSON.stringify(modelInput),
      });

      const response = await retryOperation(
        () => this.sageMakerClient.send(command),
        2,
        1000
      );

      if (!response.Body) {
        throw new Error('Empty response from ML model');
      }

      // Parse ML model response
      const responseBody = JSON.parse(new TextDecoder().decode(response.Body));
      
      // Expected response format: { intent: string, confidence: number, alternatives: Array<{intent: string, confidence: number}> }
      const intent = responseBody.intent as ContentIntent;
      const confidence = responseBody.confidence as number;
      const alternatives = responseBody.alternatives || [];

      // Validate ML model output
      if (!this.isValidIntent(intent)) {
        throw new Error(`Invalid intent from ML model: ${intent}`);
      }

      if (confidence < 0 || confidence > 1) {
        throw new Error(`Invalid confidence score from ML model: ${confidence}`);
      }

      return {
        intent,
        confidenceScore: confidence,
        processingTime: 0, // Will be set by caller
        alternativeIntents: alternatives.slice(0, options.maxAlternatives),
        features: features || this.getEmptyFeatures(),
        modelVersion: 'ml-v1.0',
      };

    } catch (error) {
      logError('ML model classification failed', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: this.ML_ENDPOINT_NAME,
      });
      throw error;
    }
  }

  /**
   * Classify intent using rule-based approach
   */
  private async classifyWithRules(
    text: string,
    features: IntentFeatures | null,
    options: Required<IntentClassificationOptions>
  ): Promise<IntentClassificationResult> {
    // Use features if available, otherwise extract minimal features
    const workingFeatures = features || await this.extractFeatures(text, 'en');

    // Calculate intent scores based on content indicators and text metrics
    const scores = { ...workingFeatures.contentIndicators };

    // Apply rule-based adjustments
    const textMetrics = workingFeatures.textMetrics;

    // High CTA indicators suggest promotional content
    if (textMetrics.callToActionIndicators > 2) {
      scores.promotional += 0.3;
    }

    // High question count suggests informational or educational content
    if (textMetrics.questionCount > textMetrics.sentenceCount * 0.3) {
      scores.informational += 0.2;
      scores.educational += 0.2;
    }

    // High exclamation count suggests promotional or entertainment content
    if (textMetrics.exclamationCount > textMetrics.sentenceCount * 0.2) {
      scores.promotional += 0.1;
      scores.entertainment += 0.1;
    }

    // Sentiment-based adjustments
    if (workingFeatures.sentiment) {
      const sentiment = workingFeatures.sentiment;
      if (sentiment.sentiment === 'POSITIVE' && sentiment.sentimentScore.positive > 0.7) {
        scores.promotional += 0.1;
        scores.entertainment += 0.1;
      }
    }

    // Determine primary intent
    const intentEntries = Object.entries(scores) as Array<[ContentIntent, number]>;
    intentEntries.sort(([, a], [, b]) => b - a);

    const primaryIntent = intentEntries[0][0];
    const primaryScore = intentEntries[0][1];

    // Calculate confidence based on score separation
    const secondaryScore = intentEntries[1]?.[1] || 0;
    const scoreSeparation = primaryScore - secondaryScore;
    let confidence = Math.min(primaryScore + (scoreSeparation * 0.5), 1.0);

    // Apply minimum confidence threshold
    confidence = Math.max(confidence, 0.3);

    // Generate alternatives if requested
    const alternatives: Array<{ intent: ContentIntent; confidence: number }> = [];
    if (options.includeAlternatives) {
      for (let i = 1; i < Math.min(intentEntries.length, options.maxAlternatives + 1); i++) {
        const [intent, score] = intentEntries[i];
        if (score > 0.1) { // Only include alternatives with meaningful scores
          alternatives.push({
            intent,
            confidence: Math.min(score, confidence - 0.1), // Ensure alternatives have lower confidence
          });
        }
      }
    }

    return {
      intent: primaryIntent,
      confidenceScore: confidence,
      processingTime: 0, // Will be set by caller
      alternativeIntents: alternatives,
      features: workingFeatures,
      modelVersion: 'rule-based-v1.0',
    };
  }

  /**
   * Combine ML and rule-based classification results
   */
  private combineClassificationResults(
    mlResult: IntentClassificationResult | null,
    ruleBasedResult: IntentClassificationResult,
    options: Required<IntentClassificationOptions>
  ): IntentClassificationResult {
    // If no ML result, return rule-based result
    if (!mlResult) {
      return ruleBasedResult;
    }

    // If ML confidence is high, prefer ML result
    if (mlResult.confidenceScore >= 0.8) {
      return {
        ...mlResult,
        modelVersion: 'ml-primary-v1.0',
      };
    }

    // If ML confidence is low, prefer rule-based result
    if (mlResult.confidenceScore < options.minConfidence) {
      return {
        ...ruleBasedResult,
        modelVersion: 'rule-based-fallback-v1.0',
      };
    }

    // For medium confidence, use weighted combination
    const mlWeight = mlResult.confidenceScore;
    const ruleWeight = ruleBasedResult.confidenceScore;
    const totalWeight = mlWeight + ruleWeight;

    // If both agree on intent, combine confidences
    if (mlResult.intent === ruleBasedResult.intent) {
      const combinedConfidence = (mlWeight * mlResult.confidenceScore + ruleWeight * ruleBasedResult.confidenceScore) / totalWeight;
      
      return {
        ...mlResult,
        confidenceScore: Math.min(combinedConfidence, 1.0),
        modelVersion: 'hybrid-agreement-v1.0',
      };
    }

    // If they disagree, choose the one with higher confidence
    if (mlResult.confidenceScore > ruleBasedResult.confidenceScore) {
      return {
        ...mlResult,
        modelVersion: 'hybrid-ml-preferred-v1.0',
      };
    } else {
      return {
        ...ruleBasedResult,
        modelVersion: 'hybrid-rule-preferred-v1.0',
      };
    }
  }

  /**
   * Validate if intent is one of the supported types
   */
  private isValidIntent(intent: string): intent is ContentIntent {
    const validIntents: ContentIntent[] = ['informational', 'promotional', 'educational', 'entertainment'];
    return validIntents.includes(intent as ContentIntent);
  }

  /**
   * Get empty features structure
   */
  private getEmptyFeatures(): IntentFeatures {
    return {
      keyPhrases: [],
      entities: [],
      sentiment: null,
      textMetrics: {
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        questionCount: 0,
        exclamationCount: 0,
        callToActionIndicators: 0,
      },
      contentIndicators: {
        promotional: 0,
        informational: 0,
        educational: 0,
        entertainment: 0,
      },
    };
  }

  /**
   * Batch classify multiple texts
   */
  async batchClassifyIntent(
    texts: string[],
    options: IntentClassificationOptions = {}
  ): Promise<IntentClassificationResult[]> {
    logInfo('Starting batch intent classification', {
      batchSize: texts.length,
      options,
    });

    const results: IntentClassificationResult[] = [];
    
    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(text => this.classifyIntent(text, options));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        logError('Batch classification failed for batch', {
          batchIndex: Math.floor(i / concurrencyLimit),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    logInfo('Batch intent classification completed', {
      totalProcessed: results.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length,
    });

    return results;
  }
}

// Export singleton instance
export const intentClassificationService = new IntentClassificationService();