// Property-based tests for content idea persistence
// **Validates: Requirements 1.4**

import fc from 'fast-check';
import { handler as submitIdeaHandler } from '../src/lambda/content/submit-idea';
import { handler as getIdeasHandler } from '../src/lambda/content/get-ideas';
import { handler as updateIdeaHandler } from '../src/lambda/content/update-idea';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { contentIdeaService } from '../src/services/database';
import { themeExtractionService } from '../src/services/theme-extraction';
import { ContentIdea } from '../src/types';
import * as utils from '../src/utils';

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/services/theme-extraction');
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  verifyJWT: jest.fn(),
  generateIdeaId: jest.fn(),
  getCurrentTimestamp: jest.fn(),
}));

const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;
const mockThemeExtractionService = themeExtractionService as jest.Mocked<typeof themeExtractionService>;
const mockVerifyJWT = utils.verifyJWT as jest.MockedFunction<typeof utils.verifyJWT>;
const mockGenerateIdeaId = utils.generateIdeaId as jest.MockedFunction<typeof utils.generateIdeaId>;
const mockGetCurrentTimestamp = utils.getCurrentTimestamp as jest.MockedFunction<typeof utils.getCurrentTimestamp>;

/**
 * Property-based tests for content idea persistence
 * **Validates: Requirements 1.4**
 */
