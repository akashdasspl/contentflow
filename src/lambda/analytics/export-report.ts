import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { analyticsDashboardService } from '../../services/analytics-dashboard';
import { validateToken, createResponse } from '../../utils';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Lambda function to export analytics report in CSV or JSON format
 * POST /analytics/export
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Export analytics report request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return createResponse(400, { 
        error: 'Invalid JSON in request body' 
      });
    }

    const { 
      format = 'json', 
      period = 'month',
      startDate,
      endDate,
      includeRawData = false
    } = requestBody;

    // Validate format parameter
    const validFormats = ['json', 'csv'];
    if (!validFormats.includes(format)) {
      return createResponse(400, { 
        error: 'Invalid format parameter',
        message: 'Format must be either "json" or "csv"'
      });
    }

    // Validate period parameter
    const validPeriods = ['week', 'month', 'quarter', 'year', 'custom'];
    if (!validPeriods.includes(period)) {
      return createResponse(400, { 
        error: 'Invalid period parameter',
        message: 'Period must be one of: week, month, quarter, year, custom'
      });
    }

    // Handle custom date range
    let dateRange = undefined;
    if (period === 'custom') {
      if (!startDate || !endDate) {
        return createResponse(400, { 
          error: 'Start date and end date are required for custom period' 
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return createResponse(400, { 
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' 
        });
      }

      if (start >= end) {
        return createResponse(400, { 
          error: 'Start date must be before end date' 
        });
      }

      dateRange = {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      };
    }

    // Get comprehensive analytics data
    const dashboardData = period === 'custom' && dateRange ? 
      await analyticsDashboardService.getDashboardData(authResult.userId, dateRange) :
      await analyticsDashboardService.getDashboardData(authResult.userId);

    const summary = period !== 'custom' ? 
      await analyticsDashboardService.getAnalyticsSummary(authResult.userId, period as any) :
      null;

    // Prepare export data
    const exportData = {
      exportInfo: {
        userId: authResult.userId,
        exportedAt: new Date().toISOString(),
        format,
        period,
        dateRange: dashboardData.dateRange
      },
      summary: summary || {
        userId: authResult.userId,
        period: 'custom',
        dateRange: dashboardData.dateRange,
        summary: {
          totalContent: dashboardData.contentStats.totalContent,
          totalEngagement: dashboardData.engagementStats.totalEngagement,
          averageEngagementRate: dashboardData.engagementStats.averageEngagementRate,
          bestPlatform: dashboardData.platformStats.bestPerformingPlatform,
          contentVelocity: dashboardData.performanceMetrics.contentVelocity,
          qualityScore: dashboardData.contentStats.averageQualityScore
        },
        highlights: dashboardData.insights.slice(0, 5),
        generatedAt: new Date().toISOString()
      },
      analytics: {
        contentStats: dashboardData.contentStats,
        engagementStats: dashboardData.engagementStats,
        platformStats: dashboardData.platformStats,
        performanceMetrics: dashboardData.performanceMetrics,
        insights: dashboardData.insights
      }
    };

    // Add raw data if requested
    if (includeRawData) {
      exportData.analytics = {
        ...exportData.analytics,
        recentActivity: dashboardData.recentActivity
      };
    }

    // Generate file content based on format
    let fileContent: string;
    let contentType: string;
    let fileExtension: string;

    if (format === 'csv') {
      fileContent = generateCSVReport(exportData);
      contentType = 'text/csv';
      fileExtension = 'csv';
    } else {
      fileContent = JSON.stringify(exportData, null, 2);
      contentType = 'application/json';
      fileExtension = 'json';
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `contentflow-analytics-${authResult.userId}-${period}-${timestamp}.${fileExtension}`;

    // Upload to S3
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const bucketName = process.env.ANALYTICS_BUCKET_NAME;

    if (!bucketName) {
      return createResponse(500, { 
        error: 'Analytics bucket not configured' 
      });
    }

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: `exports/${authResult.userId}/${filename}`,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        userId: authResult.userId,
        exportType: 'analytics-report',
        format,
        period,
        exportedAt: new Date().toISOString()
      }
    });

    await s3Client.send(uploadCommand);

    // Generate presigned URL for download (valid for 1 hour)
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: `exports/${authResult.userId}/${filename}`
    });

    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });

    return createResponse(200, {
      success: true,
      data: {
        exportId: filename.replace(`.${fileExtension}`, ''),
        filename,
        format,
        period,
        dateRange: dashboardData.dateRange,
        downloadUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        fileSize: Buffer.byteLength(fileContent, 'utf8'),
        summary: {
          totalContent: exportData.summary.summary.totalContent,
          totalEngagement: exportData.summary.summary.totalEngagement,
          dateRange: exportData.summary.dateRange
        }
      }
    });

  } catch (error) {
    console.error('Error exporting analytics report:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to export analytics report'
    });
  }
};

