// Platform-specific content generators for ContentFlow AI

import { bedrockService } from './bedrock-service';
import { contentQualityService } from './content-quality';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  UserPreferences,
  AudienceProfile,
  GeneratedContent,
  ContentMetadata,
  ContentCustomizationOptions,
  ContentVariation,
  TimingCue,
} from '../types';
import { 
  getPlatformConstraints,
  calculateReadingTime,
  extractKeywords,
  generateContentId,
  generateIdeaId,
  getCurrentTimestamp,
  logInfo,
  logError,
  logWarning,
} from '../utils';

// Base interface for content generation options
export interface ContentGenerationOptions {
  contentIdea: string;
  userId: string;
  audience?: AudienceProfile | null;
  preferences?: UserPreferences | null;
  intent?: ContentIntent;
  variations?: number;
  customizationOptions?: ContentCustomizationOptions;
}

// Blog-specific options
export interface BlogGenerationOptions extends ContentGenerationOptions {
  targetWordCount?: number;
  seoKeywords?: string[];
  includeMetaDescription?: boolean;
}

// Social media-specific options
export interface SocialMediaGenerationOptions extends ContentGenerationOptions {
  platform: Platform;
  includeHashtags?: boolean;
  maxHashtags?: number;
  includeCallToAction?: boolean;
}

// Caption-specific options
export interface CaptionGenerationOptions extends ContentGenerationOptions {
  platform: Platform;
  includeEmojis?: boolean;
  hashtagStrategy?: 'trending' | 'niche' | 'branded';
}

// Script-specific options
export interface ScriptGenerationOptions extends ContentGenerationOptions {
  duration?: number; // in seconds
  includeTimingCues?: boolean;
  includeSpeakerNotes?: boolean;
  scriptType?: 'video' | 'audio' | 'presentation';
}

// Enhanced content generation with variations
export interface EnhancedContentGenerationOptions extends ContentGenerationOptions {
  generateVariations?: boolean;
  variationCount?: number;
  rankingCriteria?: any;
}

