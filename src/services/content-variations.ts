// Content variation generation and ranking service

import { bedrockService } from './bedrock-service';
import { contentQualityService } from './content-quality';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  UserPreferences,
  AudienceProfile,
  GeneratedContent,
  ContentVariation,
  ContentCustomizationOptions,
  VariationType,
  ContentMetadata,
} from '../types';
import { 
  generateContentId,
  generateIdeaId,
  getCurrentTimestamp,
  logInfo,
  logError,
  logWarning,
  calculateReadingTime,
  extractKeywords,
} from '../utils';

// Variation generation options
export interface VariationGenerationOptions {
  contentIdea: string;
  userId: string;
  contentType: ContentType;
  platform?: Platform;
  audience?: AudienceProfile | null;
  preferences?: UserPreferences | null;
  intent?: ContentIntent;
  variationCount?: number;
  customizationOptions?: ContentCustomizationOptions;
}

// Variation ranking criteria
export interface RankingCriteria {
  qualityWeight: number;
  engagementWeight: number;
  brandAlignmentWeight: number;
  uniquenessWeight: number;
  platformOptimizationWeight: number;
}

// Default ranking criteria
const DEFAULT_RANKING_CRITERIA: RankingCriteria = {
  qualityWeight: 0.3,
  engagementWeight: 0.25,
  brandAlignmentWeight: 0.2,
  uniquenessWeight: 0.15,
  platformOptimizationWeight: 0.1,
};

