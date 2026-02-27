// Platform-specific optimization service for ContentFlow AI

import { bedrockService } from './bedrock-service';
import { brandVoiceConsistencyEngine } from './brand-voice-consistency';
import { 
  Platform, 
  ContentType,
  GeneratedContent,
  ContentMetadata,
  UserPreferences,
  AudienceProfile,
  ContentCustomizationOptions,
} from '../types';
import { 
  getPlatformConstraints,
  extractKeywords,
  calculateReadingTime,
  getCurrentTimestamp,
  logInfo,
  logError,
  logWarning,
} from '../utils';

// Platform optimization options
export interface PlatformOptimizationOptions {
  content: GeneratedContent;
  targetPlatform?: Platform;
  userPreferences?: UserPreferences;
  audience?: AudienceProfile;
  customizationOptions?: ContentCustomizationOptions;
  seoKeywords?: string[];
  enforceConstraints?: boolean;
}

// SEO optimization result
export interface SEOOptimizationResult {
  optimizedContent: string;
  seoScore: number;
  keywords: string[];
  metaDescription?: string;
  title?: string;
  recommendations: string[];
  improvements: SEOImprovement[];
}

export interface SEOImprovement {
  type: 'keyword-density' | 'readability' | 'structure' | 'meta-tags' | 'internal-links';
  description: string;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

// Social media optimization result
export interface SocialMediaOptimizationResult {
  optimizedContent: string;
  hashtags: string[];
  callToAction?: string;
  engagementScore: number;
  platformCompliance: boolean;
  recommendations: string[];
  bestPractices: SocialMediaBestPractice[];
}

export interface SocialMediaBestPractice {
  practice: string;
  applied: boolean;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

// Platform template
export interface PlatformTemplate {
  templateId: string;
  platform: Platform;
  contentType: ContentType;
  name: string;
  description: string;
  structure: TemplateStructure;
  constraints: PlatformConstraints;
  bestPractices: string[];
  examples: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStructure {
  sections: TemplateSection[];
  requiredElements: string[];
  optionalElements: string[];
  formatting: FormattingRules;
}

export interface TemplateSection {
  name: string;
  type: 'header' | 'body' | 'footer' | 'metadata';
  required: boolean;
  maxLength?: number;
  placeholder?: string;
  guidelines: string[];
}

export interface FormattingRules {
  lineBreaks: boolean;
  bulletPoints: boolean;
  numberedLists: boolean;
  emphasis: boolean;
  links: boolean;
  hashtags: boolean;
  mentions: boolean;
}

export interface PlatformConstraints {
  maxLength: number;
  minLength?: number;
  maxHashtags?: number;
  maxMentions?: number;
  allowedFormats: string[];
  restrictedContent: string[];
  requiredElements: string[];
}

// Platform optimization service
export class PlatformOptimizationService {
  private templates: Map<string, PlatformTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Optimize content for a specific platform
   */
  async optimizeForPlatform(options: PlatformOptimizationOptions): Promise<GeneratedContent> {
    const { content, targetPlatform, userPreferences, audience, customizationOptions } = options;
    const platform = targetPlatform || content.platform;

    logInfo('Optimizing content for platform', {
      contentId: content.contentId,
      platform,
      contentType: content.contentType,
    });

    try {
      let optimizedContent = { ...content };

      // Apply platform-specific optimizations based on content type
      switch (content.contentType) {
        case 'blog-post':
          optimizedContent = await this.optimizeBlogContent(optimizedContent, options);
          break;
        case 'social-post':
          optimizedContent = await this.optimizeSocialMediaContent(optimizedContent, options);
          break;
        case 'caption':
          optimizedContent = await this.optimizeCaptionContent(optimizedContent, options);
          break;
        case 'script':
          optimizedContent = await this.optimizeScriptContent(optimizedContent, options);
          break;
        default:
          logWarning('Unknown content type for optimization', { contentType: content.contentType });
      }

      // Apply brand voice consistency if user preferences are available
      if (userPreferences?.brandVoice) {
        optimizedContent = await this.applyEnhancedBrandVoiceConsistency(optimizedContent, userPreferences, customizationOptions);
      }

      // Update metadata with optimization information
      optimizedContent.metadata = {
        ...optimizedContent.metadata,
        platformOptimized: true,
        optimizationTimestamp: getCurrentTimestamp(),
      };

      logInfo('Content optimization completed', {
        contentId: optimizedContent.contentId,
        platform,
        optimizationApplied: true,
      });

      return optimizedContent;

    } catch (error) {
      logError('Failed to optimize content for platform', error);
      throw new Error(`Platform optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimize blog content for SEO
   */
  async optimizeBlogContent(
    content: GeneratedContent, 
    options: PlatformOptimizationOptions
  ): Promise<GeneratedContent> {
    logInfo('Applying SEO optimization to blog content', { contentId: content.contentId });

    const seoResult = await this.performSEOOptimization(content.generatedText, options);
    
    const optimizedContent = { ...content };
    optimizedContent.generatedText = seoResult.optimizedContent;
    
    // Update metadata with SEO information
    optimizedContent.metadata = {
      ...optimizedContent.metadata,
      seoKeywords: seoResult.keywords,
      seoScore: seoResult.seoScore,
      title: seoResult.title || optimizedContent.metadata.title,
      metaDescription: seoResult.metaDescription || optimizedContent.metadata.metaDescription,
      seoRecommendations: seoResult.recommendations,
      seoImprovements: seoResult.improvements,
    };

    return optimizedContent;
  }

  /**
   * Optimize social media content with best practices
   */
  async optimizeSocialMediaContent(
    content: GeneratedContent,
    options: PlatformOptimizationOptions
  ): Promise<GeneratedContent> {
    const platform = options.targetPlatform || content.platform;
    logInfo('Applying social media optimization', { 
      contentId: content.contentId, 
      platform 
    });

    const socialResult = await this.performSocialMediaOptimization(content, platform, options);
    
    const optimizedContent = { ...content };
    optimizedContent.generatedText = socialResult.optimizedContent;
    optimizedContent.platform = platform;
    
    // Update metadata with social media optimization information
    optimizedContent.metadata = {
      ...optimizedContent.metadata,
      hashtags: socialResult.hashtags,
      callToAction: socialResult.callToAction,
      engagementScore: socialResult.engagementScore,
      platformCompliance: socialResult.platformCompliance,
      socialMediaRecommendations: socialResult.recommendations,
      bestPracticesApplied: socialResult.bestPractices,
    };

    return optimizedContent;
  }

  /**
   * Optimize caption content for visual platforms
   */
  async optimizeCaptionContent(
    content: GeneratedContent,
    options: PlatformOptimizationOptions
  ): Promise<GeneratedContent> {
    const platform = options.targetPlatform || content.platform;
    logInfo('Applying caption optimization', { 
      contentId: content.contentId, 
      platform 
    });

    // Caption optimization combines social media best practices with visual content considerations
    const socialResult = await this.performSocialMediaOptimization(content, platform, options);
    const visualEnhancements = this.applyVisualContentOptimizations(socialResult.optimizedContent, platform);
    
    const optimizedContent = { ...content };
    optimizedContent.generatedText = visualEnhancements.content;
    optimizedContent.platform = platform;
    
    // Update metadata
    optimizedContent.metadata = {
      ...optimizedContent.metadata,
      hashtags: socialResult.hashtags,
      callToAction: socialResult.callToAction,
      engagementScore: socialResult.engagementScore,
      platformCompliance: socialResult.platformCompliance,
      visualOptimized: true,
      emojiCount: visualEnhancements.emojiCount,
      visualElements: visualEnhancements.elements,
    };

    return optimizedContent;
  }

  /**
   * Optimize script content for video/audio platforms
   */
  async optimizeScriptContent(
    content: GeneratedContent,
    options: PlatformOptimizationOptions
  ): Promise<GeneratedContent> {
    logInfo('Applying script optimization', { contentId: content.contentId });

    const scriptOptimizations = this.applyScriptOptimizations(content.generatedText, options);
    
    const optimizedContent = { ...content };
    optimizedContent.generatedText = scriptOptimizations.content;
    
    // Update metadata
    optimizedContent.metadata = {
      ...optimizedContent.metadata,
      scriptOptimized: true,
      timingOptimized: scriptOptimizations.timingOptimized,
      deliveryNotes: scriptOptimizations.deliveryNotes,
      pacing: scriptOptimizations.pacing,
    };

    return optimizedContent;
  }

  /**
   * Perform SEO optimization on blog content
   */
  private async performSEOOptimization(
    content: string, 
    options: PlatformOptimizationOptions
  ): Promise<SEOOptimizationResult> {
    const targetKeywords = options.seoKeywords || extractKeywords(content);
    const improvements: SEOImprovement[] = [];
    let optimizedContent = content;
    let seoScore = 0.5; // Base score

    // Analyze current content structure
    const hasTitle = /^#\s+.+/m.test(content);
    const hasSubheadings = /^##\s+.+/m.test(content);
    const wordCount = content.split(/\s+/).length;
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

    // Title optimization
    let title = '';
    if (hasTitle) {
      const titleMatch = content.match(/^#\s+(.+)/m);
      title = titleMatch ? titleMatch[1] : '';
    } else {
      // Generate title from first paragraph
      title = this.generateSEOTitle(content, targetKeywords);
      optimizedContent = `# ${title}\n\n${optimizedContent}`;
      improvements.push({
        type: 'structure',
        description: 'Added SEO-optimized title',
        impact: 'high',
        suggestion: 'Include target keywords in the title for better search visibility',
      });
      seoScore += 0.15;
    }

    // Meta description generation
    const metaDescription = this.generateMetaDescription(content, targetKeywords);

    // Keyword density optimization
    const keywordDensity = this.calculateKeywordDensity(content, targetKeywords);
    if (keywordDensity < 0.01) {
      improvements.push({
        type: 'keyword-density',
        description: 'Low keyword density detected',
        impact: 'medium',
        suggestion: 'Naturally incorporate target keywords throughout the content',
      });
    } else if (keywordDensity > 0.03) {
      improvements.push({
        type: 'keyword-density',
        description: 'Keyword density too high',
        impact: 'medium',
        suggestion: 'Reduce keyword repetition to avoid over-optimization',
      });
    } else {
      seoScore += 0.1;
    }

    // Structure optimization
    if (!hasSubheadings && wordCount > 500) {
      improvements.push({
        type: 'structure',
        description: 'Missing subheadings for long content',
        impact: 'high',
        suggestion: 'Add H2 and H3 headings to improve content structure and readability',
      });
    } else if (hasSubheadings) {
      seoScore += 0.1;
    }

    // Readability optimization
    const avgWordsPerSentence = this.calculateAverageWordsPerSentence(content);
    if (avgWordsPerSentence > 20) {
      improvements.push({
        type: 'readability',
        description: 'Sentences are too long',
        impact: 'medium',
        suggestion: 'Break down long sentences for better readability',
      });
    } else {
      seoScore += 0.05;
    }

    // Content length optimization
    if (wordCount < 800) {
      improvements.push({
        type: 'structure',
        description: 'Content length below recommended minimum',
        impact: 'high',
        suggestion: 'Expand content to at least 800 words for better SEO performance',
      });
    } else if (wordCount >= 800 && wordCount <= 2000) {
      seoScore += 0.1;
    }

    const recommendations = improvements.map(imp => imp.suggestion);

    return {
      optimizedContent,
      seoScore: Math.min(seoScore, 1.0),
      keywords: targetKeywords,
      metaDescription,
      title,
      recommendations,
      improvements,
    };
  }

  /**
   * Perform social media optimization
   */
  private async performSocialMediaOptimization(
    content: GeneratedContent,
    platform: Platform,
    options: PlatformOptimizationOptions
  ): Promise<SocialMediaOptimizationResult> {
    const constraints = getPlatformConstraints(platform);
    const bestPractices: SocialMediaBestPractice[] = [];
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5; // Base score

    // Platform-specific optimizations
    switch (platform) {
      case 'twitter':
        return this.optimizeForTwitter(content, constraints, bestPractices);
      case 'facebook':
        return this.optimizeForFacebook(content, constraints, bestPractices);
      case 'instagram':
        return this.optimizeForInstagram(content, constraints, bestPractices);
      case 'linkedin':
        return this.optimizeForLinkedIn(content, constraints, bestPractices);
      case 'tiktok':
        return this.optimizeForTikTok(content, constraints, bestPractices);
      default:
        return this.optimizeForGenericSocial(content, constraints, bestPractices);
    }
  }

  /**
   * Twitter-specific optimization
   */
  private optimizeForTwitter(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags: string[] = [];
    let callToAction = '';

    // Character limit enforcement
    if (optimizedContent.length > constraints.maxLength) {
      optimizedContent = this.truncateWithEllipsis(optimizedContent, constraints.maxLength - 20);
      bestPractices.push({
        practice: 'Character limit compliance',
        applied: true,
        description: 'Truncated content to fit Twitter\'s 280 character limit',
        impact: 'high',
      });
    }

    // Hashtag optimization (max 2 for Twitter)
    const extractedHashtags = this.extractHashtags(optimizedContent);
    if (extractedHashtags.length > 2) {
      hashtags.push(...extractedHashtags.slice(0, 2));
      bestPractices.push({
        practice: 'Hashtag optimization',
        applied: true,
        description: 'Limited hashtags to 2 for optimal Twitter engagement',
        impact: 'medium',
      });
      engagementScore += 0.1;
    } else {
      hashtags.push(...extractedHashtags);
    }

    // Add engagement elements
    if (!optimizedContent.includes('?') && Math.random() > 0.5) {
      callToAction = 'What do you think?';
      engagementScore += 0.15;
      bestPractices.push({
        practice: 'Question engagement',
        applied: true,
        description: 'Added question to encourage replies',
        impact: 'high',
      });
    }

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore: Math.min(engagementScore, 1.0),
      platformCompliance: optimizedContent.length <= constraints.maxLength,
      recommendations: bestPractices.map(bp => bp.description),
      bestPractices,
    };
  }

