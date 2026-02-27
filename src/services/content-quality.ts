// Content quality and safety validation service for ContentFlow AI

import { 
  ComprehendClient,
  DetectSentimentCommand,
  DetectPiiEntitiesCommand,
  DetectToxicContentCommand,
} from '@aws-sdk/client-comprehend';
import { comprehendClient } from './aws-clients';
import { 
  ContentType,
  GeneratedContent,
  ContentMetadata,
} from '../types';
import { 
  getAppConfig,
  logInfo,
  logError,
  logWarning,
  measureExecutionTime,
  retryOperation,
} from '../utils';

const config = getAppConfig();

// Quality check result interfaces
export interface ContentQualityResult {
  isValid: boolean;
  qualityScore: number; // 0-1 scale
  issues: QualityIssue[];
  safetyFlags: SafetyFlag[];
  grammarScore: number;
  coherenceScore: number;
  safetyScore: number;
  factualityScore?: number;
  processingTime: number;
  recommendations: string[];
}

export interface QualityIssue {
  type: 'grammar' | 'coherence' | 'safety' | 'factuality' | 'structure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: {
    start: number;
    end: number;
    line?: number;
  };
  suggestion?: string;
}

export interface SafetyFlag {
  type: 'toxicity' | 'pii' | 'inappropriate' | 'harmful' | 'bias';
  confidence: number;
  details: string;
  location?: {
    start: number;
    end: number;
  };
}

export interface GrammarCheckResult {
  score: number;
  issues: GrammarIssue[];
  wordCount: number;
  sentenceCount: number;
  averageWordsPerSentence: number;
  readabilityScore: number;
}

export interface GrammarIssue {
  type: 'spelling' | 'punctuation' | 'capitalization' | 'word_choice' | 'sentence_structure';
  message: string;
  location: {
    start: number;
    end: number;
  };
  suggestion?: string;
  confidence: number;
}

export interface CoherenceCheckResult {
  score: number;
  issues: CoherenceIssue[];
  structureScore: number;
  flowScore: number;
  consistencyScore: number;
}

export interface CoherenceIssue {
  type: 'structure' | 'flow' | 'consistency' | 'relevance' | 'clarity';
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export interface SafetyCheckResult {
  isSafe: boolean;
  safetyScore: number;
  flags: SafetyFlag[];
  toxicityScore: number;
  piiDetected: boolean;
  inappropriateContent: boolean;
}

export interface FactualityCheckResult {
  score: number;
  verifiableClaims: VerifiableClaim[];
  uncertainClaims: string[];
  recommendations: string[];
}

export interface VerifiableClaim {
  claim: string;
  confidence: number;
  sources?: string[];
  verification: 'verified' | 'disputed' | 'unverifiable';
}

// Main content quality service
export class ContentQualityService {
  private comprehendClient: ComprehendClient;

  constructor() {
    this.comprehendClient = comprehendClient;
  }

  /**
   * Perform comprehensive quality and safety checks on generated content
   */
  async validateContent(content: GeneratedContent): Promise<ContentQualityResult> {
    const { result, executionTime } = await measureExecutionTime(
      () => this._performQualityChecks(content),
      `content-quality-validation-${content.contentType}`
    );

    result.processingTime = executionTime;
    return result;
  }

