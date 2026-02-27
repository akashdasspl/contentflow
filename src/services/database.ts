// Database service layer for ContentFlow AI

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoDBDocClient } from './aws-clients';
import { getAppConfig, logError, logInfo } from '../utils';
import {
  UserProfile,
  ContentIdea,
  GeneratedContent,
  EngagementFeedback,
  AudienceProfile,
  DynamoDBQueryParams,
} from '../types';

const config = getAppConfig();

// Generic database operations
export class DatabaseService {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async get(key: Record<string, any>): Promise<any | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: key,
      });

      const result = await dynamoDBDocClient.send(command);
      return result.Item || null;
    } catch (error) {
      logError(`Error getting item from ${this.tableName}`, error);
      throw error;
    }
  }

  async put(item: any): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: item,
      });

      await dynamoDBDocClient.send(command);
      logInfo(`Item created in ${this.tableName}`, { id: item.id || item.userId });
    } catch (error) {
      logError(`Error putting item to ${this.tableName}`, error);
      throw error;
    }
  }

  async update(
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>
  ): Promise<any> {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await dynamoDBDocClient.send(command);
      return result.Attributes;
    } catch (error) {
      logError(`Error updating item in ${this.tableName}`, error);
      throw error;
    }
  }

  async delete(key: Record<string, any>): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: key,
      });

      await dynamoDBDocClient.send(command);
      logInfo(`Item deleted from ${this.tableName}`, { key });
    } catch (error) {
      logError(`Error deleting item from ${this.tableName}`, error);
      throw error;
    }
  }

  async query(params: Omit<DynamoDBQueryParams, 'TableName'>): Promise<any[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        ...params,
      });

      const result = await dynamoDBDocClient.send(command);
      return result.Items || [];
    } catch (error) {
      logError(`Error querying ${this.tableName}`, error);
      throw error;
    }
  }

  async scan(
    filterExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>,
    limit?: number
  ): Promise<any[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
      });

      const result = await dynamoDBDocClient.send(command);
      return result.Items || [];
    } catch (error) {
      logError(`Error scanning ${this.tableName}`, error);
      throw error;
    }
  }

  async batchGet(keys: Record<string, any>[]): Promise<any[]> {
    try {
      const command = new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: keys,
          },
        },
      });

      const result = await dynamoDBDocClient.send(command);
      return result.Responses?.[this.tableName] || [];
    } catch (error) {
      logError(`Error batch getting items from ${this.tableName}`, error);
      throw error;
    }
  }

  async batchWrite(items: any[], operation: 'PUT' | 'DELETE' = 'PUT'): Promise<void> {
    try {
      const requests = items.map(item => ({
        [operation === 'PUT' ? 'PutRequest' : 'DeleteRequest']: 
          operation === 'PUT' ? { Item: item } : { Key: item }
      }));

      const command = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: requests,
        },
      });

      await dynamoDBDocClient.send(command);
      logInfo(`Batch ${operation.toLowerCase()} completed for ${this.tableName}`, { count: items.length });
    } catch (error) {
      logError(`Error batch writing to ${this.tableName}`, error);
      throw error;
    }
  }
}

// Specific service classes for each table
export class UserService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.users);
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    return this.get({ userId });
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    const users = await this.query({
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
      Limit: 1,
    });

    return users.length > 0 ? users[0] : null;
  }

  async createUser(user: UserProfile): Promise<void> {
    await this.put(user);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): Promise<UserProfile> {
    const updateExpression = 'SET preferences = :preferences, updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':preferences': preferences,
      ':updatedAt': new Date().toISOString(),
    };

    return this.update({ userId }, updateExpression, undefined, expressionAttributeValues);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.delete({ userId });
  }
}

export class ContentIdeaService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.contentIdeas);
  }

  async getContentIdea(ideaId: string, userId: string): Promise<ContentIdea | null> {
    return this.get({ ideaId, userId });
  }

  async createContentIdea(idea: ContentIdea): Promise<void> {
    await this.put(idea);
  }

  async getUserContentIdeas(userId: string, limit?: number): Promise<ContentIdea[]> {
    return this.query({
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async updateContentIdea(
    ideaId: string,
    userId: string,
    updates: Partial<ContentIdea>
  ): Promise<ContentIdea> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'ideaId' && key !== 'userId') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return this.update({ ideaId, userId }, updateExpression, undefined, expressionAttributeValues);
  }

  async deleteContentIdea(ideaId: string, userId: string): Promise<void> {
    await this.delete({ ideaId, userId });
  }
}