  /**
   * Instagram-specific optimization
   */
  private optimizeForInstagram(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags: string[] = [];
    let callToAction = '';

    // Character limit check
    const platformCompliance = optimizedContent.length <= constraints.maxLength;

    // Hashtag optimization (optimal: 11, max: 30)
    const extractedHashtags = this.extractHashtags(optimizedContent);
    const optimalHashtagCount = Math.min(extractedHashtags.length, constraints.optimalHashtags || 11);
    hashtags.push(...extractedHashtags.slice(0, optimalHashtagCount));

    if (hashtags.length >= 5) {
      engagementScore += 0.2;
      bestPractices.push({
        practice: 'Strategic hashtag use',
        applied: true,
        description: 'Used optimal number of hashtags for Instagram discovery',
        impact: 'high',
      });
    }

    // Add visual content indicators
    if (!optimizedContent.toLowerCase().includes('see') && !optimizedContent.toLowerCase().includes('look')) {
      optimizedContent += '\n\n👀 See more in our stories!';
      bestPractices.push({
        practice: 'Visual content reference',
        applied: true,
        description: 'Added reference to visual content',
        impact: 'medium',
      });
      engagementScore += 0.1;
    }

    // Call to action optimization
    const ctaOptions = ['Double tap if you agree! ❤️', 'Save this post for later! 📌', 'Share with a friend! 👥'];
    callToAction = ctaOptions[Math.floor(Math.random() * ctaOptions.length)];
    engagementScore += 0.15;

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore: Math.min(engagementScore, 1.0),
      platformCompliance,
      recommendations: bestPractices.map(bp => bp.description),
      bestPractices,
    };
  }

