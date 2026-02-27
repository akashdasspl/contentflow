// Brand Voice Consistency Engine for ContentFlow AI

import { bedrockService } from './bedrock-service';
import { 
  Platform, 
  ContentType,
  GeneratedContent,
  UserPreferences,
  ContentCustomizationOptions,
} from '../types';
import { 
  logInfo,
  logError,
  logWarning,
  getCurrentTimestamp,
} from '../utils';

// Brand voice analysis result
export interface BrandVoiceAnalysis {
  voiceId: string;
  characteristics: VoiceCharacteristics;
  styleGuide: StyleGuide;
  consistencyScore: number;
  adaptationRules: AdaptationRule[];
  platformSpecificAdjustments: Record<Platform, PlatformAdjustment>;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCharacteristics {
  tone: string; // e.g., "professional", "friendly", "authoritative"
  formality: 'formal' | 'semi-formal' | 'casual';
  personality: string[]; // e.g., ["approachable", "knowledgeable", "trustworthy"]
  vocabulary: VocabularyProfile;
  sentenceStructure: SentenceStructureProfile;
  emotionalTone: EmotionalToneProfile;
}

export interface VocabularyProfile {
  complexity: 'simple' | 'moderate' | 'complex';
  industryTerms: string[];
  avoidedWords: string[];
  preferredWords: string[];
  jargonLevel: 'none' | 'minimal' | 'moderate' | 'heavy';
}

export interface SentenceStructureProfile {
  averageLength: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'compound' | 'complex';
  activeVoicePreference: number; // 0-1 scale
  questionUsage: 'rare' | 'occasional' | 'frequent';
}

export interface EmotionalToneProfile {
  enthusiasm: number; // 0-1 scale
  empathy: number; // 0-1 scale
  authority: number; // 0-1 scale
  warmth: number; // 0-1 scale
  urgency: number; // 0-1 scale
}

export interface StyleGuide {
  writingPrinciples: string[];
  dosList: string[];
  dontsList: string[];
  examplePhrases: ExamplePhrase[];
  brandKeywords: string[];
  messagingPillars: string[];
}

export interface ExamplePhrase {
  context: string;
  goodExample: string;
  badExample: string;
  explanation: string;
}

export interface AdaptationRule {
  ruleId: string;
  condition: string;
  transformation: string;
  priority: number;
  platforms: Platform[];
  contentTypes: ContentType[];
}

export interface PlatformAdjustment {
  platform: Platform;
  adjustments: {
    toneShift?: string;
    formalityAdjustment?: number; // -1 to 1 scale
    lengthPreference?: 'shorter' | 'longer' | 'maintain';
    emphasisStyle?: string;
    callToActionStyle?: string;
  };
  platformSpecificRules: string[];
}

// Brand voice consistency options
export interface BrandVoiceConsistencyOptions {
  content: GeneratedContent;
  userPreferences: UserPreferences;
  targetPlatform?: Platform;
  customizationOptions?: ContentCustomizationOptions;
  enforceStrictConsistency?: boolean;
  crossPlatformReference?: GeneratedContent[];
}

// Brand voice consistency result
export interface BrandVoiceConsistencyResult {
  originalContent: string;
  optimizedContent: string;
  voiceAnalysis: BrandVoiceAnalysis;
  consistencyScore: number;
  appliedAdjustments: AppliedAdjustment[];
  crossPlatformConsistency: CrossPlatformConsistencyCheck;
  recommendations: string[];
  processingTime: number;
}

export interface AppliedAdjustment {
  type: 'tone' | 'formality' | 'vocabulary' | 'structure' | 'platform-specific';
  description: string;
  beforeText: string;
  afterText: string;
  confidence: number;
}

export interface CrossPlatformConsistencyCheck {
  overallScore: number;
  platformScores: Record<Platform, number>;
  inconsistencies: ConsistencyIssue[];
  recommendations: string[];
}

export interface ConsistencyIssue {
  type: 'tone-mismatch' | 'formality-inconsistency' | 'vocabulary-deviation' | 'style-conflict';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedPlatforms: Platform[];
  suggestion: string;
}

// Brand Voice Consistency Engine
export class BrandVoiceConsistencyEngine {
  private voiceAnalysisCache: Map<string, BrandVoiceAnalysis> = new Map();
  private consistencyRules: Map<string, AdaptationRule[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Apply brand voice consistency to content
   */
  async applyBrandVoiceConsistency(
    options: BrandVoiceConsistencyOptions
  ): Promise<BrandVoiceConsistencyResult> {
    const startTime = Date.now();
    const { content, userPreferences, targetPlatform, customizationOptions } = options;

    logInfo('Applying brand voice consistency', {
      contentId: content.contentId,
      brandVoice: userPreferences.brandVoice,
      platform: targetPlatform || content.platform,
    });

    try {
      // Analyze brand voice characteristics
      const voiceAnalysis = await this.analyzeBrandVoice(userPreferences.brandVoice);

      // Apply style adaptation based on user preferences
      const styleAdaptedContent = await this.adaptContentStyle(
        content,
        voiceAnalysis,
        customizationOptions
      );

      // Apply platform-specific adjustments
      const platform = targetPlatform || content.platform;
      const platformOptimizedContent = await this.applyPlatformSpecificAdjustments(
        styleAdaptedContent,
        voiceAnalysis,
        platform
      );

      // Perform cross-platform consistency check
      const crossPlatformConsistency = await this.performCrossPlatformConsistencyCheck(
        platformOptimizedContent,
        voiceAnalysis,
        options.crossPlatformReference || []
      );

      // Calculate overall consistency score
      const consistencyScore = this.calculateConsistencyScore(
        content.generatedText,
        platformOptimizedContent,
        voiceAnalysis,
        crossPlatformConsistency
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        voiceAnalysis,
        crossPlatformConsistency,
        consistencyScore
      );

      const processingTime = Date.now() - startTime;

      logInfo('Brand voice consistency applied successfully', {
        contentId: content.contentId,
        consistencyScore,
        processingTime,
      });

      return {
        originalContent: content.generatedText,
        optimizedContent: platformOptimizedContent,
        voiceAnalysis,
        consistencyScore,
        appliedAdjustments: [], // Will be populated by individual adjustment methods
        crossPlatformConsistency,
        recommendations,
        processingTime,
      };

    } catch (error) {
      logError('Failed to apply brand voice consistency', error);
      throw new Error(`Brand voice consistency failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze brand voice characteristics from user preferences
   */
  private async analyzeBrandVoice(brandVoiceDescription: string): Promise<BrandVoiceAnalysis> {
    // Check cache first
    const cacheKey = this.generateCacheKey(brandVoiceDescription);
    if (this.voiceAnalysisCache.has(cacheKey)) {
      return this.voiceAnalysisCache.get(cacheKey)!;
    }

    logInfo('Analyzing brand voice characteristics', { brandVoice: brandVoiceDescription });

    const analysisPrompt = `
      Analyze the following brand voice description and extract detailed characteristics:
      
      Brand Voice: "${brandVoiceDescription}"
      
      Please provide a detailed analysis in the following JSON format:
      {
        "tone": "primary tone (e.g., professional, friendly, authoritative)",
        "formality": "formal|semi-formal|casual",
        "personality": ["trait1", "trait2", "trait3"],
        "vocabulary": {
          "complexity": "simple|moderate|complex",
          "jargonLevel": "none|minimal|moderate|heavy"
        },
        "sentenceStructure": {
          "averageLength": "short|medium|long",
          "complexity": "simple|compound|complex",
          "activeVoicePreference": 0.8,
          "questionUsage": "rare|occasional|frequent"
        },
        "emotionalTone": {
          "enthusiasm": 0.7,
          "empathy": 0.6,
          "authority": 0.8,
          "warmth": 0.5,
          "urgency": 0.3
        }
      }
      
      Focus on extracting specific, actionable characteristics that can guide content adaptation.
    `;

    try {
      const result = await bedrockService.generateContent({
        contentIdea: analysisPrompt,
        contentType: 'blog-post',
        platform: 'blog',
        intent: 'informational',
        maxTokens: 1000,
      });

      // Parse the AI response to extract characteristics
      const characteristics = this.parseVoiceCharacteristics(result.content, brandVoiceDescription);
      
      const voiceAnalysis: BrandVoiceAnalysis = {
        voiceId: cacheKey,
        characteristics,
        styleGuide: this.generateStyleGuide(characteristics, brandVoiceDescription),
        consistencyScore: 1.0, // Initial perfect score
        adaptationRules: this.generateAdaptationRules(characteristics),
        platformSpecificAdjustments: this.generatePlatformAdjustments(characteristics),
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      };

      // Cache the analysis
      this.voiceAnalysisCache.set(cacheKey, voiceAnalysis);

      return voiceAnalysis;

    } catch (error) {
      logError('Failed to analyze brand voice', error);
      // Return default analysis if AI analysis fails
      return this.getDefaultVoiceAnalysis(brandVoiceDescription);
    }
  }

  /**
   * Adapt content style based on voice analysis and customization options
   */
  private async adaptContentStyle(
    content: GeneratedContent,
    voiceAnalysis: BrandVoiceAnalysis,
    customizationOptions?: ContentCustomizationOptions
  ): Promise<string> {
    logInfo('Adapting content style', {
      contentId: content.contentId,
      voiceId: voiceAnalysis.voiceId,
    });

    const adaptationPrompt = `
      Adapt the following content to match the specified brand voice characteristics while maintaining the core message and structure:

      Original Content:
      ${content.generatedText}

      Brand Voice Characteristics:
      - Tone: ${voiceAnalysis.characteristics.tone}
      - Formality: ${voiceAnalysis.characteristics.formality}
      - Personality: ${voiceAnalysis.characteristics.personality.join(', ')}
      - Vocabulary Complexity: ${voiceAnalysis.characteristics.vocabulary.complexity}
      - Sentence Structure: ${voiceAnalysis.characteristics.sentenceStructure.averageLength} sentences, ${voiceAnalysis.characteristics.sentenceStructure.complexity} structure
      - Emotional Tone: Enthusiasm ${voiceAnalysis.characteristics.emotionalTone.enthusiasm}, Authority ${voiceAnalysis.characteristics.emotionalTone.authority}, Warmth ${voiceAnalysis.characteristics.emotionalTone.warmth}

      Style Guide Principles:
      ${voiceAnalysis.styleGuide.writingPrinciples.map(p => `- ${p}`).join('\n')}

      ${customizationOptions ? `
      Additional Customization:
      - Tone Override: ${customizationOptions.tone || 'maintain brand voice'}
      - Length Preference: ${customizationOptions.length || 'maintain original'}
      - Style Override: ${customizationOptions.style || 'maintain brand voice'}
      ` : ''}

      Please adapt the content while:
      1. Maintaining the original message and key information
      2. Preserving the content structure and format
      3. Applying the brand voice characteristics consistently
      4. Keeping the same approximate length unless specified otherwise
      5. Ensuring the adapted content sounds natural and engaging

      Return only the adapted content without additional commentary.
    `;

    try {
      const result = await bedrockService.generateContent({
        contentIdea: adaptationPrompt,
        contentType: content.contentType,
        platform: content.platform,
        intent: 'informational',
        maxTokens: Math.ceil(content.generatedText.length * 1.3),
      });

      return result.content.trim();

    } catch (error) {
      logError('Failed to adapt content style', error);
      return content.generatedText; // Return original content if adaptation fails
    }
  }

  /**
   * Apply platform-specific adjustments to maintain brand voice consistency
   */
  private async applyPlatformSpecificAdjustments(
    content: string,
    voiceAnalysis: BrandVoiceAnalysis,
    platform: Platform
  ): Promise<string> {
    const platformAdjustment = voiceAnalysis.platformSpecificAdjustments[platform];
    if (!platformAdjustment) {
      return content; // No specific adjustments needed
    }

    logInfo('Applying platform-specific brand voice adjustments', {
      platform,
      adjustments: platformAdjustment.adjustments,
    });

    const adjustmentPrompt = `
      Adapt the following content for ${platform} while maintaining brand voice consistency:

      Content:
      ${content}

      Platform-Specific Adjustments for ${platform}:
      ${platformAdjustment.adjustments.toneShift ? `- Tone Shift: ${platformAdjustment.adjustments.toneShift}` : ''}
      ${platformAdjustment.adjustments.formalityAdjustment ? `- Formality Adjustment: ${platformAdjustment.adjustments.formalityAdjustment > 0 ? 'more formal' : 'less formal'}` : ''}
      ${platformAdjustment.adjustments.lengthPreference ? `- Length Preference: ${platformAdjustment.adjustments.lengthPreference}` : ''}
      ${platformAdjustment.adjustments.emphasisStyle ? `- Emphasis Style: ${platformAdjustment.adjustments.emphasisStyle}` : ''}
      ${platformAdjustment.adjustments.callToActionStyle ? `- Call to Action Style: ${platformAdjustment.adjustments.callToActionStyle}` : ''}

      Platform-Specific Rules:
      ${platformAdjustment.platformSpecificRules.map(rule => `- ${rule}`).join('\n')}

      Maintain the core brand voice while making these platform-specific adaptations.
      Return only the adapted content.
    `;

    try {
      const result = await bedrockService.generateContent({
        contentIdea: adjustmentPrompt,
        contentType: 'social-post', // Use social-post for platform adaptations
        platform,
        intent: 'informational',
        maxTokens: Math.ceil(content.length * 1.2),
      });

      return result.content.trim();

    } catch (error) {
      logError('Failed to apply platform-specific adjustments', error);
      return content; // Return original content if adjustment fails
    }
  }

  /**
   * Perform cross-platform consistency check
   */
  private async performCrossPlatformConsistencyCheck(
    currentContent: string,
    voiceAnalysis: BrandVoiceAnalysis,
    referenceContent: GeneratedContent[]
  ): Promise<CrossPlatformConsistencyCheck> {
    logInfo('Performing cross-platform consistency check', {
      referenceContentCount: referenceContent.length,
    });

    const platformScores: Record<Platform, number> = {} as Record<Platform, number>;
    const inconsistencies: ConsistencyIssue[] = [];

    // Analyze consistency with reference content from other platforms
    for (const refContent of referenceContent) {
      const consistencyScore = await this.calculateContentConsistency(
        currentContent,
        refContent.generatedText,
        voiceAnalysis
      );

      platformScores[refContent.platform] = consistencyScore;

      // Identify inconsistencies
      if (consistencyScore < 0.7) {
        inconsistencies.push({
          type: 'tone-mismatch',
          description: `Content tone inconsistency detected with ${refContent.platform} content`,
          severity: consistencyScore < 0.5 ? 'high' : 'medium',
          affectedPlatforms: [refContent.platform],
          suggestion: `Adjust tone to better match the brand voice established in ${refContent.platform} content`,
        });
      }
    }

    const overallScore = referenceContent.length > 0 
      ? Object.values(platformScores).reduce((sum, score) => sum + score, 0) / Object.values(platformScores).length
      : 1.0; // Perfect score if no reference content

    const recommendations = this.generateConsistencyRecommendations(inconsistencies, overallScore);

    return {
      overallScore,
      platformScores,
      inconsistencies,
      recommendations,
    };
  }

  /**
   * Calculate consistency score between two pieces of content
   */
  private async calculateContentConsistency(
    content1: string,
    content2: string,
    voiceAnalysis: BrandVoiceAnalysis
  ): Promise<number> {
    // Simple heuristic-based consistency calculation
    // In a production system, this could use more sophisticated NLP analysis

    let consistencyScore = 1.0;

    // Check tone consistency (simplified)
    const tone1 = this.analyzeTone(content1);
    const tone2 = this.analyzeTone(content2);
    const toneConsistency = this.calculateToneConsistency(tone1, tone2);
    consistencyScore *= toneConsistency;

    // Check vocabulary consistency
    const vocab1 = this.extractVocabulary(content1);
    const vocab2 = this.extractVocabulary(content2);
    const vocabConsistency = this.calculateVocabularyConsistency(vocab1, vocab2);
    consistencyScore *= vocabConsistency;

    // Check sentence structure consistency
    const structure1 = this.analyzeSentenceStructure(content1);
    const structure2 = this.analyzeSentenceStructure(content2);
    const structureConsistency = this.calculateStructureConsistency(structure1, structure2);
    consistencyScore *= structureConsistency;

    return Math.max(0, Math.min(1, consistencyScore));
  }

  /**
   * Calculate overall consistency score
   */
  private calculateConsistencyScore(
    originalContent: string,
    optimizedContent: string,
    voiceAnalysis: BrandVoiceAnalysis,
    crossPlatformConsistency: CrossPlatformConsistencyCheck
  ): number {
    // Weighted combination of different consistency factors
    const brandVoiceAdherence = this.calculateBrandVoiceAdherence(optimizedContent, voiceAnalysis);
    const crossPlatformScore = crossPlatformConsistency.overallScore;
    const adaptationQuality = this.calculateAdaptationQuality(originalContent, optimizedContent);

    return (brandVoiceAdherence * 0.5) + (crossPlatformScore * 0.3) + (adaptationQuality * 0.2);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    voiceAnalysis: BrandVoiceAnalysis,
    crossPlatformConsistency: CrossPlatformConsistencyCheck,
    consistencyScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (consistencyScore < 0.8) {
      recommendations.push('Consider refining brand voice definition for better consistency');
    }

    if (crossPlatformConsistency.overallScore < 0.7) {
      recommendations.push('Review content across platforms to ensure consistent brand voice application');
    }

    if (crossPlatformConsistency.inconsistencies.length > 0) {
      recommendations.push('Address identified inconsistencies to improve brand voice coherence');
    }

    // Add specific recommendations based on voice characteristics
    if (voiceAnalysis.characteristics.vocabulary.complexity === 'complex') {
      recommendations.push('Consider simplifying vocabulary for broader audience appeal on social platforms');
    }

    if (voiceAnalysis.characteristics.emotionalTone.enthusiasm < 0.3) {
      recommendations.push('Consider adding more engaging elements to increase audience connection');
    }

    return recommendations;
  }

  // Helper methods for analysis
  private parseVoiceCharacteristics(aiResponse: string, brandVoiceDescription: string): VoiceCharacteristics {
    try {
      // Try to parse JSON response from AI
      const parsed = JSON.parse(aiResponse);
      return {
        tone: parsed.tone || 'professional',
        formality: parsed.formality || 'semi-formal',
        personality: parsed.personality || ['professional', 'reliable'],
        vocabulary: {
          complexity: parsed.vocabulary?.complexity || 'moderate',
          industryTerms: [],
          avoidedWords: [],
          preferredWords: [],
          jargonLevel: parsed.vocabulary?.jargonLevel || 'minimal',
        },
        sentenceStructure: {
          averageLength: parsed.sentenceStructure?.averageLength || 'medium',
          complexity: parsed.sentenceStructure?.complexity || 'compound',
          activeVoicePreference: parsed.sentenceStructure?.activeVoicePreference || 0.7,
          questionUsage: parsed.sentenceStructure?.questionUsage || 'occasional',
        },
        emotionalTone: {
          enthusiasm: parsed.emotionalTone?.enthusiasm || 0.5,
          empathy: parsed.emotionalTone?.empathy || 0.5,
          authority: parsed.emotionalTone?.authority || 0.6,
          warmth: parsed.emotionalTone?.warmth || 0.5,
          urgency: parsed.emotionalTone?.urgency || 0.3,
        },
      };
    } catch (error) {
      // Fallback to heuristic analysis if JSON parsing fails
      return this.heuristicVoiceAnalysis(brandVoiceDescription);
    }
  }

  private heuristicVoiceAnalysis(brandVoiceDescription: string): VoiceCharacteristics {
    const description = brandVoiceDescription.toLowerCase();
    
    // Determine tone
    let tone = 'professional';
    if (description.includes('friendly') || description.includes('warm')) tone = 'friendly';
    if (description.includes('authoritative') || description.includes('expert')) tone = 'authoritative';
    if (description.includes('casual') || description.includes('relaxed')) tone = 'casual';

    // Determine formality
    let formality: 'formal' | 'semi-formal' | 'casual' = 'semi-formal';
    if (description.includes('formal') || description.includes('professional')) formality = 'formal';
    if (description.includes('casual') || description.includes('informal')) formality = 'casual';

    // Extract personality traits
    const personality: string[] = [];
    if (description.includes('trustworthy')) personality.push('trustworthy');
    if (description.includes('approachable')) personality.push('approachable');
    if (description.includes('knowledgeable')) personality.push('knowledgeable');
    if (description.includes('innovative')) personality.push('innovative');
    if (personality.length === 0) personality.push('professional', 'reliable');

    return {
      tone,
      formality,
      personality,
      vocabulary: {
        complexity: 'moderate',
        industryTerms: [],
        avoidedWords: [],
        preferredWords: [],
        jargonLevel: 'minimal',
      },
      sentenceStructure: {
        averageLength: 'medium',
        complexity: 'compound',
        activeVoicePreference: 0.7,
        questionUsage: 'occasional',
      },
      emotionalTone: {
        enthusiasm: 0.5,
        empathy: 0.5,
        authority: 0.6,
        warmth: 0.5,
        urgency: 0.3,
      },
    };
  }

  private generateStyleGuide(characteristics: VoiceCharacteristics, brandVoiceDescription: string): StyleGuide {
    return {
      writingPrinciples: [
        `Maintain ${characteristics.tone} tone throughout all content`,
        `Use ${characteristics.formality} language appropriate for the audience`,
        `Reflect ${characteristics.personality.join(', ')} personality traits`,
        'Ensure consistency across all platforms and content types',
      ],
      dosList: [
        'Use active voice when possible',
        'Keep sentences clear and concise',
        'Include relevant keywords naturally',
        'Maintain consistent terminology',
      ],
      dontsList: [
        'Use overly complex jargon without explanation',
        'Switch between formal and casual tone within the same piece',
        'Include contradictory messaging',
        'Ignore platform-specific best practices',
      ],
      examplePhrases: [],
      brandKeywords: [],
      messagingPillars: [],
    };
  }

  private generateAdaptationRules(characteristics: VoiceCharacteristics): AdaptationRule[] {
    const rules: AdaptationRule[] = [];

    // Tone-based rules
    rules.push({
      ruleId: 'tone-consistency',
      condition: 'content tone mismatch',
      transformation: `Adjust to ${characteristics.tone} tone`,
      priority: 1,
      platforms: ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'],
      contentTypes: ['blog-post', 'social-post', 'caption', 'script'],
    });

    // Formality rules
    rules.push({
      ruleId: 'formality-adjustment',
      condition: 'formality level mismatch',
      transformation: `Adjust to ${characteristics.formality} formality`,
      priority: 2,
      platforms: ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'],
      contentTypes: ['blog-post', 'social-post', 'caption', 'script'],
    });

    return rules;
  }

  private generatePlatformAdjustments(characteristics: VoiceCharacteristics): Record<Platform, PlatformAdjustment> {
    const adjustments: Record<Platform, PlatformAdjustment> = {} as Record<Platform, PlatformAdjustment>;

    // LinkedIn - more professional
    adjustments.linkedin = {
      platform: 'linkedin',
      adjustments: {
        formalityAdjustment: 0.2,
        emphasisStyle: 'professional insights',
        callToActionStyle: 'professional networking',
      },
      platformSpecificRules: [
        'Use industry-appropriate terminology',
        'Include professional insights',
        'Encourage professional engagement',
      ],
    };

    // Twitter - more concise
    adjustments.twitter = {
      platform: 'twitter',
      adjustments: {
        lengthPreference: 'shorter',
        emphasisStyle: 'punchy and direct',
        callToActionStyle: 'engagement-focused',
      },
      platformSpecificRules: [
        'Keep content concise and impactful',
        'Use relevant hashtags sparingly',
        'Encourage retweets and replies',
      ],
    };

    // Instagram - more visual and engaging
    adjustments.instagram = {
      platform: 'instagram',
      adjustments: {
        toneShift: 'more engaging and visual',
        emphasisStyle: 'storytelling',
        callToActionStyle: 'visual engagement',
      },
      platformSpecificRules: [
        'Reference visual content',
        'Use storytelling approach',
        'Include engaging call-to-actions',
      ],
    };

    // Add other platforms with default adjustments
    const defaultPlatforms: Platform[] = ['facebook', 'youtube', 'tiktok', 'blog'];
    defaultPlatforms.forEach(platform => {
      adjustments[platform] = {
        platform,
        adjustments: {},
        platformSpecificRules: ['Maintain brand voice consistency'],
      };
    });

    return adjustments;
  }

  private getDefaultVoiceAnalysis(brandVoiceDescription: string): BrandVoiceAnalysis {
    const characteristics = this.heuristicVoiceAnalysis(brandVoiceDescription);
    
    return {
      voiceId: this.generateCacheKey(brandVoiceDescription),
      characteristics,
      styleGuide: this.generateStyleGuide(characteristics, brandVoiceDescription),
      consistencyScore: 0.8, // Default score
      adaptationRules: this.generateAdaptationRules(characteristics),
      platformSpecificAdjustments: this.generatePlatformAdjustments(characteristics),
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };
  }

  private generateCacheKey(brandVoiceDescription: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < brandVoiceDescription.length; i++) {
      const char = brandVoiceDescription.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `voice_${Math.abs(hash)}`;
  }

  private initializeDefaultRules(): void {
    // Initialize default consistency rules
    // This could be expanded with more sophisticated rules
  }

  // Simplified analysis methods (could be enhanced with NLP libraries)
  private analyzeTone(content: string): string {
    const words = content.toLowerCase().split(/\s+/);
    
    const professionalWords = ['professional', 'expertise', 'solution', 'strategy', 'implement'];
    const friendlyWords = ['great', 'awesome', 'love', 'enjoy', 'wonderful'];
    const authoritativeWords = ['must', 'should', 'essential', 'critical', 'important'];

    const professionalCount = words.filter(word => professionalWords.includes(word)).length;
    const friendlyCount = words.filter(word => friendlyWords.includes(word)).length;
    const authoritativeCount = words.filter(word => authoritativeWords.includes(word)).length;

    if (professionalCount > friendlyCount && professionalCount > authoritativeCount) return 'professional';
    if (friendlyCount > authoritativeCount) return 'friendly';
    return 'authoritative';
  }

  private extractVocabulary(content: string): string[] {
    return content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
  }

  private analyzeSentenceStructure(content: string): { avgLength: number; complexity: string } {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalWords = content.split(/\s+/).length;
    const avgLength = totalWords / sentences.length;

    const complexity = avgLength > 20 ? 'complex' : avgLength > 12 ? 'compound' : 'simple';

    return { avgLength, complexity };
  }

  private calculateToneConsistency(tone1: string, tone2: string): number {
    return tone1 === tone2 ? 1.0 : 0.7;
  }

  private calculateVocabularyConsistency(vocab1: string[], vocab2: string[]): number {
    const intersection = vocab1.filter(word => vocab2.includes(word));
    const union = [...new Set([...vocab1, ...vocab2])];
    return intersection.length / union.length;
  }

  private calculateStructureConsistency(structure1: any, structure2: any): number {
    const lengthDiff = Math.abs(structure1.avgLength - structure2.avgLength);
    const lengthConsistency = Math.max(0, 1 - (lengthDiff / 20));
    const complexityConsistency = structure1.complexity === structure2.complexity ? 1.0 : 0.8;
    return (lengthConsistency + complexityConsistency) / 2;
  }

  private calculateBrandVoiceAdherence(content: string, voiceAnalysis: BrandVoiceAnalysis): number {
    // Simplified brand voice adherence calculation
    const contentTone = this.analyzeTone(content);
    const toneMatch = contentTone === voiceAnalysis.characteristics.tone ? 1.0 : 0.7;
    
    const contentStructure = this.analyzeSentenceStructure(content);
    const structureMatch = contentStructure.complexity === voiceAnalysis.characteristics.sentenceStructure.complexity ? 1.0 : 0.8;
    
    return (toneMatch + structureMatch) / 2;
  }

  private calculateAdaptationQuality(originalContent: string, optimizedContent: string): number {
    // Simple quality check - ensure content was actually modified but maintains core message
    const similarity = this.calculateContentSimilarity(originalContent, optimizedContent);
    
    // Good adaptation should be similar enough to preserve meaning but different enough to show improvement
    if (similarity > 0.9) return 0.7; // Too similar, minimal adaptation
    if (similarity < 0.5) return 0.6; // Too different, may have lost meaning
    return 1.0; // Good balance
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = this.extractVocabulary(content1);
    const words2 = this.extractVocabulary(content2);
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }

  private generateConsistencyRecommendations(inconsistencies: ConsistencyIssue[], overallScore: number): string[] {
    const recommendations: string[] = [];

    if (overallScore < 0.7) {
      recommendations.push('Review brand voice definition and ensure it is clear and actionable');
    }

    inconsistencies.forEach(issue => {
      recommendations.push(issue.suggestion);
    });

    if (recommendations.length === 0) {
      recommendations.push('Brand voice consistency is good across platforms');
    }

    return recommendations;
  }
}

// Export singleton instance
export const brandVoiceConsistencyEngine = new BrandVoiceConsistencyEngine();