export class GeneratedContentService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.generatedContent);
  }

  async getGeneratedContent(contentId: string, version: number = 1): Promise<GeneratedContent | null> {
    return this.get({ contentId, version });
  }

  async createGeneratedContent(content: GeneratedContent): Promise<void> {
    await this.put(content);
  }

  async getUserGeneratedContent(userId: string, limit?: number): Promise<GeneratedContent[]> {
    return this.query({
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async getContentByIdea(ideaId: string, limit?: number): Promise<GeneratedContent[]> {
    return this.query({
      IndexName: 'IdeaIdIndex',
      KeyConditionExpression: 'ideaId = :ideaId',
      ExpressionAttributeValues: {
        ':ideaId': ideaId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async updateGeneratedContent(
    contentId: string,
    version: number,
    updates: Partial<GeneratedContent>
  ): Promise<GeneratedContent> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'contentId' && key !== 'version') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return this.update({ contentId, version }, updateExpression, undefined, expressionAttributeValues);
  }

  async deleteGeneratedContent(contentId: string, version: number): Promise<void> {
    await this.delete({ contentId, version });
  }

  async getLatestVersion(contentId: string): Promise<number> {
    const contents = await this.query({
      KeyConditionExpression: 'contentId = :contentId',
      ExpressionAttributeValues: {
        ':contentId': contentId,
      },
      ScanIndexForward: false, // Highest version first
      Limit: 1,
    });

    return contents.length > 0 ? contents[0].version : 0;
  }
}

export class EngagementFeedbackService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.engagementFeedback);
  }

  async getFeedback(feedbackId: string, timestamp: string): Promise<EngagementFeedback | null> {
    return this.get({ feedbackId, timestamp });
  }

  async createFeedback(feedback: EngagementFeedback): Promise<void> {
    await this.put(feedback);
  }

  async getContentFeedback(contentId: string, limit?: number): Promise<EngagementFeedback[]> {
    return this.query({
      IndexName: 'ContentIdIndex',
      KeyConditionExpression: 'contentId = :contentId',
      ExpressionAttributeValues: {
        ':contentId': contentId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async getUserFeedback(userId: string, limit?: number): Promise<EngagementFeedback[]> {
    return this.query({
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async updateFeedback(
    feedbackId: string,
    timestamp: string,
    updates: Partial<EngagementFeedback>
  ): Promise<EngagementFeedback> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'feedbackId' && key !== 'timestamp') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return this.update({ feedbackId, timestamp }, updateExpression, undefined, expressionAttributeValues);
  }

  async deleteFeedback(feedbackId: string, timestamp: string): Promise<void> {
    await this.delete({ feedbackId, timestamp });
  }
}

export class AudienceProfileService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.audienceProfiles);
  }

  async getAudienceProfile(profileId: string, userId: string): Promise<AudienceProfile | null> {
    return this.get({ profileId, userId });
  }

  async createAudienceProfile(profile: AudienceProfile): Promise<void> {
    await this.put(profile);
  }

  async getUserAudienceProfiles(userId: string, limit?: number): Promise<AudienceProfile[]> {
    return this.query({
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });
  }

  async updateAudienceProfile(
    profileId: string,
    userId: string,
    updates: Partial<AudienceProfile>
  ): Promise<AudienceProfile> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'profileId' && key !== 'userId') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return this.update({ profileId, userId }, updateExpression, undefined, expressionAttributeValues);
  }

  async deleteAudienceProfile(profileId: string, userId: string): Promise<void> {
    await this.delete({ profileId, userId });
  }
}

export class LearningProfileService extends DatabaseService {
  constructor() {
    super(config.aws.dynamoDbTables.learningProfiles || 'ContentFlow-LearningProfiles');
  }

  async getLearningProfile(profileKey: string): Promise<any | null> {
    return this.get({ profileKey });
  }

  async createLearningProfile(profile: any): Promise<void> {
    await this.put(profile);
  }

  async updateLearningProfile(
    profileKey: string,
    updates: any
  ): Promise<any> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'profileKey') {
        updateExpressions.push(`${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    return this.update({ profileKey }, updateExpression, undefined, expressionAttributeValues);
  }

  async getUserLearningProfiles(userId: string, limit?: number): Promise<any[]> {
    return this.query({
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
      Limit: limit,
    });
  }

  async deleteLearningProfile(profileKey: string): Promise<void> {
    await this.delete({ profileKey });
  }
}

// Export service instances
export const userService = new UserService();
export const contentIdeaService = new ContentIdeaService();
export const generatedContentService = new GeneratedContentService();
export const engagementFeedbackService = new EngagementFeedbackService();
export const audienceProfileService = new AudienceProfileService();
export const learningProfileService = new LearningProfileService();