// Blog Content Generator
export class BlogContentGenerator {
  /**
   * Generate blog post content optimized for SEO and readability
   */
  async generateBlogPost(options: BlogGenerationOptions): Promise<GeneratedContent> {
    const {
      contentIdea,
      userId,
      audience,
      preferences,
      intent = 'informational',
      targetWordCount = 1200,
      seoKeywords = [],
      includeMetaDescription = true,
      variations = 1,
    } = options;

    logInfo('Generating blog post', {
      userId,
      contentIdea: contentIdea.substring(0, 50) + '...',
      targetWordCount,
      intent,
    });

    try {
      const bedrockOptions = {
        contentIdea,
        contentType: 'blog-post' as ContentType,
        audience,
        preferences,
        intent,
        variations,
        maxTokens: Math.ceil(targetWordCount * 1.5), // Rough token estimation
      };

      const result = await bedrockService.generateContent(bedrockOptions);
      
      // Extract SEO elements from generated content
      const content = result.content;
      const extractedKeywords = seoKeywords.length > 0 ? seoKeywords : extractKeywords(content);
      const readingTime = calculateReadingTime(content);
      
      // Extract title and meta description if present
      const titleMatch = content.match(/TITLE:\s*(.+)/i);
      const metaMatch = content.match(/META_DESCRIPTION:\s*(.+)/i);
      const keywordsMatch = content.match(/KEYWORDS:\s*(.+)/i);
      
      const title = titleMatch ? titleMatch[1].trim() : this._generateTitleFromContent(content);
      const metaDescription = metaMatch ? metaMatch[1].trim() : this._generateMetaDescription(content);
      const contentKeywords = keywordsMatch ? 
        keywordsMatch[1].split(',').map(k => k.trim()) : 
        extractedKeywords;

      // Clean content by removing metadata sections
      const cleanContent = this._cleanBlogContent(content);

      const metadata: ContentMetadata = {
        wordCount: result.metadata.wordCount,
        characterCount: result.metadata.characterCount,
        hashtags: [], // Blogs typically don't use hashtags
        seoKeywords: contentKeywords,
        readingTime,
        title,
        metaDescription: includeMetaDescription ? metaDescription : undefined,
        contentStructure: this._analyzeBlogStructure(cleanContent),
      };

      const generatedContent: GeneratedContent = {
        contentId: generateContentId(),
        ideaId: generateIdeaId(),
        userId,
        platform: 'blog',
        contentType: 'blog-post',
        generatedText: cleanContent,
        metadata,
        version: 1,
        status: 'generated',
        createdAt: getCurrentTimestamp(),
      };

      // Perform quality and safety checks
      logInfo('Performing quality and safety validation', { contentId: generatedContent.contentId });
      const qualityResult = await contentQualityService.validateContent(generatedContent);
      
      // Update content status based on quality check
      if (!qualityResult.isValid) {
        generatedContent.status = 'draft'; // Mark as draft if quality issues found
        logWarning('Content quality issues detected', {
          contentId: generatedContent.contentId,
          qualityScore: qualityResult.qualityScore,
          issueCount: qualityResult.issues.length,
          safetyFlagCount: qualityResult.safetyFlags.length,
        });
      }

      // Add quality metadata
      generatedContent.metadata.qualityScore = qualityResult.qualityScore;
      generatedContent.metadata.grammarScore = qualityResult.grammarScore;
      generatedContent.metadata.coherenceScore = qualityResult.coherenceScore;
      generatedContent.metadata.safetyScore = qualityResult.safetyScore;
      generatedContent.metadata.qualityIssues = qualityResult.issues;
      generatedContent.metadata.safetyFlags = qualityResult.safetyFlags;
      generatedContent.metadata.qualityRecommendations = qualityResult.recommendations;

      return generatedContent;

    } catch (error) {
      logError('Failed to generate blog post', error);
      throw new Error(`Blog post generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _generateTitleFromContent(content: string): string {
    // Extract first heading or first sentence as title
    const headingMatch = content.match(/^#\s*(.+)/m);
    if (headingMatch) return headingMatch[1].trim();
    
    const firstSentence = content.split('.')[0];
    return firstSentence.length > 60 ? firstSentence.substring(0, 57) + '...' : firstSentence;
  }

  private _generateMetaDescription(content: string): string {
    // Extract first paragraph or create summary
    const paragraphs = content.split('\n\n');
    const firstParagraph = paragraphs.find(p => p.trim().length > 50);
    
    if (firstParagraph) {
      const cleaned = firstParagraph.replace(/[#*]/g, '').trim();
      return cleaned.length > 160 ? cleaned.substring(0, 157) + '...' : cleaned;
    }
    
    return content.substring(0, 157) + '...';
  }

  private _cleanBlogContent(content: string): string {
    // Remove metadata sections
    return content
      .replace(/TITLE:\s*.+/gi, '')
      .replace(/META_DESCRIPTION:\s*.+/gi, '')
      .replace(/KEYWORDS:\s*.+/gi, '')
      .trim();
  }

  private _analyzeBlogStructure(content: string): any {
    const headings = content.match(/^#+\s*.+/gm) || [];
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    return {
      headingCount: headings.length,
      paragraphCount: paragraphs.length,
      hasIntroduction: paragraphs.length > 0,
      hasConclusion: content.toLowerCase().includes('conclusion') || content.toLowerCase().includes('summary'),
      structure: headings.map(h => h.trim()),
    };
  }
}

// Social Media Content Generator
export class SocialMediaContentGenerator {
  /**
   * Generate social media posts with platform-specific optimizations
   */
  async generateSocialPost(options: SocialMediaGenerationOptions): Promise<GeneratedContent> {
    const {
      contentIdea,
      userId,
      platform,
      audience,
      preferences,
      intent = 'promotional',
      includeHashtags = true,
      maxHashtags,
      includeCallToAction = true,
      variations = 1,
    } = options;

    logInfo('Generating social media post', {
      userId,
      platform,
      contentIdea: contentIdea.substring(0, 50) + '...',
      intent,
    });

    try {
      const constraints = getPlatformConstraints(platform);
      const hashtagLimit = maxHashtags || constraints.hashtagLimit || 5;

      const bedrockOptions = {
        contentIdea,
        contentType: 'social-post' as ContentType,
        platform,
        audience,
        preferences,
        intent,
        variations,
        maxTokens: Math.ceil((constraints.maxLength || 500) * 0.8), // Conservative token limit
      };

      const result = await bedrockService.generateContent(bedrockOptions);
      
      // Extract post components
      const content = result.content;
      const { postText, hashtags, callToAction } = this._extractSocialComponents(content);
      
      // Validate character limits
      const finalText = this._optimizeForPlatform(postText, platform, constraints);
      const finalHashtags = includeHashtags ? 
        hashtags.slice(0, hashtagLimit) : 
        [];

      const metadata: ContentMetadata = {
        wordCount: finalText.split(/\s+/).length,
        characterCount: finalText.length,
        hashtags: finalHashtags,
        seoKeywords: extractKeywords(finalText),
        readingTime: 1, // Social posts are quick reads
        callToAction: includeCallToAction ? callToAction : undefined,
        platformOptimized: true,
        engagementElements: this._analyzeEngagementElements(finalText),
      };

      const generatedContent: GeneratedContent = {
        contentId: generateContentId(),
        ideaId: generateIdeaId(),
        userId,
        platform,
        contentType: 'social-post',
        generatedText: finalText,
        metadata,
        version: 1,
        status: 'generated',
        createdAt: getCurrentTimestamp(),
      };

      // Perform quality and safety checks
      logInfo('Performing quality and safety validation', { contentId: generatedContent.contentId });
      const qualityResult = await contentQualityService.validateContent(generatedContent);
      
      // Update content status based on quality check
      if (!qualityResult.isValid) {
        generatedContent.status = 'draft';
        logWarning('Content quality issues detected', {
          contentId: generatedContent.contentId,
          qualityScore: qualityResult.qualityScore,
          issueCount: qualityResult.issues.length,
          safetyFlagCount: qualityResult.safetyFlags.length,
        });
      }

      // Add quality metadata
      generatedContent.metadata.qualityScore = qualityResult.qualityScore;
      generatedContent.metadata.grammarScore = qualityResult.grammarScore;
      generatedContent.metadata.coherenceScore = qualityResult.coherenceScore;
      generatedContent.metadata.safetyScore = qualityResult.safetyScore;
      generatedContent.metadata.qualityIssues = qualityResult.issues;
      generatedContent.metadata.safetyFlags = qualityResult.safetyFlags;
      generatedContent.metadata.qualityRecommendations = qualityResult.recommendations;

      return generatedContent;

    } catch (error) {
      logError('Failed to generate social media post', error);
      throw new Error(`Social media post generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _extractSocialComponents(content: string): { postText: string; hashtags: string[]; callToAction: string } {
    const postMatch = content.match(/POST_TEXT:\s*([\s\S]*?)(?=HASHTAGS:|CTA:|$)/i);
    const hashtagMatch = content.match(/HASHTAGS:\s*(.+)/i);
    const ctaMatch = content.match(/CTA:\s*(.+)/i);

    const postText = postMatch ? postMatch[1].trim() : content;
    const hashtags = hashtagMatch ? 
      hashtagMatch[1].split(/\s+/).filter(h => h.startsWith('#')).map(h => h.substring(1)) :
      this._extractHashtagsFromText(postText);
    const callToAction = ctaMatch ? ctaMatch[1].trim() : '';

    return { postText, hashtags, callToAction };
  }

  private _extractHashtagsFromText(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private _optimizeForPlatform(text: string, platform: Platform, constraints: any): string {
    if (!constraints.maxLength) return text;

    if (text.length <= constraints.maxLength) return text;

    // Truncate while preserving word boundaries
    const truncated = text.substring(0, constraints.maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > constraints.maxLength * 0.8 ? 
      truncated.substring(0, lastSpace) + '...' : 
      truncated + '...';
  }

  private _analyzeEngagementElements(text: string): any {
    return {
      hasQuestion: text.includes('?'),
      hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text),
      hasCallToAction: /\b(click|share|like|comment|follow|subscribe|learn more|sign up|buy now)\b/i.test(text),
      hasMention: text.includes('@'),
      hasHashtag: text.includes('#'),
      urgencyWords: (text.match(/\b(now|today|limited|exclusive|urgent|hurry)\b/gi) || []).length,
    };
  }
}

// Caption Content Generator
export class CaptionContentGenerator {
  /**
   * Generate captions with hashtags and CTAs optimized for visual content
   */
  async generateCaption(options: CaptionGenerationOptions): Promise<GeneratedContent> {
    const {
      contentIdea,
      userId,
      platform,
      audience,
      preferences,
      intent = 'entertainment',
      includeEmojis = true,
      hashtagStrategy = 'trending',
      variations = 1,
    } = options;

    logInfo('Generating caption', {
      userId,
      platform,
      contentIdea: contentIdea.substring(0, 50) + '...',
      intent,
      hashtagStrategy,
    });

    try {
      const constraints = getPlatformConstraints(platform);

      const bedrockOptions = {
        contentIdea,
        contentType: 'caption' as ContentType,
        platform,
        audience,
        preferences,
        intent,
        variations,
        maxTokens: Math.ceil((constraints.maxLength || 1000) * 0.6),
      };

      const result = await bedrockService.generateContent(bedrockOptions);
      
      // Extract caption components
      const content = result.content;
      const { captionText, hashtags, callToAction } = this._extractCaptionComponents(content);
      
      // Optimize hashtags based on strategy
      const optimizedHashtags = this._optimizeHashtags(hashtags, hashtagStrategy, platform);
      
      // Add emojis if requested and not present
      const finalCaption = includeEmojis ? 
        this._enhanceWithEmojis(captionText, intent) : 
        captionText;

      const metadata: ContentMetadata = {
        wordCount: finalCaption.split(/\s+/).length,
        characterCount: finalCaption.length,
        hashtags: optimizedHashtags,
        seoKeywords: extractKeywords(finalCaption),
        readingTime: 1,
        callToAction,
        visualContent: true,
        engagementOptimized: true,
        emojiCount: this._countEmojis(finalCaption),
      };

      const generatedContent: GeneratedContent = {
        contentId: generateContentId(),
        ideaId: generateIdeaId(),
        userId,
        platform,
        contentType: 'caption',
        generatedText: finalCaption,
        metadata,
        version: 1,
        status: 'generated',
        createdAt: getCurrentTimestamp(),
      };

      // Perform quality and safety checks
      logInfo('Performing quality and safety validation', { contentId: generatedContent.contentId });
      const qualityResult = await contentQualityService.validateContent(generatedContent);
      
      // Update content status based on quality check
      if (!qualityResult.isValid) {
        generatedContent.status = 'draft';
        logWarning('Content quality issues detected', {
          contentId: generatedContent.contentId,
          qualityScore: qualityResult.qualityScore,
          issueCount: qualityResult.issues.length,
          safetyFlagCount: qualityResult.safetyFlags.length,
        });
      }

      // Add quality metadata
      generatedContent.metadata.qualityScore = qualityResult.qualityScore;
      generatedContent.metadata.grammarScore = qualityResult.grammarScore;
      generatedContent.metadata.coherenceScore = qualityResult.coherenceScore;
      generatedContent.metadata.safetyScore = qualityResult.safetyScore;
      generatedContent.metadata.qualityIssues = qualityResult.issues;
      generatedContent.metadata.safetyFlags = qualityResult.safetyFlags;
      generatedContent.metadata.qualityRecommendations = qualityResult.recommendations;

      return generatedContent;

    } catch (error) {
      logError('Failed to generate caption', error);
      throw new Error(`Caption generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _extractCaptionComponents(content: string): { captionText: string; hashtags: string[]; callToAction: string } {
    const captionMatch = content.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|CTA:|$)/i);
    const hashtagMatch = content.match(/HASHTAGS:\s*(.+)/i);
    const ctaMatch = content.match(/CTA:\s*(.+)/i);

    const captionText = captionMatch ? captionMatch[1].trim() : content;
    const hashtags = hashtagMatch ? 
      hashtagMatch[1].split(/\s+/).filter(h => h.startsWith('#')).map(h => h.substring(1)) :
      this._extractHashtagsFromText(captionText);
    const callToAction = ctaMatch ? ctaMatch[1].trim() : '';

    return { captionText, hashtags, callToAction };
  }

  private _extractHashtagsFromText(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private _optimizeHashtags(hashtags: string[], strategy: string, platform: Platform): string[] {
    const constraints = getPlatformConstraints(platform);
    const maxHashtags = constraints.optimalHashtags || constraints.hashtagLimit || 10;

    // Filter and optimize based on strategy
    let optimizedTags = hashtags.slice(0, maxHashtags);

    switch (strategy) {
      case 'trending':
        // Prioritize broader, trending hashtags
        optimizedTags = optimizedTags.filter(tag => tag.length <= 15);
        break;
      case 'niche':
        // Prioritize specific, niche hashtags
        optimizedTags = optimizedTags.filter(tag => tag.length >= 5);
        break;
      case 'branded':
        // Mix of branded and general hashtags
        optimizedTags = optimizedTags.slice(0, Math.floor(maxHashtags * 0.7));
        break;
    }

    return optimizedTags;
  }

  private _enhanceWithEmojis(text: string, intent: ContentIntent): string {
    // Only add emojis if none are present
    if (this._countEmojis(text) > 0) return text;

    const emojiMap: Record<ContentIntent, string[]> = {
      entertainment: ['🎉', '😄', '🎊', '✨', '🔥'],
      educational: ['📚', '💡', '🎯', '📈', '🧠'],
      promotional: ['🚀', '💯', '⭐', '🎁', '👑'],
      informational: ['📊', '📋', '💭', '🔍', '📌'],
    };

    const emojis = emojiMap[intent] || emojiMap.informational;
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Always add emoji when requested and none present
    return `${text} ${randomEmoji}`;
  }

  private _countEmojis(text: string): number {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.length : 0;
  }
}

// Script Content Generator
export class ScriptContentGenerator {
  /**
   * Generate scripts with timing cues and speaker notes
   */
  async generateScript(options: ScriptGenerationOptions): Promise<GeneratedContent> {
    const {
      contentIdea,
      userId,
      audience,
      preferences,
      intent = 'educational',
      duration = 60,
      includeTimingCues = true,
      includeSpeakerNotes = true,
      scriptType = 'video',
      variations = 1,
    } = options;

    logInfo('Generating script', {
      userId,
      contentIdea: contentIdea.substring(0, 50) + '...',
      intent,
      duration,
      scriptType,
    });

    try {
      const bedrockOptions = {
        contentIdea,
        contentType: 'script' as ContentType,
        audience,
        preferences,
        intent,
        duration,
        variations,
        maxTokens: Math.ceil(duration * 3), // Rough estimation: 3 tokens per second
      };

      const result = await bedrockService.generateContent(bedrockOptions);
      
      // Parse script components
      const content = result.content;
      const { title, scriptContent, timingCues } = this._parseScriptContent(content);
      
      // Enhance with timing cues if requested
      const finalScript = includeTimingCues ? 
        this._enhanceWithTimingCues(scriptContent, duration) : 
        scriptContent;

      // Add speaker notes if requested
      const scriptWithNotes = includeSpeakerNotes ? 
        this._addSpeakerNotes(finalScript, scriptType) : 
        finalScript;

      const metadata: ContentMetadata = {
        wordCount: result.metadata.wordCount,
        characterCount: result.metadata.characterCount,
        hashtags: [], // Scripts don't typically use hashtags
        seoKeywords: extractKeywords(scriptContent),
        readingTime: Math.ceil(duration / 60), // Convert seconds to minutes
        timingCues: includeTimingCues ? timingCues : undefined,
        scriptDuration: duration,
        scriptType,
        speakerNotes: includeSpeakerNotes,
        estimatedWords: this._estimateWordsForDuration(duration),
      };

      const generatedContent: GeneratedContent = {
        contentId: generateContentId(),
        ideaId: generateIdeaId(),
        userId,
        platform: 'youtube', // Default platform for scripts
        contentType: 'script',
        generatedText: scriptWithNotes,
        metadata,
        version: 1,
        status: 'generated',
        createdAt: getCurrentTimestamp(),
      };

      // Perform quality and safety checks
      logInfo('Performing quality and safety validation', { contentId: generatedContent.contentId });
      const qualityResult = await contentQualityService.validateContent(generatedContent);
      
      // Update content status based on quality check
      if (!qualityResult.isValid) {
        generatedContent.status = 'draft';
        logWarning('Content quality issues detected', {
          contentId: generatedContent.contentId,
          qualityScore: qualityResult.qualityScore,
          issueCount: qualityResult.issues.length,
          safetyFlagCount: qualityResult.safetyFlags.length,
        });
      }

      // Add quality metadata
      generatedContent.metadata.qualityScore = qualityResult.qualityScore;
      generatedContent.metadata.grammarScore = qualityResult.grammarScore;
      generatedContent.metadata.coherenceScore = qualityResult.coherenceScore;
      generatedContent.metadata.safetyScore = qualityResult.safetyScore;
      generatedContent.metadata.qualityIssues = qualityResult.issues;
      generatedContent.metadata.safetyFlags = qualityResult.safetyFlags;
      generatedContent.metadata.qualityRecommendations = qualityResult.recommendations;

      return generatedContent;

    } catch (error) {
      logError('Failed to generate script', error);
      throw new Error(`Script generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _parseScriptContent(content: string): { title: string; scriptContent: string; timingCues: TimingCue[] } {
    const titleMatch = content.match(/TITLE:\s*(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Generated Script';
    
    // Extract existing timing cues
    const timingCues: TimingCue[] = [];
    const timingRegex = /\[(\d{2}:\d{2}(?:-\d{2}:\d{2})?)\]\s*([^:]+):\s*(.+)/g;
    let match;
    
    while ((match = timingRegex.exec(content)) !== null) {
      timingCues.push({
        timestamp: match[1],
        action: match[2].trim(),
        note: match[3].trim(),
      });
    }

    // Clean script content
    const scriptContent = content
      .replace(/TITLE:\s*.+/gi, '')
      .replace(/DURATION:\s*.+/gi, '')
      .replace(/WORD_COUNT:\s*.+/gi, '')
      .trim();

    return { title, scriptContent, timingCues };
  }

  private _enhanceWithTimingCues(script: string, duration: number): string {
    // If timing cues already exist, return as is
    if (script.includes('[') && script.includes(']')) {
      return script;
    }

    // Split script into segments and add timing cues
    const segments = script.split('\n\n').filter(s => s.trim().length > 0);
    const segmentDuration = duration / segments.length;
    
    let enhancedScript = '';
    let currentTime = 0;

    segments.forEach((segment, index) => {
      const startTime = this._formatTime(currentTime);
      const endTime = this._formatTime(currentTime + segmentDuration);
      
      enhancedScript += `[${startTime}-${endTime}] SEGMENT_${index + 1}: ${segment}\n\n`;
      currentTime += segmentDuration;
    });

    return enhancedScript.trim();
  }

  private _addSpeakerNotes(script: string, scriptType: string): string {
    const notes: Record<string, string[]> = {
      video: [
        'VISUAL: Maintain eye contact with camera',
        'PACING: Speak clearly and at moderate pace',
        'GESTURE: Use natural hand gestures',
        'TRANSITION: Pause between sections',
      ],
      audio: [
        'VOICE: Vary tone and inflection',
        'PACING: Include natural pauses',
        'EMPHASIS: Stress key points',
        'CLARITY: Enunciate clearly',
      ],
      presentation: [
        'SLIDE: Advance to next slide',
        'AUDIENCE: Make eye contact',
        'GESTURE: Point to relevant content',
        'INTERACTION: Pause for questions',
      ],
    };

    const relevantNotes = notes[scriptType] || notes.video;
    const noteText = relevantNotes.join('\n');
    
    return `${script}\n\n--- SPEAKER NOTES ---\n${noteText}`;
  }

  private _formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private _estimateWordsForDuration(duration: number): number {
    // Average speaking rate: 150 words per minute
    return Math.ceil((duration / 60) * 150);
  }
}

// Export generator instances
export const blogGenerator = new BlogContentGenerator();
export const socialMediaGenerator = new SocialMediaContentGenerator();
export const captionGenerator = new CaptionContentGenerator();
export const scriptGenerator = new ScriptContentGenerator();

// Export unified content generation function
export async function generatePlatformContent(
  contentType: ContentType,
  options: ContentGenerationOptions & { platform?: Platform }
): Promise<GeneratedContent> {
  switch (contentType) {
    case 'blog-post':
      return blogGenerator.generateBlogPost(options as BlogGenerationOptions);
    
    case 'social-post':
      if (!options.platform) throw new Error('Platform is required for social media posts');
      return socialMediaGenerator.generateSocialPost({
        ...options,
        platform: options.platform,
      } as SocialMediaGenerationOptions);
    
    case 'caption':
      if (!options.platform) throw new Error('Platform is required for captions');
      return captionGenerator.generateCaption({
        ...options,
        platform: options.platform,
      } as CaptionGenerationOptions);
    
    case 'script':
      return scriptGenerator.generateScript(options as ScriptGenerationOptions);
    
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

// Enhanced content generation with variations
export async function generateContentWithVariations(
  contentType: ContentType,
  options: EnhancedContentGenerationOptions & { platform?: Platform }
): Promise<{
  primaryContent: GeneratedContent;
  variations: ContentVariation[];
  rankingMetadata: any;
}> {
  const { contentVariationService } = await import('./content-variations');
  
  const variationOptions = {
    contentIdea: options.contentIdea,
    userId: options.userId,
    contentType,
    platform: options.platform,
    audience: options.audience,
    preferences: options.preferences,
    intent: options.intent,
    variationCount: options.variationCount || 3,
    customizationOptions: options.customizationOptions,
  };

  return await contentVariationService.generateVariations(variationOptions);
}