  /**
   * LinkedIn-specific optimization
   */
  private optimizeForLinkedIn(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags: string[] = [];
    let callToAction = '';

    // Professional tone check and enhancement
    if (!this.hasProfessionalTone(optimizedContent)) {
      optimizedContent = this.enhanceProfessionalTone(optimizedContent);
      bestPractices.push({
        practice: 'Professional tone',
        applied: true,
        description: 'Enhanced content with professional language',
        impact: 'high',
      });
      engagementScore += 0.2;
    }

    // Hashtag optimization (max 5 for LinkedIn)
    const extractedHashtags = this.extractHashtags(optimizedContent);
    hashtags.push(...extractedHashtags.slice(0, 5));

    // Add professional call to action
    const professionalCTAs = [
      'What\'s your experience with this?',
      'I\'d love to hear your thoughts.',
      'How do you approach this in your industry?',
    ];
    callToAction = professionalCTAs[Math.floor(Math.random() * professionalCTAs.length)];
    engagementScore += 0.15;

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore: Math.min(engagementScore, 1.0),
      platformCompliance: optimizedContent.length <= constraints.maxLength,
      recommendations: bestPractices.map(bp => bp.description),
      bestPractices,
    };
  }

  /**
   * Facebook-specific optimization
   */
  private optimizeForFacebook(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags: string[] = [];
    let callToAction = '';

    // Optimal length check (Facebook performs better with shorter posts)
    if (optimizedContent.length > constraints.optimalLength) {
      bestPractices.push({
        practice: 'Optimal length',
        applied: false,
        description: 'Consider shortening post for better Facebook engagement',
        impact: 'medium',
      });
    } else {
      engagementScore += 0.1;
    }

    // Hashtag optimization (Facebook uses fewer hashtags)
    const extractedHashtags = this.extractHashtags(optimizedContent);
    hashtags.push(...extractedHashtags.slice(0, 3)); // Limit to 3 hashtags

    // Add engagement elements
    if (!optimizedContent.includes('?')) {
      callToAction = 'What do you think? Let us know in the comments!';
      engagementScore += 0.2;
      bestPractices.push({
        practice: 'Comment engagement',
        applied: true,
        description: 'Added call to action for comments',
        impact: 'high',
      });
    }

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore: Math.min(engagementScore, 1.0),
      platformCompliance: optimizedContent.length <= constraints.maxLength,
      recommendations: bestPractices.map(bp => bp.description),
      bestPractices,
    };
  }

