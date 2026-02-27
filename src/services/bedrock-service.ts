// Main Bedrock service class implementation

import { 
  BedrockRuntimeClient, 
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from './aws-clients';
import { 
  ContentType, 
  Platform, 
  ContentIntent,
  UserPreferences,
  AudienceProfile,
} from '../types';
import { 
  getAppConfig, 
  logError, 
  logInfo, 
  retryOperation, 
  measureExecutionTime,
} from '../utils';
import { 
  BEDROCK_MODELS, 
  MODEL_PARAMETERS, 
  PromptTemplates,
  ContentGenerationOptions,
  BedrockContentResponse,
} from './bedrock';

const config = getAppConfig();

// Main Bedrock service class
export class BedrockService {
  private client: BedrockRuntimeClient;
  private defaultModel: string;

  constructor() {
    this.client = bedrockClient;
    this.defaultModel = config.aws.bedrock.modelIds.textGeneration;
  }

  /**
   * Generate content using Amazon Bedrock
   */
  async generateContent(options: ContentGenerationOptions): Promise<BedrockContentResponse> {
    const { result, executionTime } = await measureExecutionTime(
      () => this._generateSingleContent(options),
      `bedrock-content-generation-${options.contentType}`
    );

    result.metadata.processingTime = executionTime;

    // Generate variations if requested
    if (options.variations && options.variations > 1) {
      const variations = await Promise.all(
        Array.from({ length: options.variations - 1 }, () =>
          this._generateSingleContent({
            ...options,
            temperature: (options.temperature || 0.7) + Math.random() * 0.2 - 0.1, // Slight variation
          })
        )
      );
      result.variations = variations;
    }

    return result;
  }

  /**
   * Generate a single piece of content
   */
  private async _generateSingleContent(options: ContentGenerationOptions): Promise<BedrockContentResponse> {
    const modelId = options.modelId || this.defaultModel;
    const prompt = this._buildPrompt(options);
    
    logInfo('Generating content with Bedrock', {
      modelId,
      contentType: options.contentType,
      platform: options.platform,
      promptLength: prompt.length,
    });

    try {
      const response = await retryOperation(
        () => this._invokeModel(modelId, prompt, options),
        3, // Max retries
        1000 // Initial delay
      );

      const content = this._extractContent(response.completion, options.contentType);
      const wordCount = content.split(/\s+/).length;
      const characterCount = content.length;

      return {
        content,
        metadata: {
          modelId,
          processingTime: 0, // Will be set by measureExecutionTime
          tokenUsage: {
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
          },
          contentType: options.contentType,
          platform: options.platform,
          wordCount,
          characterCount,
        },
      };
    } catch (error) {
      logError('Failed to generate content with Bedrock', error);
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build the appropriate prompt based on content type and platform
   */
  private _buildPrompt(options: ContentGenerationOptions): string {
    const { contentType, platform, contentIdea, audience, preferences, intent, duration } = options;

    switch (contentType) {
      case 'blog-post':
        return PromptTemplates.getBlogPostPrompt(contentIdea, audience || null, preferences || null, intent);
      
      case 'social-post':
        if (!platform) throw new Error('Platform is required for social media posts');
        return PromptTemplates.getSocialMediaPrompt(contentIdea, platform, audience || null, preferences || null, intent);
      
      case 'caption':
        if (!platform) throw new Error('Platform is required for captions');
        return PromptTemplates.getCaptionPrompt(contentIdea, platform, audience || null, preferences || null, intent);
      
      case 'script':
        return PromptTemplates.getScriptPrompt(contentIdea, audience || null, preferences || null, intent, duration);
      
      case 'email':
      case 'ad-copy':
        // Use social media prompt as base for these content types
        return PromptTemplates.getSocialMediaPrompt(
          contentIdea, 
          platform || 'linkedin', 
          audience || null, 
          preferences || null, 
          intent
        );
      
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }
  }

  /**
   * Invoke the Bedrock model with proper error handling
   */
  private async _invokeModel(
    modelId: string,
    prompt: string,
    options: ContentGenerationOptions
  ): Promise<{ completion: string; stopReason: string; inputTokens: number; outputTokens: number }> {
    const isClaudeModel = modelId.includes('anthropic.claude');
    const isTitanModel = modelId.includes('amazon.titan');

    let requestBody: any;
    const modelParams = MODEL_PARAMETERS[modelId as keyof typeof MODEL_PARAMETERS];
    
    if (isClaudeModel) {
      requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options.maxTokens || (modelParams && 'maxTokens' in modelParams ? modelParams.maxTokens : 4096),
        temperature: options.temperature || modelParams?.temperature || 0.7,
        top_p: modelParams?.topP || 0.9,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stop_sequences: modelParams?.stopSequences || [],
      };
    } else if (isTitanModel) {
      requestBody = {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: options.maxTokens || (modelParams && 'maxTokenCount' in modelParams ? modelParams.maxTokenCount : 4096),
          temperature: options.temperature || modelParams?.temperature || 0.7,
          topP: modelParams?.topP || 0.9,
          stopSequences: modelParams?.stopSequences || [],
        },
      };
    } else {
      throw new Error(`Unsupported model: ${modelId}`);
    }

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (isClaudeModel) {
        return {
          completion: responseBody.content[0].text,
          stopReason: responseBody.stop_reason,
          inputTokens: responseBody.usage.input_tokens,
          outputTokens: responseBody.usage.output_tokens,
        };
      } else if (isTitanModel) {
        return {
          completion: responseBody.results[0].outputText,
          stopReason: responseBody.results[0].completionReason,
          inputTokens: responseBody.inputTextTokenCount,
          outputTokens: responseBody.results[0].tokenCount,
        };
      }

      throw new Error('Unexpected model response format');
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific Bedrock errors
        if (error.name === 'ThrottlingException') {
          throw new Error('Bedrock service is currently throttled. Please try again later.');
        }
        if (error.name === 'ValidationException') {
          throw new Error(`Invalid request parameters: ${error.message}`);
        }
        if (error.name === 'ModelNotReadyException') {
          throw new Error(`Model ${modelId} is not ready. Please try again later.`);
        }
        if (error.name === 'ServiceQuotaExceededException') {
          throw new Error('Service quota exceeded. Please try again later.');
        }
      }
      
      logError('Bedrock model invocation failed', error);
      throw error;
    }
  }

  /**
   * Extract and clean content from the model response
   */
  private _extractContent(rawContent: string, contentType: ContentType): string {
    // Remove any unwanted prefixes or suffixes that might be added by the model
    let content = rawContent.trim();
    
    // Remove common AI assistant prefixes
    const prefixesToRemove = [
      'Here is the content:',
      'Here\'s the content:',
      'I\'ll create',
      'I\'ll write',
      'Here is a',
      'Here\'s a',
    ];
    
    for (const prefix of prefixesToRemove) {
      if (content.toLowerCase().startsWith(prefix.toLowerCase())) {
        content = content.substring(prefix.length).trim();
      }
    }

    // Content type specific cleaning
    switch (contentType) {
      case 'blog-post':
        // Ensure proper blog post structure
        if (!content.includes('TITLE:') && !content.includes('#')) {
          // If no title is found, try to extract the first line as title
          const lines = content.split('\n');
          if (lines.length > 1) {
            content = `# ${lines[0]}\n\n${lines.slice(1).join('\n')}`;
          }
        }
        break;
        
      case 'social-post':
      case 'caption':
        // Remove any formatting markers that aren't appropriate for social media
        content = content.replace(/^(POST_TEXT:|CAPTION:)\s*/i, '');
        break;
        
      case 'script':
        // Ensure script formatting is preserved
        if (!content.includes('[') && !content.includes('TITLE:')) {
          // Add basic script structure if missing
          content = `TITLE: Generated Script\n\n${content}`;
        }
        break;
    }

    return content;
  }

  /**
   * Test the Bedrock service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const testOptions: ContentGenerationOptions = {
        contentIdea: 'Test connection',
        contentType: 'social-post',
        platform: 'twitter',
        intent: 'informational',
        maxTokens: 100,
      };

      await this._generateSingleContent(testOptions);
      return true;
    } catch (error) {
      logError('Bedrock connection test failed', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.values(BEDROCK_MODELS);
  }

  /**
   * Get model parameters for a specific model
   */
  getModelParameters(modelId: string): any {
    return MODEL_PARAMETERS[modelId as keyof typeof MODEL_PARAMETERS] || {};
  }
}

// Export singleton instance
export const bedrockService = new BedrockService();