export class ContentVariationService {
  /**
   * Generate multiple content variations with ranking and selection
   */
  async generateVariations(options: VariationGenerationOptions): Promise<{
    primaryContent: GeneratedContent;
    variations: ContentVariation[];
    rankingMetadata: any;
  }> {
    const {
      contentIdea,
      userId,
      contentType,
      platform,
      audience,
      preferences,
      intent = 'informational',
      variationCount = 3,
      customizationOptions,
    } = options;

    logInfo('Generating content variations', {
      userId,
      contentType,
      platform,
      variationCount,
      contentIdea: contentIdea.substring(0, 50) + '...',
    });

    try {
      // Generate primary content
      const primaryContent = await this._generatePrimaryContent(options);

      // Generate variations with different approaches
      const variations = await this._generateContentVariations(
        options,
        primaryContent,
        variationCount
      );

      // Rank all variations
      const rankedVariations = await this._rankVariations(
        variations,
        primaryContent,
        options
      );

      // Generate ranking metadata
      const rankingMetadata = this._generateRankingMetadata(rankedVariations, options);

      logInfo('Content variations generated successfully', {
        userId,
        primaryContentId: primaryContent.contentId,
        variationCount: rankedVariations.length,
        topVariationScore: rankedVariations[0]?.rankingScore || 0,
      });

      return {
        primaryContent,
        variations: rankedVariations,
        rankingMetadata,
      };

    } catch (error) {
      logError('Failed to generate content variations', error);
      throw new Error(`Content variation generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate the primary content piece
   */
  private async _generatePrimaryContent(options: VariationGenerationOptions): Promise<GeneratedContent> {
    const { generatePlatformContent } = await import('./content-generators');
    
    const generationOptions = {
      contentIdea: options.contentIdea,
      userId: options.userId,
      audience: options.audience,
      preferences: options.preferences,
      intent: options.intent,
      platform: options.platform,
      variations: 1, // Generate single primary content
    };

    return await generatePlatformContent(options.contentType, generationOptions);
  }

  /**
   * Generate multiple content variations using different strategies
   */
  private async _generateContentVariations(
    options: VariationGenerationOptions,
    primaryContent: GeneratedContent,
    variationCount: number
  ): Promise<ContentVariation[]> {
    const variations: ContentVariation[] = [];
    const variationStrategies = this._getVariationStrategies(options, variationCount);

    for (const strategy of variationStrategies) {
      try {
        const variation = await this._generateSingleVariation(
          options,
          primaryContent,
          strategy
        );
        variations.push(variation);
      } catch (error) {
        logWarning(`Failed to generate variation with strategy ${strategy.type}`, error);
        // Continue with other variations even if one fails
      }
    }

    return variations;
  }

  /**
   * Get variation strategies based on content type and customization options
   */
  private _getVariationStrategies(
    options: VariationGenerationOptions,
    variationCount: number
  ): Array<{ type: VariationType; customization: ContentCustomizationOptions }> {
    const strategies: Array<{ type: VariationType; customization: ContentCustomizationOptions }> = [];
    const baseCustomization = options.customizationOptions || {};

    // Strategy 1: Tone variation
    if (variationCount >= 1) {
      strategies.push({
        type: 'tone-variation',
        customization: {
          ...baseCustomization,
          tone: this._getAlternateTone(baseCustomization.tone),
        },
      });
    }

    // Strategy 2: Length variation
    if (variationCount >= 2) {
      strategies.push({
        type: 'length-variation',
        customization: {
          ...baseCustomization,
          length: this._getAlternateLength(baseCustomization.length),
        },
      });
    }

    // Strategy 3: Style variation
    if (variationCount >= 3) {
      strategies.push({
        type: 'style-variation',
        customization: {
          ...baseCustomization,
          style: this._getAlternateStyle(baseCustomization.style),
        },
      });
    }

    // Strategy 4: Format variation (for additional variations)
    if (variationCount >= 4) {
      strategies.push({
        type: 'format-variation',
        customization: {
          ...baseCustomization,
          includeEmojis: !baseCustomization.includeEmojis,
          includeCallToAction: !baseCustomization.includeCallToAction,
        },
      });
    }

    // Strategy 5: Keyword variation
    if (variationCount >= 5) {
      strategies.push({
        type: 'keyword-variation',
        customization: {
          ...baseCustomization,
          targetKeywords: this._generateAlternateKeywords(options.contentIdea),
        },
      });
    }

    return strategies.slice(0, variationCount);
  }

  /**
   * Generate a single content variation
   */
  private async _generateSingleVariation(
    options: VariationGenerationOptions,
    primaryContent: GeneratedContent,
    strategy: { type: VariationType; customization: ContentCustomizationOptions }
  ): Promise<ContentVariation> {
    // Create modified generation options for this variation
    const modifiedOptions = {
      ...options,
      customizationOptions: strategy.customization,
    };

    // Generate content with Bedrock using modified prompt
    const bedrockOptions = {
      contentIdea: this._modifyContentIdeaForVariation(options.contentIdea, strategy),
      contentType: options.contentType,
      platform: options.platform,
      audience: options.audience,
      preferences: this._modifyPreferencesForVariation(options.preferences, strategy),
      intent: options.intent || 'informational',
      variations: 1,
      temperature: this._getTemperatureForVariation(strategy.type),
    };

    const result = await bedrockService.generateContent(bedrockOptions);

    // Create variation metadata
    const metadata: ContentMetadata = {
      wordCount: result.metadata.wordCount,
      characterCount: result.metadata.characterCount,
      hashtags: extractKeywords(result.content).slice(0, 5), // Basic hashtag extraction
      seoKeywords: extractKeywords(result.content),
      readingTime: calculateReadingTime(result.content),
      qualityScore: 0, // Will be set by quality check
      grammarScore: 0,
      coherenceScore: 0,
      safetyScore: 0,
    };

    // Perform quality check
    const tempContent: GeneratedContent = {
      contentId: generateContentId(),
      ideaId: generateIdeaId(),
      userId: options.userId,
      platform: options.platform || 'blog',
      contentType: options.contentType,
      generatedText: result.content,
      metadata,
      version: 1,
      status: 'generated',
      createdAt: getCurrentTimestamp(),
    };

    try {
      const qualityResult = await contentQualityService.validateContent(tempContent);

      // Update metadata with quality scores
      metadata.qualityScore = qualityResult.qualityScore;
      metadata.grammarScore = qualityResult.grammarScore;
      metadata.coherenceScore = qualityResult.coherenceScore;
      metadata.safetyScore = qualityResult.safetyScore;
      metadata.qualityIssues = qualityResult.issues;
      metadata.safetyFlags = qualityResult.safetyFlags;
      metadata.qualityRecommendations = qualityResult.recommendations;
    } catch (error) {
      logWarning('Quality service failed, using default scores', error);
      // Use default quality scores if quality service fails
      metadata.qualityScore = 0.5;
      metadata.grammarScore = 0.5;
      metadata.coherenceScore = 0.5;
      metadata.safetyScore = 0.8;
      metadata.qualityIssues = [];
      metadata.safetyFlags = [];
      metadata.qualityRecommendations = [];
    }

    // Create variation object
    const variation: ContentVariation = {
      variationId: generateContentId(),
      contentId: primaryContent.contentId,
      generatedText: result.content,
      metadata,
      rankingScore: 0, // Will be calculated during ranking
      variationType: strategy.type,
      customizationApplied: strategy.customization,
      createdAt: getCurrentTimestamp(),
    };

    return variation;
  }

  /**
   * Rank variations based on multiple criteria
   */
  private async _rankVariations(
    variations: ContentVariation[],
    primaryContent: GeneratedContent,
    options: VariationGenerationOptions,
    criteria: RankingCriteria = DEFAULT_RANKING_CRITERIA
  ): Promise<ContentVariation[]> {
    logInfo('Ranking content variations', {
      variationCount: variations.length,
      criteria,
    });

    // Calculate ranking scores for each variation
    for (const variation of variations) {
      variation.rankingScore = await this._calculateRankingScore(
        variation,
        primaryContent,
        options,
        criteria
      );
    }

    // Sort variations by ranking score (highest first)
    return variations.sort((a, b) => b.rankingScore - a.rankingScore);
  }

  /**
   * Calculate ranking score for a variation
   */
  private async _calculateRankingScore(
    variation: ContentVariation,
    primaryContent: GeneratedContent,
    options: VariationGenerationOptions,
    criteria: RankingCriteria
  ): Promise<number> {
    let score = 0;

    // Quality score (0-1)
    const qualityScore = variation.metadata.qualityScore || 0;
    score += qualityScore * criteria.qualityWeight;

    // Engagement potential score (0-1)
    const engagementScore = this._calculateEngagementScore(variation, options);
    score += engagementScore * criteria.engagementWeight;

    // Brand alignment score (0-1)
    const brandAlignmentScore = this._calculateBrandAlignmentScore(variation, options);
    score += brandAlignmentScore * criteria.brandAlignmentWeight;

    // Uniqueness score (0-1) - how different from primary content
    const uniquenessScore = this._calculateUniquenessScore(variation, primaryContent);
    score += uniquenessScore * criteria.uniquenessWeight;

    // Platform optimization score (0-1)
    const platformScore = this._calculatePlatformOptimizationScore(variation, options);
    score += platformScore * criteria.platformOptimizationWeight;

    return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
  }

  /**
   * Calculate engagement potential score
   */
  private _calculateEngagementScore(
    variation: ContentVariation,
    options: VariationGenerationOptions
  ): number {
    let score = 0.5; // Base score

    const text = variation.generatedText.toLowerCase();
    const customization = variation.customizationApplied;

    // Check for engagement elements
    if (text.includes('?')) score += 0.1; // Questions increase engagement
    if (customization.includeCallToAction) score += 0.15;
    if (customization.includeEmojis && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text)) score += 0.1;
    if (customization.includeHashtags && variation.metadata.hashtags && variation.metadata.hashtags.length > 0) score += 0.1;

    // Tone-based scoring
    if (customization.tone === 'conversational' || customization.tone === 'friendly') score += 0.1;
    if (customization.tone === 'formal') score -= 0.05;

    // Length-based scoring (platform dependent)
    if (options.platform === 'twitter' && customization.length === 'short') score += 0.1;
    if (options.platform === 'blog' && customization.length === 'long') score += 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate brand alignment score
   */
  private _calculateBrandAlignmentScore(
    variation: ContentVariation,
    options: VariationGenerationOptions
  ): number {
    let score = 0.5; // Base score

    const preferences = options.preferences;
    const customization = variation.customizationApplied;

    if (!preferences) return score;

    // Check tone alignment
    if (preferences.brandVoice && customization.tone) {
      const brandVoiceLower = preferences.brandVoice.toLowerCase();
      const toneLower = customization.tone.toLowerCase();
      
      if (brandVoiceLower.includes(toneLower) || toneLower.includes(brandVoiceLower)) {
        score += 0.2;
      }
    }

    // Check style alignment
    if (preferences.contentStyle && customization.style) {
      const contentStyleLower = preferences.contentStyle.toLowerCase();
      const styleLower = customization.style.toLowerCase();
      
      if (contentStyleLower.includes(styleLower) || styleLower.includes(contentStyleLower)) {
        score += 0.2;
      }
    }

    // Check platform preference alignment
    if (options.platform && preferences.preferredPlatforms.includes(options.platform)) {
      score += 0.1;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate uniqueness score compared to primary content
   */
  private _calculateUniquenessScore(
    variation: ContentVariation,
    primaryContent: GeneratedContent
  ): number {
    const primaryText = primaryContent.generatedText.toLowerCase();
    const variationText = variation.generatedText.toLowerCase();

    // Simple similarity check based on common words
    const primaryWords = new Set(primaryText.split(/\s+/));
    const variationWords = new Set(variationText.split(/\s+/));
    
    const intersection = new Set([...primaryWords].filter(word => variationWords.has(word)));
    const union = new Set([...primaryWords, ...variationWords]);
    
    const similarity = intersection.size / union.size;
    const uniqueness = 1 - similarity;

    return Math.min(Math.max(uniqueness, 0), 1);
  }

  /**
   * Calculate platform optimization score
   */
  private _calculatePlatformOptimizationScore(
    variation: ContentVariation,
    options: VariationGenerationOptions
  ): number {
    let score = 0.5; // Base score

    if (!options.platform) return score;

    const { getPlatformConstraints } = require('../utils');
    const constraints = getPlatformConstraints(options.platform);
    const text = variation.generatedText;
    const customization = variation.customizationApplied;

    // Check length constraints
    if (constraints.maxLength) {
      if (text.length <= constraints.maxLength) {
        score += 0.2;
      } else {
        score -= 0.2; // Penalty for exceeding limits
      }
    }

    // Check hashtag optimization
    if (constraints.optimalHashtags && variation.metadata.hashtags) {
      const hashtagCount = variation.metadata.hashtags.length;
      if (hashtagCount <= constraints.optimalHashtags) {
        score += 0.15;
      }
    }

    // Platform-specific optimizations
    switch (options.platform) {
      case 'twitter':
        if (customization.length === 'short') score += 0.1;
        if (customization.includeHashtags) score += 0.1;
        break;
      case 'instagram':
        if (customization.includeEmojis) score += 0.1;
        if (customization.includeHashtags) score += 0.1;
        break;
      case 'linkedin':
        if (customization.tone === 'professional') score += 0.1;
        if (customization.style === 'technical') score += 0.1;
        break;
      case 'blog':
        if (customization.length === 'long') score += 0.1;
        if (customization.style === 'storytelling') score += 0.1;
        break;
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Generate ranking metadata for analysis
   */
  private _generateRankingMetadata(
    rankedVariations: ContentVariation[],
    options: VariationGenerationOptions
  ): any {
    return {
      totalVariations: rankedVariations.length,
      averageScore: rankedVariations.reduce((sum, v) => sum + v.rankingScore, 0) / rankedVariations.length,
      topScore: rankedVariations[0]?.rankingScore || 0,
      lowestScore: rankedVariations[rankedVariations.length - 1]?.rankingScore || 0,
      variationTypes: rankedVariations.map(v => v.variationType),
      rankingCriteria: DEFAULT_RANKING_CRITERIA,
      generatedAt: getCurrentTimestamp(),
    };
  }

  // Helper methods for variation strategies

  private _getAlternateTone(currentTone?: string): 'formal' | 'casual' | 'professional' | 'friendly' | 'authoritative' | 'conversational' {
    const tones: Array<'formal' | 'casual' | 'professional' | 'friendly' | 'authoritative' | 'conversational'> = 
      ['formal', 'casual', 'professional', 'friendly', 'authoritative', 'conversational'];
    const filtered = tones.filter(tone => tone !== currentTone);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  private _getAlternateLength(currentLength?: string): 'short' | 'medium' | 'long' {
    const lengths: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long'];
    const filtered = lengths.filter(length => length !== currentLength);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  private _getAlternateStyle(currentStyle?: string): 'creative' | 'straightforward' | 'technical' | 'storytelling' {
    const styles: Array<'creative' | 'straightforward' | 'technical' | 'storytelling'> = 
      ['creative', 'straightforward', 'technical', 'storytelling'];
    const filtered = styles.filter(style => style !== currentStyle);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  private _generateAlternateKeywords(contentIdea: string): string[] {
    // Simple keyword generation based on content idea
    const words = contentIdea.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 3);
    return keywords.slice(0, 5);
  }

  private _modifyContentIdeaForVariation(
    contentIdea: string,
    strategy: { type: VariationType; customization: ContentCustomizationOptions }
  ): string {
    let modifiedIdea = contentIdea;

    // Add variation-specific context to the content idea
    switch (strategy.type) {
      case 'tone-variation':
        modifiedIdea += ` (Write in a ${strategy.customization.tone} tone)`;
        break;
      case 'length-variation':
        modifiedIdea += ` (Make it ${strategy.customization.length} length)`;
        break;
      case 'style-variation':
        modifiedIdea += ` (Use a ${strategy.customization.style} style)`;
        break;
      case 'format-variation':
        if (strategy.customization.includeEmojis) modifiedIdea += ' (Include emojis)';
        if (strategy.customization.includeCallToAction) modifiedIdea += ' (Include call-to-action)';
        break;
      case 'keyword-variation':
        if (strategy.customization.targetKeywords) {
          modifiedIdea += ` (Focus on keywords: ${strategy.customization.targetKeywords.join(', ')})`;
        }
        break;
    }

    return modifiedIdea;
  }

  private _modifyPreferencesForVariation(
    preferences: UserPreferences | null | undefined,
    strategy: { type: VariationType; customization: ContentCustomizationOptions }
  ): UserPreferences | null {
    if (!preferences) return null;

    const modifiedPreferences = { ...preferences };

    // Modify brand voice based on tone variation
    if (strategy.customization.tone) {
      modifiedPreferences.brandVoice = strategy.customization.tone;
    }

    // Modify content style based on style variation
    if (strategy.customization.style) {
      modifiedPreferences.contentStyle = strategy.customization.style;
    }

    return modifiedPreferences;
  }

  private _getTemperatureForVariation(variationType: VariationType): number {
    // Adjust temperature based on variation type for more diverse outputs
    switch (variationType) {
      case 'tone-variation':
        return 0.8; // Higher creativity for tone changes
      case 'style-variation':
        return 0.9; // Highest creativity for style changes
      case 'format-variation':
        return 0.6; // Lower creativity for format changes
      case 'length-variation':
        return 0.7; // Medium creativity for length changes
      case 'keyword-variation':
        return 0.5; // Lower creativity to maintain keyword focus
      default:
        return 0.7; // Default temperature
    }
  }
}

// Export singleton instance
export const contentVariationService = new ContentVariationService();