  /**
   * Perform all quality checks in parallel
   */
  private async _performQualityChecks(content: GeneratedContent): Promise<ContentQualityResult> {
    logInfo('Starting content quality validation', {
      contentId: content.contentId,
      contentType: content.contentType,
      textLength: content.generatedText.length,
    });

    try {
      // Run all checks in parallel for better performance
      const [grammarResult, coherenceResult, safetyResult, factualityResult] = await Promise.all([
        this.checkGrammar(content.generatedText, content.contentType),
        this.checkCoherence(content.generatedText, content.contentType),
        this.checkSafety(content.generatedText),
        this.checkFactuality(content.generatedText, content.contentType),
      ]);

      // Combine results and calculate overall quality score
      const issues: QualityIssue[] = [
        ...this._convertGrammarIssues(grammarResult.issues),
        ...this._convertCoherenceIssues(coherenceResult.issues),
      ];

      const safetyFlags = safetyResult.flags;
      const qualityScore = this._calculateOverallQualityScore(
        grammarResult.score,
        coherenceResult.score,
        safetyResult.safetyScore,
        factualityResult?.score
      );

      const isValid = this._determineContentValidity(
        qualityScore,
        safetyResult.isSafe,
        issues
      );

      const recommendations = this._generateRecommendations(
        grammarResult,
        coherenceResult,
        safetyResult,
        factualityResult
      );

      logInfo('Content quality validation completed', {
        contentId: content.contentId,
        qualityScore,
        isValid,
        issueCount: issues.length,
        safetyFlagCount: safetyFlags.length,
      });

      return {
        isValid,
        qualityScore,
        issues,
        safetyFlags,
        grammarScore: grammarResult.score,
        coherenceScore: coherenceResult.score,
        safetyScore: safetyResult.safetyScore,
        factualityScore: factualityResult?.score,
        processingTime: 0, // Will be set by measureExecutionTime
        recommendations,
      };

    } catch (error) {
      logError('Content quality validation failed', error);
      throw new Error(`Quality validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check grammar, spelling, and writing quality
   */
  async checkGrammar(text: string, contentType: ContentType): Promise<GrammarCheckResult> {
    logInfo('Performing grammar check', { textLength: text.length, contentType });

    try {
      // Basic text analysis
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
      const wordCount = words.length;
      const sentenceCount = sentences.length;
      const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

      // Grammar and spelling issues detection
      const issues = await this._detectGrammarIssues(text);
      
      // Calculate readability score (Flesch Reading Ease approximation)
      const readabilityScore = this._calculateReadabilityScore(text, wordCount, sentenceCount);
      
      // Calculate grammar score based on issues and readability
      const grammarScore = this._calculateGrammarScore(issues, readabilityScore, wordCount);

      return {
        score: grammarScore,
        issues,
        wordCount,
        sentenceCount,
        averageWordsPerSentence,
        readabilityScore,
      };

    } catch (error) {
      logError('Grammar check failed', error);
      return {
        score: 0.5, // Default neutral score on error
        issues: [],
        wordCount: text.split(/\s+/).length,
        sentenceCount: text.split(/[.!?]+/).length,
        averageWordsPerSentence: 0,
        readabilityScore: 0,
      };
    }
  }

  /**
   * Check content coherence and structure
   */
  async checkCoherence(text: string, contentType: ContentType): Promise<CoherenceCheckResult> {
    logInfo('Performing coherence check', { textLength: text.length, contentType });

    try {
      const structureScore = this._analyzeContentStructure(text, contentType);
      const flowScore = this._analyzeContentFlow(text);
      const consistencyScore = this._analyzeContentConsistency(text);
      
      const issues = this._detectCoherenceIssues(text, contentType, structureScore, flowScore, consistencyScore);
      
      // Overall coherence score is weighted average
      const coherenceScore = (structureScore * 0.4 + flowScore * 0.3 + consistencyScore * 0.3);

      return {
        score: coherenceScore,
        issues,
        structureScore,
        flowScore,
        consistencyScore,
      };

    } catch (error) {
      logError('Coherence check failed', error);
      return {
        score: 0.5,
        issues: [],
        structureScore: 0.5,
        flowScore: 0.5,
        consistencyScore: 0.5,
      };
    }
  }

  /**
   * Check content safety including toxicity, PII, and inappropriate content
   */
  async checkSafety(text: string): Promise<SafetyCheckResult> {
    logInfo('Performing safety check', { textLength: text.length });

    try {
      const [toxicityResult, piiResult] = await Promise.all([
        this._checkToxicity(text),
        this._checkPII(text),
      ]);

      const inappropriateContent = this._checkInappropriateContent(text);
      
      const flags: SafetyFlag[] = [
        ...toxicityResult.flags,
        ...piiResult.flags,
        ...inappropriateContent.flags,
      ];

      const toxicityScore = toxicityResult.score;
      const piiDetected = piiResult.detected;
      const safetyScore = this._calculateSafetyScore(toxicityScore, piiDetected, inappropriateContent.detected);
      const isSafe = safetyScore >= 0.7 && flags.filter(f => f.confidence > 0.8).length === 0;

      return {
        isSafe,
        safetyScore,
        flags,
        toxicityScore,
        piiDetected,
        inappropriateContent: inappropriateContent.detected,
      };

    } catch (error) {
      logError('Safety check failed', error);
      return {
        isSafe: false, // Fail safe - assume unsafe on error
        safetyScore: 0,
        flags: [{
          type: 'inappropriate',
          confidence: 1.0,
          details: 'Safety check failed - content flagged for manual review',
        }],
        toxicityScore: 0,
        piiDetected: false,
        inappropriateContent: true,
      };
    }
  }

  /**
   * Check factual accuracy where possible
   */
  async checkFactuality(text: string, contentType: ContentType): Promise<FactualityCheckResult | null> {
    // Only perform factuality checks for informational and educational content
    if (!['blog-post', 'script'].includes(contentType)) {
      return null;
    }

    logInfo('Performing factuality check', { textLength: text.length, contentType });

    try {
      const verifiableClaims = this._extractVerifiableClaims(text);
      const uncertainClaims = this._extractUncertainClaims(text);
      
      // For now, we provide basic factuality scoring based on claim analysis
      // In production, this could integrate with fact-checking APIs
      const score = this._calculateFactualityScore(verifiableClaims, uncertainClaims);
      
      const recommendations = this._generateFactualityRecommendations(verifiableClaims, uncertainClaims);

      return {
        score,
        verifiableClaims,
        uncertainClaims,
        recommendations,
      };

    } catch (error) {
      logError('Factuality check failed', error);
      return null;
    }
  }

  // Private helper methods

  private async _detectGrammarIssues(text: string): Promise<GrammarIssue[]> {
    const issues: GrammarIssue[] = [];

    // Basic grammar and spelling checks
    // In production, integrate with services like Grammarly API or LanguageTool

    // Check for common spelling errors
    const commonMisspellings = {
      'recieve': 'receive',
      'seperate': 'separate',
      'definately': 'definitely',
      'occured': 'occurred',
      'neccessary': 'necessary',
    };

    for (const [misspelled, correct] of Object.entries(commonMisspellings)) {
      const regex = new RegExp(`\\b${misspelled}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'spelling',
          message: `Possible spelling error: "${misspelled}"`,
          location: {
            start: match.index,
            end: match.index + misspelled.length,
          },
          suggestion: correct,
          confidence: 0.9,
        });
      }
    }