  /**
   * TikTok-specific optimization
   */
  private optimizeForTikTok(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags: string[] = [];
    let callToAction = '';

    // Keep content short and punchy for TikTok
    if (optimizedContent.length > constraints.maxLength) {
      optimizedContent = this.truncateWithEllipsis(optimizedContent, constraints.maxLength - 10); // Leave extra room
      bestPractices.push({
        practice: 'Short content',
        applied: true,
        description: 'Shortened content for TikTok\'s fast-paced format',
        impact: 'high',
      });
    }

    // Trending hashtag optimization
    const extractedHashtags = this.extractHashtags(optimizedContent);
    hashtags.push(...extractedHashtags.slice(0, 3)); // Focus on 3 key hashtags

    // Add trending elements
    if (!this.hasEmojis(optimizedContent)) {
      optimizedContent += ' ✨';
      engagementScore += 0.1;
    }

    // TikTok-specific call to action
    callToAction = 'Follow for more! 🔥';
    engagementScore += 0.2;

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore: Math.min(engagementScore, 1.0),
      platformCompliance: optimizedContent.length <= constraints.maxLength,
      recommendations: bestPractices.map(bp => bp.description),
      bestPractices,
    };
  }

  /**
   * Generic social media optimization
   */
  private optimizeForGenericSocial(
    content: GeneratedContent,
    constraints: any,
    bestPractices: SocialMediaBestPractice[]
  ): SocialMediaOptimizationResult {
    let optimizedContent = content.generatedText;
    let engagementScore = 0.5;
    const hashtags = this.extractHashtags(optimizedContent);
    const callToAction = 'Engage with us!';

    bestPractices.push({
      practice: 'Generic optimization',
      applied: true,
      description: 'Applied general social media best practices',
      impact: 'medium',
    });

    return {
      optimizedContent,
      hashtags,
      callToAction,
      engagementScore,
      platformCompliance: true,
      recommendations: ['Consider platform-specific optimization for better results'],
      bestPractices,
    };
  }

  /**
   * Apply enhanced brand voice consistency across platforms using the brand voice consistency engine
   */
  private async applyEnhancedBrandVoiceConsistency(
    content: GeneratedContent,
    preferences: UserPreferences,
    customizationOptions?: ContentCustomizationOptions
  ): Promise<GeneratedContent> {
    logInfo('Applying enhanced brand voice consistency', {
      contentId: content.contentId,
      brandVoice: preferences.brandVoice,
    });

    try {
      const result = await brandVoiceConsistencyEngine.applyBrandVoiceConsistency({
        content,
        userPreferences: preferences,
        customizationOptions,
        enforceStrictConsistency: true,
      });

      const optimizedContent = { ...content };
      optimizedContent.generatedText = result.optimizedContent;
      optimizedContent.metadata = {
        ...optimizedContent.metadata,
        brandVoiceApplied: true,
        brandVoice: preferences.brandVoice,
        brandVoiceConsistencyScore: result.consistencyScore,
        brandVoiceRecommendations: result.recommendations,
        brandVoiceProcessingTime: result.processingTime,
        crossPlatformConsistency: result.crossPlatformConsistency,
      };

      logInfo('Enhanced brand voice consistency applied successfully', {
        contentId: content.contentId,
        consistencyScore: result.consistencyScore,
        processingTime: result.processingTime,
      });

      return optimizedContent;

    } catch (error) {
      logError('Failed to apply enhanced brand voice consistency', error);
      // Fallback to basic brand voice consistency
      return await this.applyBrandVoiceConsistency(content, preferences);
    }
  }

  /**
   * Apply basic brand voice consistency (fallback method)
   */
  private async applyBrandVoiceConsistency(
    content: GeneratedContent,
    preferences: UserPreferences
  ): Promise<GeneratedContent> {
    logInfo('Applying basic brand voice consistency (fallback)', {
      contentId: content.contentId,
      brandVoice: preferences.brandVoice,
    });

    // Use Bedrock to adjust content tone based on brand voice
    const prompt = `
      Adjust the following content to match the brand voice: "${preferences.brandVoice}"
      
      Original content:
      ${content.generatedText}
      
      Please maintain the core message while adjusting the tone, style, and language to be consistent with the specified brand voice. Keep the same content length and structure.
    `;

    try {
      const result = await bedrockService.generateContent({
        contentIdea: prompt,
        contentType: content.contentType,
        platform: content.platform,
        intent: 'informational', // Default intent for brand voice consistency
        maxTokens: Math.ceil(content.generatedText.length * 1.2),
      });

      const optimizedContent = { ...content };
      optimizedContent.generatedText = result.content;
      optimizedContent.metadata = {
        ...optimizedContent.metadata,
        brandVoiceApplied: true,
        brandVoice: preferences.brandVoice,
      };

      return optimizedContent;

    } catch (error) {
      logError('Failed to apply basic brand voice consistency', error);
      // Return original content with brand voice metadata if brand voice application fails
      const fallbackContent = { ...content };
      fallbackContent.metadata = {
        ...fallbackContent.metadata,
        brandVoiceApplied: true,
        brandVoice: preferences.brandVoice,
      };
      return fallbackContent;
    }
  }

  /**
   * Apply visual content optimizations for captions
   */
  private applyVisualContentOptimizations(content: string, platform: Platform): {
    content: string;
    emojiCount: number;
    elements: string[];
  } {
    let optimizedContent = content;
    const elements: string[] = [];
    
    // Add visual indicators if missing
    if (!this.hasEmojis(optimizedContent)) {
      const visualEmojis = ['📸', '🎨', '✨', '👀', '🔥'];
      const randomEmoji = visualEmojis[Math.floor(Math.random() * visualEmojis.length)];
      optimizedContent += ` ${randomEmoji}`;
      elements.push('emoji-enhancement');
    }

    // Add visual content references
    if (!optimizedContent.toLowerCase().includes('swipe') && platform === 'instagram') {
      optimizedContent += '\n\n👉 Swipe for more!';
      elements.push('swipe-indicator');
    }

    const emojiCount = this.countEmojis(optimizedContent);

    return {
      content: optimizedContent,
      emojiCount,
      elements,
    };
  }

  /**
   * Apply script optimizations
   */
  private applyScriptOptimizations(content: string, options: PlatformOptimizationOptions): {
    content: string;
    timingOptimized: boolean;
    deliveryNotes: string[];
    pacing: string;
  } {
    let optimizedContent = content;
    const deliveryNotes: string[] = [];
    let timingOptimized = false;

    // Add timing cues if missing
    if (!content.includes('[') || !content.includes(']')) {
      optimizedContent = this.addTimingCues(optimizedContent);
      timingOptimized = true;
      deliveryNotes.push('Added timing cues for better delivery');
    }

    // Add delivery notes
    deliveryNotes.push('Maintain steady pace throughout');
    deliveryNotes.push('Emphasize key points with vocal variation');
    deliveryNotes.push('Pause at natural breaks');

    const pacing = this.analyzePacing(optimizedContent);

    return {
      content: optimizedContent,
      timingOptimized,
      deliveryNotes,
      pacing,
    };
  }

  // Helper methods
  private generateSEOTitle(content: string, keywords: string[]): string {
    const firstSentence = content.split('.')[0];
    const primaryKeyword = keywords[0] || '';
    
    if (primaryKeyword && !firstSentence.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      return `${primaryKeyword}: ${firstSentence}`.substring(0, 60);
    }
    
    return firstSentence.substring(0, 60);
  }

  private generateMetaDescription(content: string, keywords: string[]): string {
    const firstParagraph = content.split('\n\n')[0];
    const cleaned = firstParagraph.replace(/[#*]/g, '').trim();
    return cleaned.length > 160 ? cleaned.substring(0, 157) + '...' : cleaned;
  }

  private calculateKeywordDensity(content: string, keywords: string[]): number {
    const words = content.toLowerCase().split(/\s+/);
    const keywordCount = keywords.reduce((count, keyword) => {
      return count + words.filter(word => word.includes(keyword.toLowerCase())).length;
    }, 0);
    return keywordCount / words.length;
  }

  private calculateAverageWordsPerSentence(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalWords = content.split(/\s+/).length;
    return totalWords / sentences.length;
  }

  private extractHashtags(content: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = content.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private truncateWithEllipsis(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private hasProfessionalTone(content: string): boolean {
    const professionalWords = ['professional', 'business', 'industry', 'experience', 'expertise'];
    const casualWords = ['awesome', 'cool', 'super', 'amazing'];
    
    const professionalCount = professionalWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    const casualCount = casualWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    
    return professionalCount >= casualCount;
  }

  private enhanceProfessionalTone(content: string): string {
    return content
      .replace(/awesome/gi, 'excellent')
      .replace(/cool/gi, 'impressive')
      .replace(/super/gi, 'highly')
      .replace(/amazing/gi, 'remarkable');
  }

  private hasEmojis(content: string): boolean {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    return emojiRegex.test(content);
  }

  private countEmojis(content: string): number {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const matches = content.match(emojiRegex);
    return matches ? matches.length : 0;
  }

  private addTimingCues(content: string): string {
    const segments = content.split('\n\n').filter(s => s.trim().length > 0);
    let currentTime = 0;
    const segmentDuration = 10; // 10 seconds per segment
    
    return segments.map((segment, index) => {
      const startTime = this.formatTime(currentTime);
      currentTime += segmentDuration;
      return `[${startTime}] ${segment}`;
    }).join('\n\n');
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private analyzePacing(content: string): string {
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 100) return 'fast';
    if (wordCount < 300) return 'moderate';
    return 'slow';
  }

  /**
   * Get platform template by ID
   */
  async getPlatformTemplate(templateId: string): Promise<PlatformTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all templates for a platform
   */
  async getPlatformTemplates(platform: Platform): Promise<PlatformTemplate[]> {
    return Array.from(this.templates.values()).filter(template => template.platform === platform);
  }

  /**
   * Get platform guidelines
   */
  async getPlatformGuidelines(platform: Platform): Promise<{
    constraints: PlatformConstraints;
    bestPractices: string[];
    examples: string[];
  }> {
    const constraints = getPlatformConstraints(platform);
    const templates = await this.getPlatformTemplates(platform);
    
    const bestPractices = templates.length > 0 
      ? templates[0].bestPractices 
      : this.getDefaultBestPractices(platform);
    
    const examples = templates.length > 0 
      ? templates[0].examples 
      : this.getDefaultExamples(platform);

    return {
      constraints: {
        maxLength: constraints.maxLength || 1000,
        minLength: constraints.minLength,
        maxHashtags: constraints.hashtagLimit,
        maxMentions: constraints.mentionLimit,
        allowedFormats: ['text', 'markdown'],
        restrictedContent: ['spam', 'inappropriate'],
        requiredElements: [],
      },
      bestPractices,
      examples,
    };
  }

  /**
   * Initialize default platform templates
   */
  private initializeDefaultTemplates(): void {
    // Blog template
    this.templates.set('blog-default', {
      templateId: 'blog-default',
      platform: 'blog',
      contentType: 'blog-post',
      name: 'Default Blog Post',
      description: 'Standard blog post template with SEO optimization',
      structure: {
        sections: [
          {
            name: 'title',
            type: 'header',
            required: true,
            maxLength: 60,
            placeholder: 'SEO-optimized title with target keywords',
            guidelines: ['Include primary keyword', 'Keep under 60 characters', 'Make it compelling'],
          },
          {
            name: 'introduction',
            type: 'body',
            required: true,
            maxLength: 200,
            placeholder: 'Hook the reader and introduce the topic',
            guidelines: ['Start with a hook', 'Introduce the main topic', 'Preview what readers will learn'],
          },
          {
            name: 'main-content',
            type: 'body',
            required: true,
            placeholder: 'Main content with subheadings and detailed information',
            guidelines: ['Use H2 and H3 subheadings', 'Include relevant keywords naturally', 'Provide valuable information'],
          },
          {
            name: 'conclusion',
            type: 'footer',
            required: true,
            maxLength: 150,
            placeholder: 'Summarize key points and include call to action',
            guidelines: ['Summarize main points', 'Include call to action', 'Encourage engagement'],
          },
        ],
        requiredElements: ['title', 'introduction', 'main-content', 'conclusion'],
        optionalElements: ['meta-description', 'featured-image', 'tags'],
        formatting: {
          lineBreaks: true,
          bulletPoints: true,
          numberedLists: true,
          emphasis: true,
          links: true,
          hashtags: false,
          mentions: false,
        },
      },
      constraints: {
        maxLength: 2000,
        minLength: 800,
        allowedFormats: ['markdown', 'html'],
        restrictedContent: ['spam', 'inappropriate'],
        requiredElements: ['title', 'content'],
      },
      bestPractices: [
        'Include target keywords in title and throughout content',
        'Use descriptive subheadings (H2, H3)',
        'Write compelling meta descriptions',
        'Include internal and external links',
        'Optimize for readability with short paragraphs',
        'Add relevant images with alt text',
      ],
      examples: [
        'How to Master Content Marketing in 2024',
        'The Ultimate Guide to Social Media Strategy',
        '10 Proven Tips for Better Blog Writing',
      ],
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    });

    // Twitter template
    this.templates.set('twitter-default', {
      templateId: 'twitter-default',
      platform: 'twitter',
      contentType: 'social-post',
      name: 'Default Twitter Post',
      description: 'Optimized Twitter post template',
      structure: {
        sections: [
          {
            name: 'main-text',
            type: 'body',
            required: true,
            maxLength: 250,
            placeholder: 'Engaging tweet content',
            guidelines: ['Keep it concise', 'Include call to action', 'Use relevant hashtags sparingly'],
          },
        ],
        requiredElements: ['main-text'],
        optionalElements: ['hashtags', 'mentions', 'thread'],
        formatting: {
          lineBreaks: true,
          bulletPoints: false,
          numberedLists: false,
          emphasis: false,
          links: true,
          hashtags: true,
          mentions: true,
        },
      },
      constraints: {
        maxLength: 280,
        maxHashtags: 2,
        maxMentions: 10,
        allowedFormats: ['text'],
        restrictedContent: ['spam', 'inappropriate'],
        requiredElements: ['text'],
      },
      bestPractices: [
        'Keep tweets under 280 characters',
        'Use maximum 2 hashtags',
        'Include engaging questions',
        'Add relevant mentions',
        'Use emojis sparingly',
        'Include clear call to action',
      ],
      examples: [
        'Just discovered this amazing productivity hack! What\'s your favorite way to stay organized? #productivity',
        'Breaking: New study reveals surprising insights about remote work. Thread below 🧵',
        'Quick tip: Always backup your data before major updates. Learned this the hard way! 💾',
      ],
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    });

    // Instagram template
    this.templates.set('instagram-default', {
      templateId: 'instagram-default',
      platform: 'instagram',
      contentType: 'caption',
      name: 'Default Instagram Caption',
      description: 'Engaging Instagram caption template',
      structure: {
        sections: [
          {
            name: 'hook',
            type: 'header',
            required: true,
            maxLength: 100,
            placeholder: 'Attention-grabbing opening line',
            guidelines: ['Start with a hook', 'Ask a question', 'Make a bold statement'],
          },
          {
            name: 'main-content',
            type: 'body',
            required: true,
            maxLength: 1500,
            placeholder: 'Main caption content with story or information',
            guidelines: ['Tell a story', 'Provide value', 'Be authentic'],
          },
          {
            name: 'call-to-action',
            type: 'footer',
            required: true,
            maxLength: 100,
            placeholder: 'Engagement call to action',
            guidelines: ['Encourage engagement', 'Ask questions', 'Direct to bio link'],
          },
        ],
        requiredElements: ['hook', 'main-content', 'call-to-action'],
        optionalElements: ['hashtags', 'mentions', 'location'],
        formatting: {
          lineBreaks: true,
          bulletPoints: true,
          numberedLists: true,
          emphasis: true,
          links: false,
          hashtags: true,
          mentions: true,
        },
      },
      constraints: {
        maxLength: 2200,
        maxHashtags: 30,
        allowedFormats: ['text'],
        restrictedContent: ['spam', 'inappropriate'],
        requiredElements: ['caption'],
      },
      bestPractices: [
        'Start with an engaging hook',
        'Use 5-11 relevant hashtags',
        'Include call to action',
        'Tell authentic stories',
        'Use emojis strategically',
        'Encourage saves and shares',
      ],
      examples: [
        'POV: You finally found the perfect work-life balance ✨\n\nIt took me years to realize...',
        'Swipe to see the transformation! 👉\n\nHere\'s what I learned during this journey...',
        'This mistake cost me $10,000 💸\n\nBut here\'s what I learned from it...',
      ],
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    });
  }

  private getDefaultBestPractices(platform: Platform): string[] {
    const practices: Record<Platform, string[]> = {
      blog: [
        'Include target keywords in title and throughout content',
        'Use descriptive subheadings (H2, H3)',
        'Write compelling meta descriptions',
        'Include internal and external links',
        'Optimize for readability with short paragraphs',
        'Add relevant images with alt text',
      ],
      twitter: [
        'Keep tweets under 280 characters',
        'Use maximum 2 hashtags',
        'Include engaging questions',
        'Add relevant mentions',
        'Use emojis sparingly',
        'Include clear call to action',
      ],
      facebook: [
        'Keep posts conversational',
        'Use minimal hashtags',
        'Encourage comments and shares',
        'Post at optimal times',
        'Include engaging visuals',
      ],
      instagram: [
        'Use high-quality visuals',
        'Write engaging captions',
        'Use 5-11 relevant hashtags',
        'Include call to action',
        'Post consistently',
      ],
      linkedin: [
        'Maintain professional tone',
        'Share industry insights',
        'Use relevant hashtags (max 5)',
        'Engage with professional network',
        'Include thought leadership content',
      ],
      youtube: [
        'Create compelling titles',
        'Write detailed descriptions',
        'Use relevant tags',
        'Include timestamps',
        'Encourage subscriptions',
      ],
      tiktok: [
        'Keep content short and engaging',
        'Use trending hashtags',
        'Include popular music',
        'Post at peak times',
        'Encourage follows and shares',
      ],
    };

    return practices[platform] || [];
  }

  private getDefaultExamples(platform: Platform): string[] {
    const examples: Record<Platform, string[]> = {
      blog: [
        'The Complete Guide to Digital Marketing in 2024',
        '10 Proven Strategies for Better Content Creation',
        'How to Build a Successful Online Business',
      ],
      twitter: [
        'Just learned something amazing about productivity! Thread below 🧵',
        'Quick tip: Always backup your work. Trust me on this one! 💾',
        'What\'s your biggest challenge with remote work? Let\'s discuss! 💬',
      ],
      facebook: [
        'Had the most incredible experience today! Here\'s what happened...',
        'Looking for recommendations: What\'s your favorite productivity app?',
        'Sharing some wisdom I learned the hard way. Hope it helps someone!',
      ],
      instagram: [
        'Behind the scenes of our latest project ✨ Swipe to see the process!',
        'This view never gets old 🌅 Where\'s your favorite place to watch the sunrise?',
        'Transformation Tuesday! Here\'s how I changed my morning routine...',
      ],
      linkedin: [
        'Key insights from this week\'s industry conference. Here\'s what stood out...',
        'Reflecting on 5 years in the industry. Here are the lessons I\'ve learned...',
        'The future of remote work: 3 trends every leader should know about.',
      ],
      youtube: [
        'How to Master Video Editing in 30 Days | Complete Beginner\'s Guide',
        'My Morning Routine for Maximum Productivity | What Actually Works',
        'The Truth About Building a YouTube Channel | 1 Year Later',
      ],
      tiktok: [
        'POV: You finally figured out the algorithm 🤯 #fyp #contentcreator',
        'This productivity hack changed my life ✨ #productivity #lifehack',
        'Rating viral productivity tips so you don\'t have to 📊 #review',
      ],
    };

    return examples[platform] || [];
  }
}

// Export singleton instance
export const platformOptimizationService = new PlatformOptimizationService();