describe('Content Idea Persistence Properties', () => {
  const mockUserId = 'test-user-id';
  const mockTimestamp = '2024-01-01T00:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyJWT.mockReturnValue({ userId: mockUserId });
    mockGetCurrentTimestamp.mockReturnValue(mockTimestamp);
    
    // Mock theme extraction service
    mockThemeExtractionService.extractThemesAndTopics.mockResolvedValue({
      themes: ['test theme'],
      topics: ['test topic'],
      entities: [],
      keyPhrases: [],
      sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
      intent: 'informational',
      overallConfidence: 0.7,
      processingTime: 1000,
    });
    mockThemeExtractionService.updateContentIdeaWithThemes.mockResolvedValue();
  });

  const createMockEvent = (
    httpMethod: string,
    body?: any,
    pathParameters?: any,
    queryStringParameters?: any
  ): APIGatewayProxyEvent => ({
    httpMethod,
    path: '/content/ideas',
    pathParameters,
    queryStringParameters,
    headers: {
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/content/ideas',
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api-id',
      stage: 'test',
      protocol: 'HTTP/1.1',
      httpMethod,
      path: '/content/ideas',
      resourceId: 'test-resource-id',
      resourcePath: '/content/ideas',
      authorizer: {},
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
        clientCert: null,
      },
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
    },
  });

  const createMockContentIdea = (overrides: Partial<ContentIdea> = {}): ContentIdea => ({
    ideaId: 'test-idea-id',
    userId: mockUserId,
    content: 'Test content idea',
    extractedThemes: ['theme1', 'theme2'],
    targetAudience: {
      profileId: 'profile_1',
      userId: mockUserId,
      demographics: { ageRange: '25-35', location: 'US', interests: ['tech'] },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post'],
        engagementTimes: ['morning'],
        platformUsage: {
          blog: { frequency: 'daily', engagementRate: 0.5, preferredContentLength: 'long', bestPostingTimes: ['9am'] },
          twitter: { frequency: 'hourly', engagementRate: 0.3, preferredContentLength: 'short', bestPostingTimes: ['12pm'] },
          facebook: { frequency: 'daily', engagementRate: 0.4, preferredContentLength: 'medium', bestPostingTimes: ['6pm'] },
          instagram: { frequency: 'daily', engagementRate: 0.6, preferredContentLength: 'short', bestPostingTimes: ['8pm'] },
          linkedin: { frequency: 'weekly', engagementRate: 0.7, preferredContentLength: 'long', bestPostingTimes: ['10am'] },
          youtube: { frequency: 'weekly', engagementRate: 0.8, preferredContentLength: 'long', bestPostingTimes: ['7pm'] },
          tiktok: { frequency: 'daily', engagementRate: 0.5, preferredContentLength: 'short', bestPostingTimes: ['9pm'] },
        },
      },
      updatedAt: mockTimestamp,
    },
    intent: 'informational',
    confidenceScore: 0.8,
    createdAt: mockTimestamp,
    ...overrides,
  });

  /**
   * Property 3: Content Idea Persistence
   * For any submitted content idea, the system should store it persistently 
   * and make it retrievable for future reference
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Content Idea Persistence', () => {
    it('should persistently store any valid content idea', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various valid content ideas
          fc.record({
            content: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
            ideaId: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async ({ content, ideaId }: { content: string; ideaId: string }) => {
            // Arrange
            mockGenerateIdeaId.mockReturnValue(ideaId);
            mockContentIdeaService.createContentIdea.mockResolvedValue();
            
            const event = createMockEvent('POST', { content });

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(201);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.ideaId).toBe(ideaId);
            expect(responseBody.data.content).toBe(content.trim());

            // Verify persistence call was made with correct data
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledWith(
              expect.objectContaining({
                ideaId,
                userId: mockUserId,
                content: content.trim(),
                createdAt: mockTimestamp,
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should make stored content ideas retrievable by user', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arrays of content ideas for a user
          fc.array(
            fc.record({
              ideaId: fc.string({ minLength: 5, maxLength: 50 }),
              content: fc.string({ minLength: 10, maxLength: 500 }).filter(s => s.trim().length > 0),
              intent: fc.constantFrom('informational', 'promotional', 'educational', 'entertainment'),
              confidenceScore: fc.float({ min: 0, max: 1 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 100 }), // limit parameter
          async (contentIdeas: any[], limit: number) => {
            // Arrange
            const mockIdeas = contentIdeas.map(idea => createMockContentIdea(idea));
            mockContentIdeaService.getUserContentIdeas.mockResolvedValue(mockIdeas);
            
            const event = createMockEvent('GET', null, null, { limit: limit.toString() });

            // Act
            const result = await getIdeasHandler(event);

            // Assert
            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.ideas).toEqual(mockIdeas);
            expect(responseBody.data.count).toBe(mockIdeas.length);
            expect(responseBody.data.userId).toBe(mockUserId);

            // Verify retrieval was called with correct parameters
            expect(mockContentIdeaService.getUserContentIdeas).toHaveBeenCalledWith(mockUserId, limit);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain data integrity across store and retrieve operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content idea data
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 400 }).filter(s => s.trim().length > 0),
            ideaId: fc.string({ minLength: 8, maxLength: 40 }),
            themes: fc.array(fc.string({ minLength: 3, maxLength: 30 }), { minLength: 0, maxLength: 10 }),
            intent: fc.constantFrom('informational', 'promotional', 'educational', 'entertainment'),
            confidenceScore: fc.float({ min: 0, max: 1 }),
          }),
          async ({ content, ideaId, themes, intent, confidenceScore }) => {
            // Arrange - Mock the complete flow
            mockGenerateIdeaId.mockReturnValue(ideaId);
            mockContentIdeaService.createContentIdea.mockResolvedValue();
            
            const storedIdea = createMockContentIdea({
              ideaId,
              content: content.trim(),
              extractedThemes: themes,
              intent,
              confidenceScore,
            });
            mockContentIdeaService.getUserContentIdeas.mockResolvedValue([storedIdea]);

            // Act - Store the content idea
            const submitEvent = createMockEvent('POST', { content });
            const submitResult = await submitIdeaHandler(submitEvent);

            // Retrieve the content ideas
            const getEvent = createMockEvent('GET', null, null, { limit: '10' });
            const getResult = await getIdeasHandler(getEvent);

            // Assert - Data integrity is maintained
            expect(submitResult.statusCode).toBe(201);
            expect(getResult.statusCode).toBe(200);

            const submitResponseBody = JSON.parse(submitResult.body);
            const getResponseBody = JSON.parse(getResult.body);

            // Verify stored data matches submitted data
            expect(submitResponseBody.data.ideaId).toBe(ideaId);
            expect(submitResponseBody.data.content).toBe(content.trim());

            // Verify retrieved data maintains integrity
            expect(getResponseBody.data.ideas).toHaveLength(1);
            const retrievedIdea = getResponseBody.data.ideas[0];
            expect(retrievedIdea.ideaId).toBe(ideaId);
            expect(retrievedIdea.content).toBe(content.trim());
            expect(retrievedIdea.userId).toBe(mockUserId);
            expect(retrievedIdea.extractedThemes).toEqual(themes);
            expect(retrievedIdea.intent).toBe(intent);
            expect(retrievedIdea.confidenceScore).toBe(confidenceScore);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should support persistent updates to stored content ideas', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate original and updated content
          fc.record({
            ideaId: fc.string({ minLength: 8, maxLength: 40 }),
            originalContent: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
            updatedContent: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
            updatedThemes: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
            updatedIntent: fc.constantFrom('informational', 'promotional', 'educational', 'entertainment'),
          }),
          async ({ ideaId, originalContent, updatedContent, updatedThemes, updatedIntent }) => {
            // Arrange
            const originalIdea = createMockContentIdea({
              ideaId,
              content: originalContent.trim(),
            });
            const updatedIdea = createMockContentIdea({
              ideaId,
              content: updatedContent.trim(),
              extractedThemes: updatedThemes,
              intent: updatedIntent,
            });

            mockContentIdeaService.getContentIdea.mockResolvedValue(originalIdea);
            mockContentIdeaService.updateContentIdea.mockResolvedValue(updatedIdea);

            // Act - Update the content idea
            const updateEvent = createMockEvent('PUT', {
              content: updatedContent,
              extractedThemes: updatedThemes,
              intent: updatedIntent,
            }, { ideaId });

            const result = await updateIdeaHandler(updateEvent);

            // Assert
            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.ideaId).toBe(ideaId);
            expect(responseBody.data.content).toBe(updatedContent.trim());
            expect(responseBody.data.extractedThemes).toEqual(updatedThemes);
            expect(responseBody.data.intent).toBe(updatedIntent);

            // Verify update was called with correct data
            expect(mockContentIdeaService.updateContentIdea).toHaveBeenCalledWith(
              ideaId,
              mockUserId,
              expect.objectContaining({
                content: updatedContent.trim(),
                extractedThemes: updatedThemes,
                intent: updatedIntent,
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain user isolation in content idea storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content ideas for different users
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 5, maxLength: 30 }),
              content: fc.string({ minLength: 10, maxLength: 300 }).filter(s => s.trim().length > 0),
              ideaId: fc.string({ minLength: 8, maxLength: 40 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (userIdeas: any[]) => {
            // Test each user's ideas separately
            for (const { userId, content, ideaId } of userIdeas) {
              // Arrange
              mockVerifyJWT.mockReturnValue({ userId });
              mockGenerateIdeaId.mockReturnValue(ideaId);
              mockContentIdeaService.createContentIdea.mockResolvedValue();
              
              const userIdea = createMockContentIdea({
                ideaId,
                userId,
                content: content.trim(),
              });
              mockContentIdeaService.getUserContentIdeas.mockResolvedValue([userIdea]);

              // Act - Store content idea for this user
              const submitEvent = createMockEvent('POST', { content });
              const submitResult = await submitIdeaHandler(submitEvent);

              // Retrieve content ideas for this user
              const getEvent = createMockEvent('GET', null, null, { limit: '10' });
              const getResult = await getIdeasHandler(getEvent);

              // Assert - User isolation is maintained
              expect(submitResult.statusCode).toBe(201);
              expect(getResult.statusCode).toBe(200);

              const getResponseBody = JSON.parse(getResult.body);
              expect(getResponseBody.data.userId).toBe(userId);
              expect(getResponseBody.data.ideas).toHaveLength(1);
              expect(getResponseBody.data.ideas[0].userId).toBe(userId);
              expect(getResponseBody.data.ideas[0].ideaId).toBe(ideaId);

              // Verify database calls use correct user ID
              expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledWith(
                expect.objectContaining({ userId })
              );
              expect(mockContentIdeaService.getUserContentIdeas).toHaveBeenCalledWith(userId, 10);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle concurrent storage operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple content ideas for concurrent storage
          fc.array(
            fc.record({
              content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
              ideaId: fc.string({ minLength: 8, maxLength: 40 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (contentIdeas: any[]) => {
            // Arrange
            mockContentIdeaService.createContentIdea.mockResolvedValue();
            
            // Mock different idea IDs for each request
            let callCount = 0;
            mockGenerateIdeaId.mockImplementation(() => contentIdeas[callCount++]?.ideaId || 'default-id');

            // Act - Submit all content ideas concurrently
            const submitPromises = contentIdeas.map(({ content }) => {
              const event = createMockEvent('POST', { content });
              return submitIdeaHandler(event);
            });

            const results = await Promise.all(submitPromises);

            // Assert - All submissions should succeed
            results.forEach((result, index) => {
              expect(result.statusCode).toBe(201);
              const responseBody = JSON.parse(result.body);
              expect(responseBody.success).toBe(true);
              expect(responseBody.data.ideaId).toBe(contentIdeas[index].ideaId);
              expect(responseBody.data.content).toBe(contentIdeas[index].content.trim());
            });

            // Verify all storage calls were made
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledTimes(contentIdeas.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve metadata and timestamps in stored content ideas', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content idea with metadata
          fc.record({
            content: fc.string({ minLength: 20, maxLength: 400 }).filter(s => s.trim().length > 0),
            ideaId: fc.string({ minLength: 10, maxLength: 50 }),
            timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
              .map(d => d.toISOString()),
          }),
          async ({ content, ideaId, timestamp }) => {
            // Arrange
            mockGenerateIdeaId.mockReturnValue(ideaId);
            mockGetCurrentTimestamp.mockReturnValue(timestamp);
            mockContentIdeaService.createContentIdea.mockResolvedValue();

            const storedIdea = createMockContentIdea({
              ideaId,
              content: content.trim(),
              createdAt: timestamp,
            });
            mockContentIdeaService.getUserContentIdeas.mockResolvedValue([storedIdea]);

            // Act - Store and retrieve content idea
            const submitEvent = createMockEvent('POST', { content });
            const submitResult = await submitIdeaHandler(submitEvent);

            const getEvent = createMockEvent('GET', null, null, { limit: '1' });
            const getResult = await getIdeasHandler(getEvent);

            // Assert - Metadata is preserved
            expect(submitResult.statusCode).toBe(201);
            expect(getResult.statusCode).toBe(200);

            const submitResponseBody = JSON.parse(submitResult.body);
            const getResponseBody = JSON.parse(getResult.body);

            // Verify timestamp preservation
            expect(submitResponseBody.data.createdAt).toBe(timestamp);
            expect(getResponseBody.data.ideas[0].createdAt).toBe(timestamp);
            expect(getResponseBody.data.ideas[0].ideaId).toBe(ideaId);

            // Verify storage call included correct metadata
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledWith(
              expect.objectContaining({
                ideaId,
                userId: mockUserId,
                content: content.trim(),
                createdAt: timestamp,
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle storage failures gracefully without data corruption', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content for failure testing
          fc.string({ minLength: 10, maxLength: 300 }).filter(s => s.trim().length > 0),
          async (content: string) => {
            // Arrange - Mock storage failure
            mockContentIdeaService.createContentIdea.mockRejectedValue(new Error('Storage failure'));
            
            const event = createMockEvent('POST', { content });

            // Act
            const result = await submitIdeaHandler(event);

            // Assert - Failure is handled gracefully
            expect(result.statusCode).toBe(500);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error.message).toContain('Failed to store content idea');

            // Verify no partial data corruption
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});