    // Check for double spaces
    const doubleSpaceRegex = /  +/g;
    let match;
    while ((match = doubleSpaceRegex.exec(text)) !== null) {
      issues.push({
        type: 'punctuation',
        message: 'Multiple consecutive spaces found',
        location: {
          start: match.index,
          end: match.index + match[0].length,
        },
        suggestion: ' ',
        confidence: 1.0,
      });
    }

    // Check for missing capitalization at sentence start
    const sentenceStartRegex = /[.!?]\s+[a-z]/g;
    while ((match = sentenceStartRegex.exec(text)) !== null) {
      issues.push({
        type: 'capitalization',
        message: 'Sentence should start with capital letter',
        location: {
          start: match.index + match[0].length - 1,
          end: match.index + match[0].length,
        },
        confidence: 0.8,
      });
    }

    return issues;
  }

  private _calculateReadabilityScore(text: string, wordCount: number, sentenceCount: number): number {
    if (sentenceCount === 0 || wordCount === 0) return 0;

    // Simplified Flesch Reading Ease calculation
    const averageWordsPerSentence = wordCount / sentenceCount;
    const syllableCount = this._estimateSyllableCount(text);
    const averageSyllablesPerWord = syllableCount / wordCount;

    // Flesch Reading Ease formula (simplified)
    const score = 206.835 - (1.015 * averageWordsPerSentence) - (84.6 * averageSyllablesPerWord);
    
    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, score / 100));
  }

  private _estimateSyllableCount(text: string): number {
    // Simple syllable estimation
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    let syllableCount = 0;

    for (const word of words) {
      // Count vowel groups
      const vowelGroups = word.match(/[aeiouy]+/g) || [];
      let wordSyllables = vowelGroups.length;
      
      // Adjust for silent e
      if (word.endsWith('e') && wordSyllables > 1) {
        wordSyllables--;
      }
      
      // Minimum one syllable per word
      syllableCount += Math.max(1, wordSyllables);
    }

    return syllableCount;
  }

  private _calculateGrammarScore(issues: GrammarIssue[], readabilityScore: number, wordCount: number): number {
    // Calculate error rate
    const errorRate = issues.length / Math.max(wordCount, 1);
    
    // Weight errors by confidence and severity
    const weightedErrorScore = issues.reduce((sum, issue) => {
      const severityWeight = issue.type === 'spelling' ? 1.0 : 0.7;
      return sum + (issue.confidence * severityWeight);
    }, 0) / Math.max(issues.length, 1);

    // Combine error rate, weighted errors, and readability
    const grammarScore = Math.max(0, 1 - (errorRate * 2) - (weightedErrorScore * 0.3)) * 0.7 + readabilityScore * 0.3;
    
    return Math.max(0, Math.min(1, grammarScore));
  }

  private _analyzeContentStructure(text: string, contentType: ContentType): number {
    let score = 0.5; // Base score

    switch (contentType) {
      case 'blog-post':
        // Check for headings, paragraphs, introduction, conclusion
        const hasHeadings = /^#+\s/m.test(text);
        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
        const hasIntroduction = paragraphs.length > 0 && paragraphs[0].length > 50;
        const hasConclusion = text.toLowerCase().includes('conclusion') || 
                             text.toLowerCase().includes('summary') ||
                             text.toLowerCase().includes('in conclusion');
        
        score = (hasHeadings ? 0.3 : 0) + 
                (paragraphs.length >= 3 ? 0.3 : paragraphs.length * 0.1) +
                (hasIntroduction ? 0.2 : 0) +
                (hasConclusion ? 0.2 : 0);
        break;

      case 'social-post':
      case 'caption':
        // Check for appropriate length and engagement elements
        const hasHashtags = /#\w+/.test(text);
        const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(text);
        const hasCallToAction = /\b(click|share|like|comment|follow|subscribe)\b/i.test(text);
        
        score = 0.4 + (hasHashtags ? 0.2 : 0) + (hasEmojis ? 0.2 : 0) + (hasCallToAction ? 0.2 : 0);
        break;

      case 'script':
        // Check for timing cues, speaker notes, clear structure
        const hasTimingCues = /\[\d{2}:\d{2}/.test(text);
        const hasSpeakerNotes = /SPEAKER NOTES|VISUAL:|PACING:/.test(text);
        const hasTitle = /TITLE:/.test(text);
        
        score = 0.3 + (hasTimingCues ? 0.3 : 0) + (hasSpeakerNotes ? 0.2 : 0) + (hasTitle ? 0.2 : 0);
        break;

      default:
        score = 0.7; // Default good score for other types
    }

    return Math.max(0, Math.min(1, score));
  }

  private _analyzeContentFlow(text: string): number {
    // Analyze transition words and sentence flow
    const transitionWords = [
      'however', 'therefore', 'furthermore', 'moreover', 'additionally',
      'consequently', 'meanwhile', 'nevertheless', 'similarly', 'likewise',
      'in contrast', 'on the other hand', 'as a result', 'for example',
      'in conclusion', 'finally', 'first', 'second', 'next', 'then'
    ];

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const transitionCount = transitionWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      return count + (text.match(regex) || []).length;
    }, 0);

    // Calculate flow score based on transition density and sentence variety
    const transitionDensity = transitionCount / Math.max(sentences.length, 1);
    const sentenceLengthVariety = this._calculateSentenceLengthVariety(sentences);
    
    const flowScore = Math.min(1, transitionDensity * 2) * 0.6 + sentenceLengthVariety * 0.4;
    
    return Math.max(0.3, Math.min(1, flowScore)); // Minimum 0.3 to avoid penalizing too much
  }

  private _calculateSentenceLengthVariety(sentences: string[]): number {
    if (sentences.length < 2) return 0.5;

    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Normalize variety score (higher variety = better flow)
    return Math.min(1, standardDeviation / avgLength);
  }

  private _analyzeContentConsistency(text: string): number {
    // Check for consistent tone, tense, and style
    let consistencyScore = 0.8; // Start with good score

    // Check for tense consistency (simplified)
    const pastTenseCount = (text.match(/\b\w+ed\b/g) || []).length;
    const presentTenseCount = (text.match(/\b(is|are|am|do|does|have|has)\b/g) || []).length;
    const futureTenseCount = (text.match(/\b(will|shall|going to)\b/g) || []).length;

    const totalTenseMarkers = pastTenseCount + presentTenseCount + futureTenseCount;
    if (totalTenseMarkers > 0) {
      const dominantTenseRatio = Math.max(pastTenseCount, presentTenseCount, futureTenseCount) / totalTenseMarkers;
      consistencyScore *= dominantTenseRatio;
    }

    // Check for consistent capitalization
    const inconsistentCapitalization = /\b[A-Z][a-z]+[A-Z]/.test(text);
    if (inconsistentCapitalization) {
      consistencyScore *= 0.9;
    }

    return Math.max(0.3, Math.min(1, consistencyScore));
  }

  private _detectCoherenceIssues(
    text: string, 
    contentType: ContentType, 
    structureScore: number, 
    flowScore: number, 
    consistencyScore: number
  ): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    if (structureScore < 0.5) {
      issues.push({
        type: 'structure',
        message: `Poor content structure for ${contentType}. Consider adding headings, clear paragraphs, or proper formatting.`,
        severity: 'medium',
        suggestion: this._getStructureSuggestion(contentType),
      });
    }

    if (flowScore < 0.4) {
      issues.push({
        type: 'flow',
        message: 'Content lacks smooth transitions between ideas. Consider adding transition words.',
        severity: 'medium',
        suggestion: 'Use transition words like "however", "therefore", "furthermore" to connect ideas.',
      });
    }

    if (consistencyScore < 0.5) {
      issues.push({
        type: 'consistency',
        message: 'Inconsistent tone, tense, or style detected throughout the content.',
        severity: 'medium',
        suggestion: 'Maintain consistent tense and tone throughout the content.',
      });
    }

    return issues;
  }

  private _getStructureSuggestion(contentType: ContentType): string {
    switch (contentType) {
      case 'blog-post':
        return 'Add clear headings (H1, H2, H3), introduction paragraph, body sections, and conclusion.';
      case 'social-post':
        return 'Include engaging opening, main message, and call-to-action with relevant hashtags.';
      case 'caption':
        return 'Start with hook, provide context, include relevant hashtags and call-to-action.';
      case 'script':
        return 'Include title, timing cues, clear segments, and speaker notes.';
      default:
        return 'Improve content organization with clear structure and logical flow.';
    }
  }

  private async _checkToxicity(text: string): Promise<{ score: number; flags: SafetyFlag[] }> {
    try {
      // Use AWS Comprehend for toxicity detection if available
      const command = new DetectToxicContentCommand({
        TextSegments: [{ Text: text }],
        LanguageCode: 'en',
      });

      const response = await retryOperation(
        () => this.comprehendClient.send(command),
        2,
        1000
      );

      const flags: SafetyFlag[] = [];
      let maxToxicityScore = 0;

      if (response.ResultList && response.ResultList.length > 0) {
        const result = response.ResultList[0];
        if (result.Labels) {
          for (const label of result.Labels) {
            if (label.Score && label.Score > 0.5) {
              maxToxicityScore = Math.max(maxToxicityScore, label.Score);
              flags.push({
                type: 'toxicity',
                confidence: label.Score,
                details: `Toxic content detected: ${label.Name}`,
              });
            }
          }
        }
      }

      const toxicityScore = 1 - maxToxicityScore; // Invert so higher = safer

      return { score: toxicityScore, flags };

    } catch (error) {
      logWarning('Toxicity check failed, using fallback method', error);
      return this._fallbackToxicityCheck(text);
    }
  }

  private _fallbackToxicityCheck(text: string): { score: number; flags: SafetyFlag[] } {
    // Fallback toxicity detection using keyword matching
    const toxicKeywords = [
      'hate', 'kill', 'die', 'stupid', 'idiot', 'moron', 'dumb',
      'ugly', 'fat', 'loser', 'pathetic', 'worthless', 'disgusting'
    ];

    const flags: SafetyFlag[] = [];
    let toxicWordCount = 0;

    for (const keyword of toxicKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        toxicWordCount += matches.length;
        flags.push({
          type: 'toxicity',
          confidence: 0.7,
          details: `Potentially toxic language detected: "${keyword}"`,
        });
      }
    }

    const wordCount = text.split(/\s+/).length;
    const toxicityRatio = toxicWordCount / Math.max(wordCount, 1);
    const toxicityScore = Math.max(0, 1 - (toxicityRatio * 10)); // Scale appropriately

    return { score: toxicityScore, flags };
  }

  private async _checkPII(text: string): Promise<{ detected: boolean; flags: SafetyFlag[] }> {
    try {
      const command = new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: 'en',
      });

      const response = await retryOperation(
        () => this.comprehendClient.send(command),
        2,
        1000
      );

      const flags: SafetyFlag[] = [];
      let piiDetected = false;

      if (response.Entities && response.Entities.length > 0) {
        for (const entity of response.Entities) {
          if (entity.Score && entity.Score > 0.7) {
            piiDetected = true;
            flags.push({
              type: 'pii',
              confidence: entity.Score,
              details: `PII detected: ${entity.Type}`,
              location: entity.BeginOffset && entity.EndOffset ? {
                start: entity.BeginOffset,
                end: entity.EndOffset,
              } : undefined,
            });
          }
        }
      }

      return { detected: piiDetected, flags };

    } catch (error) {
      logWarning('PII check failed, using fallback method', error);
      return this._fallbackPIICheck(text);
    }
  }

  private _fallbackPIICheck(text: string): { detected: boolean; flags: SafetyFlag[] } {
    const flags: SafetyFlag[] = [];
    let piiDetected = false;

    // Check for email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = text.match(emailRegex);
    if (emailMatches) {
      piiDetected = true;
      flags.push({
        type: 'pii',
        confidence: 0.9,
        details: 'Email address detected',
      });
    }

    // Check for phone numbers
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      piiDetected = true;
      flags.push({
        type: 'pii',
        confidence: 0.8,
        details: 'Phone number detected',
      });
    }

    // Check for SSN pattern
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssnMatches = text.match(ssnRegex);
    if (ssnMatches) {
      piiDetected = true;
      flags.push({
        type: 'pii',
        confidence: 0.95,
        details: 'Social Security Number pattern detected',
      });
    }

    return { detected: piiDetected, flags };
  }

  private _checkInappropriateContent(text: string): { detected: boolean; flags: SafetyFlag[] } {
    const inappropriateKeywords = [
      'violence', 'weapon', 'drug', 'illegal', 'scam', 'fraud',
      'adult content', 'explicit', 'nsfw'
    ];

    const flags: SafetyFlag[] = [];
    let detected = false;

    for (const keyword of inappropriateKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(text)) {
        detected = true;
        flags.push({
          type: 'inappropriate',
          confidence: 0.6,
          details: `Potentially inappropriate content: "${keyword}"`,
        });
      }
    }

    return { detected, flags };
  }

  private _calculateSafetyScore(toxicityScore: number, piiDetected: boolean, inappropriateDetected: boolean): number {
    let safetyScore = toxicityScore * 0.6; // Toxicity is most important

    // Penalize for PII and inappropriate content
    if (piiDetected) safetyScore *= 0.7;
    if (inappropriateDetected) safetyScore *= 0.8;

    // Ensure minimum safety score for content without issues
    if (!piiDetected && !inappropriateDetected && toxicityScore > 0.8) {
      safetyScore = Math.max(safetyScore, 0.8);
    }

    return Math.max(0, Math.min(1, safetyScore));
  }

  private _extractVerifiableClaims(text: string): VerifiableClaim[] {
    // Simple claim extraction based on patterns
    const claims: VerifiableClaim[] = [];
    
    // Look for statistical claims
    const statRegex = /\b\d+%|\b\d+\s*(percent|million|billion|thousand)\b/gi;
    const statMatches = text.match(statRegex);
    if (statMatches) {
      for (const stat of statMatches) {
        claims.push({
          claim: `Statistical claim: ${stat}`,
          confidence: 0.7,
          verification: 'unverifiable', // Would need external fact-checking
        });
      }
    }

    // Look for definitive statements
    const definitiveRegex = /\b(studies show|research indicates|experts say|according to)\b[^.!?]*[.!?]/gi;
    const definitiveMatches = text.match(definitiveRegex);
    if (definitiveMatches) {
      for (const claim of definitiveMatches) {
        claims.push({
          claim: claim.trim(),
          confidence: 0.8,
          verification: 'unverifiable',
        });
      }
    }

    return claims;
  }

  private _extractUncertainClaims(text: string): string[] {
    const uncertainClaims: string[] = [];
    
    // Look for uncertain language
    const uncertainRegex = /\b(might|could|possibly|perhaps|maybe|likely|probably)\b[^.!?]*[.!?]/gi;
    const matches = text.match(uncertainRegex);
    if (matches) {
      uncertainClaims.push(...matches.map(claim => claim.trim()));
    }

    return uncertainClaims;
  }

  private _calculateFactualityScore(verifiableClaims: VerifiableClaim[], uncertainClaims: string[]): number {
    // Basic factuality scoring
    const totalClaims = verifiableClaims.length + uncertainClaims.length;
    if (totalClaims === 0) return 0.8; // Neutral score for content without claims

    // Penalize for unverifiable claims, reward for uncertain language where appropriate
    const unverifiableCount = verifiableClaims.filter(c => c.verification === 'unverifiable').length;
    const uncertaintyRatio = uncertainClaims.length / totalClaims;
    
    // Higher uncertainty ratio is good for claims that can't be verified
    const factualityScore = 0.8 - (unverifiableCount * 0.1) + (uncertaintyRatio * 0.2);
    
    return Math.max(0.3, Math.min(1, factualityScore));
  }

  private _generateFactualityRecommendations(verifiableClaims: VerifiableClaim[], uncertainClaims: string[]): string[] {
    const recommendations: string[] = [];

    if (verifiableClaims.length > 0) {
      recommendations.push('Consider providing sources for factual claims and statistics.');
    }

    if (uncertainClaims.length === 0 && verifiableClaims.length > 3) {
      recommendations.push('Consider using more cautious language for claims that may be difficult to verify.');
    }

    if (verifiableClaims.length > 5) {
      recommendations.push('High number of factual claims detected. Ensure all claims are accurate and up-to-date.');
    }

    return recommendations;
  }

  private _convertGrammarIssues(grammarIssues: GrammarIssue[]): QualityIssue[] {
    return grammarIssues.map(issue => ({
      type: 'grammar',
      severity: issue.confidence > 0.8 ? 'high' : issue.confidence > 0.6 ? 'medium' : 'low',
      message: issue.message,
      location: issue.location,
      suggestion: issue.suggestion,
    }));
  }

  private _convertCoherenceIssues(coherenceIssues: CoherenceIssue[]): QualityIssue[] {
    return coherenceIssues.map(issue => ({
      type: 'coherence',
      severity: issue.severity,
      message: issue.message,
      suggestion: issue.suggestion,
    }));
  }

  private _calculateOverallQualityScore(
    grammarScore: number,
    coherenceScore: number,
    safetyScore: number,
    factualityScore?: number
  ): number {
    // Weighted average of all scores
    let totalWeight = 0.3 + 0.3 + 0.4; // grammar + coherence + safety
    let weightedSum = grammarScore * 0.3 + coherenceScore * 0.3 + safetyScore * 0.4;

    if (factualityScore !== undefined) {
      totalWeight += 0.2;
      weightedSum += factualityScore * 0.2;
      // Adjust other weights
      weightedSum = grammarScore * 0.25 + coherenceScore * 0.25 + safetyScore * 0.3 + factualityScore * 0.2;
    }

    return Math.max(0, Math.min(1, weightedSum));
  }

  private _determineContentValidity(qualityScore: number, isSafe: boolean, issues: QualityIssue[]): boolean {
    // Content is valid if:
    // 1. It's safe
    // 2. Quality score is above threshold
    // 3. No critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const qualityThreshold = 0.5; // Lowered threshold

    return isSafe && qualityScore >= qualityThreshold && criticalIssues.length === 0;
  }

  private _generateRecommendations(
    grammarResult: GrammarCheckResult,
    coherenceResult: CoherenceCheckResult,
    safetyResult: SafetyCheckResult,
    factualityResult: FactualityCheckResult | null
  ): string[] {
    const recommendations: string[] = [];

    // Grammar recommendations
    if (grammarResult.score < 0.7) {
      recommendations.push('Consider proofreading for grammar and spelling errors.');
    }
    if (grammarResult.readabilityScore < 0.5) {
      recommendations.push('Simplify sentence structure to improve readability.');
    }

    // Coherence recommendations
    if (coherenceResult.structureScore < 0.6) {
      recommendations.push('Improve content structure with clear headings and organization.');
    }
    if (coherenceResult.flowScore < 0.5) {
      recommendations.push('Add transition words to improve content flow.');
    }

    // Safety recommendations
    if (!safetyResult.isSafe) {
      recommendations.push('Review content for safety issues and inappropriate language.');
    }
    if (safetyResult.piiDetected) {
      recommendations.push('Remove or anonymize personal identifiable information.');
    }

    // Factuality recommendations
    if (factualityResult) {
      recommendations.push(...factualityResult.recommendations);
    }

    return recommendations;
  }
}

// Export singleton instance
export const contentQualityService = new ContentQualityService();