/**
 * Generate CSV format report
 */
function generateCSVReport(data: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push('ContentFlow AI Analytics Report');
  lines.push(`Exported: ${data.exportInfo.exportedAt}`);
  lines.push(`Period: ${data.exportInfo.period}`);
  lines.push(`Date Range: ${data.exportInfo.dateRange.startDate} to ${data.exportInfo.dateRange.endDate}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('Metric,Value');
  lines.push(`Total Content,${data.summary.summary.totalContent}`);
  lines.push(`Total Engagement,${data.summary.summary.totalEngagement}`);
  lines.push(`Average Engagement Rate,${(data.summary.summary.averageEngagementRate * 100).toFixed(2)}%`);
  lines.push(`Best Platform,${data.summary.summary.bestPlatform || 'N/A'}`);
  lines.push(`Content Velocity,${data.summary.summary.contentVelocity}`);
  lines.push(`Quality Score,${data.summary.summary.qualityScore}`);
  lines.push('');

  // Content Statistics
  lines.push('CONTENT STATISTICS');
  lines.push('Metric,Value');
  lines.push(`Total Ideas,${data.analytics.contentStats.totalIdeas}`);
  lines.push(`Total Words,${data.analytics.contentStats.totalWords}`);
  lines.push(`Average Words per Content,${data.analytics.contentStats.averageWordsPerContent}`);
  lines.push(`Average Quality Score,${data.analytics.contentStats.averageQualityScore}`);
  lines.push(`Content Trend,${data.analytics.contentStats.trend}`);
  lines.push('');

  // Platform Breakdown
  lines.push('PLATFORM BREAKDOWN');
  lines.push('Platform,Content Count');
  Object.entries(data.analytics.contentStats.platformBreakdown).forEach(([platform, count]) => {
    lines.push(`${platform},${count}`);
  });
  lines.push('');

  // Content Type Breakdown
  lines.push('CONTENT TYPE BREAKDOWN');
  lines.push('Content Type,Count');
  Object.entries(data.analytics.contentStats.contentTypeBreakdown).forEach(([type, count]) => {
    lines.push(`${type},${count}`);
  });
  lines.push('');

  // Engagement Statistics
  lines.push('ENGAGEMENT STATISTICS');
  lines.push('Metric,Value');
  lines.push(`Total Likes,${data.analytics.engagementStats.totalLikes}`);
  lines.push(`Total Shares,${data.analytics.engagementStats.totalShares}`);
  lines.push(`Total Comments,${data.analytics.engagementStats.totalComments}`);
  lines.push(`Total Impressions,${data.analytics.engagementStats.totalImpressions}`);
  lines.push(`Total Reach,${data.analytics.engagementStats.totalReach}`);
  lines.push(`Average Engagement Rate,${(data.analytics.engagementStats.averageEngagementRate * 100).toFixed(3)}%`);
  lines.push(`Average Click-Through Rate,${(data.analytics.engagementStats.averageClickThroughRate * 100).toFixed(3)}%`);
  lines.push(`Engagement Trend,${data.analytics.engagementStats.engagementTrend}`);
  lines.push('');

  // Performance Metrics
  lines.push('PERFORMANCE METRICS');
  lines.push('Metric,Value');
  lines.push(`Content Velocity,${data.analytics.performanceMetrics.contentVelocity}`);
  lines.push(`Engagement Growth,${data.analytics.performanceMetrics.engagementGrowth}%`);
  lines.push(`Quality Trend,${data.analytics.performanceMetrics.qualityTrend}`);
  lines.push(`ROI,${data.analytics.performanceMetrics.roi}`);
  lines.push(`Overall Performance,${data.analytics.performanceMetrics.overallPerformance}`);
  lines.push('');

  // Key Insights
  lines.push('KEY INSIGHTS');
  data.analytics.insights.forEach((insight: string, index: number) => {
    lines.push(`${index + 1}. ${insight}`);
  });

  return lines.join('\n');
}