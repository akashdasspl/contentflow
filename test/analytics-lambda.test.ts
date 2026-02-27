import { handler as getDashboardHandler } from '../src/lambda/analytics/get-dashboard';
import { handler as getSummaryHandler } from '../src/lambda/analytics/get-summary';
import { handler as getContentStatsHandler } from '../src/lambda/analytics/get-content-stats';
import { handler as getPerformanceMetricsHandler } from '../src/lambda/analytics/get-performance-metrics';
import { handler as getPlatformStatsHandler } from '../src/lambda/analytics/get-platform-stats';
import { handler as getActivityFeedHandler } from '../src/lambda/analytics/get-activity-feed';
import { handler as exportReportHandler } from '../src/lambda/analytics/export-report';
import { analyticsDashboardService } from '../src/services/analytics-dashboard';
import { validateToken } from '../src/utils';
import { APIGatewayEvent } from '../src/types';

// Mock dependencies
jest.mock('../src/services/analytics-dashboard');
jest.mock('../src/utils');

const mockAnalyticsDashboardService = analyticsDashboardService as jest.Mocked<typeof analyticsDashboardService>;
const mockValidateToken = validateToken as jest.MockedFunction<typeof validateToken>;

describe('Analytics Lambda Functions', () => {
  const mockUserId = 'user_123';
  const mockAuthHeader = 'Bearer valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateToken.mockResolvedValue({ isValid: true, userId: mockUserId });
  });

  const createMockEvent = (
    queryStringParameters?: Record<string, string>,
    body?: string,
    headers?: Record<string, string>
  ): APIGatewayEvent => ({
    httpMethod: 'GET',
    path: '/analytics/dashboard',
    pathParameters: null,
    queryStringParameters,
    headers: { Authorization: mockAuthHeader, ...headers },
    body,
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      }
    }
  });

  describe('getDash