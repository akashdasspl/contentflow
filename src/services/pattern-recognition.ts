import { EngagementFeedback, Platform } from '../types';
import { openSearchService } from './opensearch-service';
import { feedbackProcessingService } from './feedback-processing';

/**
 * Service for pattern recognition and analysis of content performance
 * Implements performance pattern identification, successful content analysis,
 * and trend analysis with insight generation
 */
export class PatternRecognitionService {

  /**
   * Identify performance patterns from user's feedback data
   */
  async identifyPerformancePatterns(userId: string, options: PatternAnalysisOptions = {}): Promise<PerformancePatterns> {
    try {
      // Get comprehensive user insights from OpenSearch
      const insights = await openSearchService.getUserInsights(userId, {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        platform: options.platform,
        timeInterval: options.timeInterval || 'day'
      });

      // Get trending patterns for context
      const trendingPatterns = await openSearchService.getTrendingPatterns({
        dateFrom: options.dateFrom,
        platform: options.platform
      });

      // Analyze patterns
      const patterns: PerformancePatterns = {
        userId,
        analysisDate: new Date().toISOString(),
        timeRange: {
          from: options.dateFrom || null,
          to: options.dateTo || null
        },
        platformPatterns: this.analyzePlatformPatterns(insights.platformPerformance),
        contentTypePatterns: this.analyzeContentTypePatterns(insights.contentTypePerformance),
        temporalPatterns: this.analyzeTemporalPatterns(insights.performanceOverTime, insights.bestPostingHours),
        hashtagPatterns: this.analyzeHashtagPatterns(insights.topHashtags, trendingPatterns.trendingHashtags),
        engagementPatterns: this.analyzeEngagementPatterns(insights),
        successFactors: await this.identifySuccessFactors(userId, insights),
        recommendations: this.generatePatternBasedRecommendations(insights, trendingPatterns)
      };

      return patterns;

    } catch (error) {
      console.error('Error identifying performance patterns:', error);
      throw new Error(`Failed to identify performance patterns: ${error}`);
    }
  }

  /**
   * Analyze successful content characteristics
   */
  async analyzeSuccessfulContent(userId: string, options: ContentAnalysisOptions = {}): Promise<SuccessfulContentAnalysis> {
    try {
      // Get high-performing content
      const highPerformingContent = await this.getHighPerformingContent(userId, options);
      
      // Analyze characteristics
      const characteristics = await this.extractContentCharacteristics(highPerformingContent);
      
      // Compare with average performance
      const benchmarkComparison = await this.compareWithBenchmarks(userId, characteristics, options);
      
      // Generate insights
      const insights = this.generateContentInsights(characteristics, benchmarkComparison);

      return {
        userId,
        analysisDate: new Date().toISOString(),
        criteria: {
          minEngagementRate: options.minEngagementRate || 0.1,
          minClickThroughRate: options.minClickThroughRate || 0.05,
          platform: options.platform || null,
          contentType: options.contentType || null
        },
        highPerformingContent,
        characteristics,
        benchmarkComparison,
        insights,
        recommendations: this.generateContentRecommendations(characteristics, insights)
      };

    } catch (error) {
      console.error('Error analyzing successful content:', error);
      throw new Error(`Failed to analyze successful content: ${error}`);
    }
  }

  /**
   * Generate trend analysis and insights
   */
  async generateTrendAnalysis(userId: string, options: TrendAnalysisOptions = {}): Promise<TrendAnalysis> {
    try {
      // Get performance over time data
      const insights = await openSearchService.getUserInsights(userId, {
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        platform: options.platform,
        timeInterval: options.timeInterval || 'day'
      });

      // Get trending patterns
      const trendingPatterns = await openSearchService.getTrendingPatterns({
        dateFrom: options.dateFrom,
        platform: options.platform
      });

      // Analyze trends
      const trends = this.analyzeTrends(insights.performanceOverTime);
      const seasonality = this.analyzeSeasonality(insights.performanceOverTime);
      const momentum = this.calculateMomentum(insights.performanceOverTime);
      const forecasts = this.generateForecasts(insights.performanceOverTime, trends);

      return {
        userId,
        analysisDate: new Date().toISOString(),
        timeRange: {
          from: options.dateFrom || null,
          to: options.dateTo || null,
          interval: options.timeInterval || 'day'
        },
        overallTrend: trends.overall,
        platformTrends: trends.byPlatform,
        seasonalPatterns: seasonality,
        momentum,
        forecasts,
        trendingTopics: trendingPatterns.trendingHashtags.slice(0, 10),
        insights: this.generateTrendInsights(trends, seasonality, momentum, trendingPatterns),
        recommendations: this.generateTrendRecommendations(trends, seasonality, trendingPatterns)
      };

    } catch (error) {
      console.error('Error generating trend analysis:', error);
      throw new Error(`Failed to generate trend analysis: ${error}`);
    }
  }

  /**
   * Analyze platform-specific patterns
   */
  private analyzePlatformPatterns(platformPerformance: any[]): PlatformPattern[] {
    return platformPerformance.map(platform => {
      const avgEngagement = platform.avgEngagementRate;
      const avgCTR = platform.avgClickThroughRate;
      const contentCount = platform.count;

      // Calculate performance score
      const performanceScore = (avgEngagement * 0.6) + (avgCTR * 0.4);

      // Determine pattern type
      let patternType: 'high_performer' | 'consistent' | 'variable' | 'underperformer';
      if (performanceScore >= 0.08) {
        patternType = 'high_performer';
      } else if (performanceScore >= 0.05 && contentCount >= 10) {
        patternType = 'consistent';
      } else if (contentCount < 5) {
        patternType = 'variable';
      } else {
        patternType = 'underperformer';
      }

      return {
        platform: platform.platform,
        contentCount,
        avgEngagementRate: avgEngagement,
        avgClickThroughRate: avgCTR,
        performanceScore,
        patternType,
        insights: this.generatePlatformInsights(platform, patternType)
      };
    });
  }

  /**
   * Analyze content type patterns
   */
  private analyzeContentTypePatterns(contentTypePerformance: any[]): ContentTypePattern[] {
    return contentTypePerformance.map(contentType => {
      const avgEngagement = contentType.avgEngagementRate;
      const avgCTR = contentType.avgClickThroughRate;
      const contentCount = contentType.count;

      // Calculate effectiveness score
      const effectivenessScore = (avgEngagement * 0.7) + (avgCTR * 0.3);

      return {
        contentType: contentType.contentType,
        contentCount,
        avgEngagementRate: avgEngagement,
        avgClickThroughRate: avgCTR,
        effectivenessScore,
        recommendation: this.getContentTypeRecommendation(effectivenessScore, contentCount)
      };
    });
  }

  /**
   * Analyze temporal patterns
   */
  private analyzeTemporalPatterns(performanceOverTime: any[], bestPostingHours: any[]): TemporalPattern {
    // Analyze day-of-week patterns
    const dayPatterns = this.analyzeDayOfWeekPatterns(performanceOverTime);
    
    // Analyze hour-of-day patterns
    const hourPatterns = bestPostingHours.slice(0, 5).map((hour: any) => ({
      hour: hour.hour,
      avgEngagementRate: hour.avgEngagementRate,
      contentCount: hour.count,
      effectiveness: this.categorizeHourEffectiveness(hour.avgEngagementRate)
    }));

    // Analyze posting frequency patterns
    const frequencyPattern = this.analyzePostingFrequency(performanceOverTime);

    return {
      bestHours: hourPatterns,
      dayOfWeekPatterns: dayPatterns,
      postingFrequency: frequencyPattern,
      insights: this.generateTemporalInsights(hourPatterns, dayPatterns, frequencyPattern)
    };
  }

  /**
   * Analyze hashtag patterns
   */
  private analyzeHashtagPatterns(topHashtags: any[], trendingHashtags: any[]): HashtagPattern {
    // Analyze user's top hashtags
    const userHashtags = topHashtags.slice(0, 20).map((hashtag: any) => ({
      hashtag: hashtag.hashtag,
      usageCount: hashtag.count,
      effectiveness: this.categorizeHashtagEffectiveness(hashtag.count)
    }));

    // Find trending hashtags user hasn't used
    const unusedTrending = trendingHashtags
      .filter((trending: any) => !topHashtags.some((user: any) => user.hashtag === trending.hashtag))
      .slice(0, 10)
      .map((hashtag: any) => ({
        hashtag: hashtag.hashtag,
        trendScore: hashtag.trendScore,
        avgEngagement: hashtag.avgEngagement,
        opportunity: 'high'
      }));

    return {
      topPerformingHashtags: userHashtags.slice(0, 10),
      underutilizedHashtags: userHashtags.filter(h => h.effectiveness === 'low'),
      trendingOpportunities: unusedTrending,
      insights: this.generateHashtagInsights(userHashtags, unusedTrending)
    };
  }

  /**
   * Analyze engagement patterns
   */
  private analyzeEngagementPatterns(insights: any): EngagementPattern {
    const platformPerformance = insights.platformPerformance;
    const performanceDistribution = insights.performanceDistribution;

    // Calculate engagement consistency
    const engagementRates = platformPerformance.map((p: any) => p.avgEngagementRate);
    const avgEngagement = engagementRates.reduce((sum: number, rate: number) => sum + rate, 0) / engagementRates.length;
    const variance = engagementRates.reduce((sum: number, rate: number) => sum + Math.pow(rate - avgEngagement, 2), 0) / engagementRates.length;
    const consistency = variance < 0.001 ? 'high' : variance < 0.01 ? 'medium' : 'low';

    // Analyze performance distribution
    const totalContent = performanceDistribution.reduce((sum: any, p: any) => sum + p.count, 0);
    const highPerformanceRate = totalContent > 0 ? 
      (performanceDistribution.find((p: any) => p.category === 'high')?.count || 0) / totalContent : 0;

    return {
      avgEngagementRate: avgEngagement,
      consistency,
      highPerformanceRate,
      engagementTypes: this.analyzeEngagementTypes(platformPerformance),
      patterns: this.identifyEngagementPatterns(platformPerformance, performanceDistribution)
    };
  }

  /**
   * Identify success factors from high-performing content
   */
  private async identifySuccessFactors(userId: string, insights: any): Promise<SuccessFactor[]> {
    const factors: SuccessFactor[] = [];

    // Platform success factors
    if (insights.platformPerformance.length > 0) {
      const bestPlatform = insights.platformPerformance
        .sort((a: any, b: any) => b.avgEngagementRate - a.avgEngagementRate)[0];
      
      factors.push({
        type: 'platform',
        factor: `${bestPlatform.platform} optimization`,
        impact: 'high',
        confidence: 0.9,
        description: `Content performs ${((bestPlatform.avgEngagementRate / 0.05) * 100).toFixed(0)}% better on ${bestPlatform.platform}`,
        recommendation: `Focus more content creation on ${bestPlatform.platform}`
      });
    }

    // Timing success factors
    if (insights.bestPostingHours.length > 0) {
      const bestHour = insights.bestPostingHours[0];
      factors.push({
        type: 'timing',
        factor: `${bestHour.hour}:00 posting time`,
        impact: 'medium',
        confidence: 0.8,
        description: `Content posted at ${bestHour.hour}:00 achieves ${(bestHour.avgEngagementRate * 100).toFixed(1)}% engagement rate`,
        recommendation: `Schedule more posts around ${bestHour.hour}:00`
      });
    }

    // Hashtag success factors
    if (insights.topHashtags.length > 0) {
      const topHashtag = insights.topHashtags[0];
      factors.push({
        type: 'hashtag',
        factor: `#${topHashtag.hashtag} usage`,
        impact: 'medium',
        confidence: 0.7,
        description: `#${topHashtag.hashtag} is your most frequently used hashtag`,
        recommendation: `Continue using #${topHashtag.hashtag} and explore related hashtags`
      });
    }

    return factors;
  }

  /**
   * Get high-performing content based on criteria
   */
  private async getHighPerformingContent(userId: string, options: ContentAnalysisOptions): Promise<any[]> {
    try {
      const searchResult = await openSearchService.searchFeedback({
        userId,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        platform: options.platform,
        size: 100,
        sort: [{ 'metrics.engagementRate': { order: 'desc' } }]
      });

      // Filter by performance criteria
      return searchResult.hits
        .map(hit => hit.source)
        .filter(content => {
          const engagementRate = content.metrics?.engagementRate || 0;
          const clickThroughRate = content.metrics?.clickThroughRate || 0;
          
          return engagementRate >= (options.minEngagementRate || 0.1) ||
                 clickThroughRate >= (options.minClickThroughRate || 0.05);
        })
        .slice(0, 50); // Limit to top 50

    } catch (error) {
      console.error('Error getting high-performing content:', error);
      return [];
    }
  }

  /**
   * Extract characteristics from high-performing content
   */
  private async extractContentCharacteristics(content: any[]): Promise<ContentCharacteristics> {
    if (content.length === 0) {
      return {
        avgWordCount: 0,
        commonHashtags: [],
        avgHashtagCount: 0,
        commonKeywords: [],
        avgEngagementRate: 0,
        avgClickThroughRate: 0,
        platformDistribution: {},
        contentTypeDistribution: {},
        postingTimeDistribution: {}
      };
    }

    // Calculate averages
    const avgWordCount = content.reduce((sum, c) => sum + (c.wordCount || 0), 0) / content.length;
    const avgEngagementRate = content.reduce((sum, c) => sum + (c.metrics?.engagementRate || 0), 0) / content.length;
    const avgClickThroughRate = content.reduce((sum, c) => sum + (c.metrics?.clickThroughRate || 0), 0) / content.length;

    // Analyze hashtags
    const allHashtags = content.flatMap(c => c.hashtags || []);
    const hashtagCounts = this.countOccurrences(allHashtags);
    const commonHashtags = Object.entries(hashtagCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 20)
      .map(([hashtag, count]) => ({ hashtag, count: count as number }));

    const avgHashtagCount = content.reduce((sum, c) => sum + (c.hashtags?.length || 0), 0) / content.length;

    // Analyze keywords
    const allKeywords = content.flatMap(c => c.seoKeywords || []);
    const keywordCounts = this.countOccurrences(allKeywords);
    const commonKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count: count as number }));

    // Analyze distributions
    const platformDistribution = this.calculateDistribution(content, 'platform');
    const contentTypeDistribution = this.calculateDistribution(content, 'contentType');
    const postingTimeDistribution = this.calculateTimeDistribution(content);

    return {
      avgWordCount,
      commonHashtags,
      avgHashtagCount,
      commonKeywords,
      avgEngagementRate,
      avgClickThroughRate,
      platformDistribution,
      contentTypeDistribution,
      postingTimeDistribution
    };
  }

  /**
   * Compare characteristics with user's overall benchmarks
   */
  private async compareWithBenchmarks(userId: string, characteristics: ContentCharacteristics, options: ContentAnalysisOptions): Promise<BenchmarkComparison> {
    try {
      // Get all user content for comparison
      const allContentResult = await openSearchService.searchFeedback({
        userId,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        size: 1000
      });

      const allContent = allContentResult.hits.map(hit => hit.source);

      if (allContent.length === 0) {
        return {
          wordCountComparison: { difference: 0, significance: 'none' },
          hashtagCountComparison: { difference: 0, significance: 'none' },
          engagementRateComparison: { difference: 0, significance: 'none' },
          clickThroughRateComparison: { difference: 0, significance: 'none' }
        };
      }

      // Calculate overall averages
      const overallAvgWordCount = allContent.reduce((sum, c) => sum + (c.wordCount || 0), 0) / allContent.length;
      const overallAvgHashtagCount = allContent.reduce((sum, c) => sum + (c.hashtags?.length || 0), 0) / allContent.length;
      const overallAvgEngagementRate = allContent.reduce((sum, c) => sum + (c.metrics?.engagementRate || 0), 0) / allContent.length;
      const overallAvgClickThroughRate = allContent.reduce((sum, c) => sum + (c.metrics?.clickThroughRate || 0), 0) / allContent.length;

      return {
        wordCountComparison: this.compareMetric(characteristics.avgWordCount, overallAvgWordCount),
        hashtagCountComparison: this.compareMetric(characteristics.avgHashtagCount, overallAvgHashtagCount),
        engagementRateComparison: this.compareMetric(characteristics.avgEngagementRate, overallAvgEngagementRate),
        clickThroughRateComparison: this.compareMetric(characteristics.avgClickThroughRate, overallAvgClickThroughRate)
      };

    } catch (error) {
      console.error('Error comparing with benchmarks:', error);
      return {
        wordCountComparison: { difference: 0, significance: 'none' },
        hashtagCountComparison: { difference: 0, significance: 'none' },
        engagementRateComparison: { difference: 0, significance: 'none' },
        clickThroughRateComparison: { difference: 0, significance: 'none' }
      };
    }
  }

  // Helper methods
  private generatePlatformInsights(platform: any, patternType: string): string[] {
    const insights: string[] = [];
    
    switch (patternType) {
      case 'high_performer':
        insights.push(`${platform.platform} is your top performing platform`);
        insights.push(`Consider increasing content volume on ${platform.platform}`);
        break;
      case 'consistent':
        insights.push(`${platform.platform} shows consistent performance`);
        insights.push(`Maintain current strategy on ${platform.platform}`);
        break;
      case 'variable':
        insights.push(`${platform.platform} shows variable performance - need more data`);
        insights.push(`Increase posting frequency on ${platform.platform} for better insights`);
        break;
      case 'underperformer':
        insights.push(`${platform.platform} is underperforming`);
        insights.push(`Review and optimize content strategy for ${platform.platform}`);
        break;
    }

    return insights;
  }

  private getContentTypeRecommendation(effectivenessScore: number, contentCount: number): string {
    if (effectivenessScore >= 0.08) {
      return 'Highly effective - create more of this content type';
    } else if (effectivenessScore >= 0.05) {
      return 'Moderately effective - maintain current volume';
    } else if (contentCount < 5) {
      return 'Insufficient data - create more to evaluate effectiveness';
    } else {
      return 'Low effectiveness - consider reducing or optimizing this content type';
    }
  }

  private analyzeDayOfWeekPatterns(performanceOverTime: any[]): any[] {
    // Group by day of week and calculate averages
    const dayGroups: { [key: number]: any[] } = {};
    
    performanceOverTime.forEach(item => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      if (!dayGroups[dayOfWeek]) {
        dayGroups[dayOfWeek] = [];
      }
      dayGroups[dayOfWeek].push(item);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return Object.entries(dayGroups).map(([day, items]) => ({
      dayOfWeek: parseInt(day),
      dayName: dayNames[parseInt(day)],
      avgEngagementRate: items.reduce((sum, item) => sum + (item.avgEngagementRate || 0), 0) / items.length,
      contentCount: items.reduce((sum, item) => sum + (item.count || 0), 0),
      effectiveness: this.categorizeDayEffectiveness(items.reduce((sum, item) => sum + (item.avgEngagementRate || 0), 0) / items.length)
    }));
  }

  private analyzePostingFrequency(performanceOverTime: any[]): any {
    if (performanceOverTime.length < 7) {
      return {
        avgPostsPerDay: 0,
        consistency: 'insufficient_data',
        recommendation: 'Post more frequently to establish patterns'
      };
    }

    const postsPerDay = performanceOverTime.map(item => item.count || 0);
    const avgPostsPerDay = postsPerDay.reduce((sum, count) => sum + count, 0) / postsPerDay.length;
    
    // Calculate consistency (coefficient of variation)
    const variance = postsPerDay.reduce((sum, count) => sum + Math.pow(count - avgPostsPerDay, 2), 0) / postsPerDay.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgPostsPerDay > 0 ? stdDev / avgPostsPerDay : 0;
    
    let consistency: string;
    if (coefficientOfVariation < 0.3) {
      consistency = 'high';
    } else if (coefficientOfVariation < 0.6) {
      consistency = 'medium';
    } else {
      consistency = 'low';
    }

    let recommendation: string;
    if (avgPostsPerDay < 0.5) {
      recommendation = 'Increase posting frequency for better engagement';
    } else if (avgPostsPerDay > 3) {
      recommendation = 'Consider reducing posting frequency to avoid audience fatigue';
    } else if (consistency === 'low') {
      recommendation = 'Maintain more consistent posting schedule';
    } else {
      recommendation = 'Current posting frequency is optimal';
    }

    return {
      avgPostsPerDay,
      consistency,
      recommendation
    };
  }

  private categorizeHourEffectiveness(avgEngagementRate: number): string {
    if (avgEngagementRate >= 0.1) return 'high';
    if (avgEngagementRate >= 0.05) return 'medium';
    return 'low';
  }

  private categorizeDayEffectiveness(avgEngagementRate: number): string {
    if (avgEngagementRate >= 0.08) return 'high';
    if (avgEngagementRate >= 0.04) return 'medium';
    return 'low';
  }

  private categorizeHashtagEffectiveness(usageCount: number): string {
    if (usageCount >= 10) return 'high';
    if (usageCount >= 5) return 'medium';
    return 'low';
  }

  private generateTemporalInsights(hourPatterns: any[], dayPatterns: any[], frequencyPattern: any): string[] {
    const insights: string[] = [];

    // Hour insights
    if (hourPatterns.length > 0) {
      const bestHour = hourPatterns[0];
      insights.push(`Your content performs best when posted at ${bestHour.hour}:00`);
    }

    // Day insights
    const bestDay = dayPatterns.reduce((best, current) => 
      current.avgEngagementRate > best.avgEngagementRate ? current : best, dayPatterns[0]);
    
    if (bestDay) {
      insights.push(`${bestDay.dayName} is your most effective posting day`);
    }

    // Frequency insights
    if (frequencyPattern.consistency === 'low') {
      insights.push('Your posting schedule is inconsistent - consider establishing a regular routine');
    }

    return insights;
  }

  private generateHashtagInsights(userHashtags: any[], trendingOpportunities: any[]): string[] {
    const insights: string[] = [];

    if (userHashtags.length > 0) {
      const topHashtag = userHashtags[0];
      insights.push(`#${topHashtag.hashtag} is your most effective hashtag`);
    }

    if (trendingOpportunities.length > 0) {
      insights.push(`${trendingOpportunities.length} trending hashtags could boost your reach`);
    }

    const lowEffectiveness = userHashtags.filter(h => h.effectiveness === 'low');
    if (lowEffectiveness.length > 0) {
      insights.push(`${lowEffectiveness.length} hashtags are underperforming and could be replaced`);
    }

    return insights;
  }

  private analyzeEngagementTypes(platformPerformance: any[]): any[] {
    return platformPerformance.map(platform => ({
      platform: platform.platform,
      engagementType: this.determineEngagementType(platform),
      strength: platform.avgEngagementRate >= 0.08 ? 'high' : 
                platform.avgEngagementRate >= 0.04 ? 'medium' : 'low'
    }));
  }

  private determineEngagementType(platform: any): string {
    const engagementRate = platform.avgEngagementRate || 0;
    const clickThroughRate = platform.avgClickThroughRate || 0;

    if (clickThroughRate > engagementRate * 0.5) {
      return 'action_oriented';
    } else if (engagementRate > 0.1) {
      return 'interaction_focused';
    } else {
      return 'awareness_building';
    }
  }

  private identifyEngagementPatterns(platformPerformance: any[], performanceDistribution: any[]): string[] {
    const patterns: string[] = [];

    // Platform concentration pattern
    if (platformPerformance.length > 1) {
      const topPlatform = platformPerformance[0];
      const totalEngagement = platformPerformance.reduce((sum, p) => sum + (p.totalEngagement || 0), 0);
      const topPlatformShare = totalEngagement > 0 ? (topPlatform.totalEngagement || 0) / totalEngagement : 0;

      if (topPlatformShare > 0.7) {
        patterns.push('platform_concentrated');
      } else if (topPlatformShare < 0.4) {
        patterns.push('platform_diversified');
      } else {
        patterns.push('platform_balanced');
      }
    }

    // Performance consistency pattern
    const highPerformanceCount = performanceDistribution.find(p => p.category === 'high')?.count || 0;
    const totalContent = performanceDistribution.reduce((sum, p) => sum + p.count, 0);
    const highPerformanceRate = totalContent > 0 ? highPerformanceCount / totalContent : 0;

    if (highPerformanceRate > 0.3) {
      patterns.push('consistently_high_performing');
    } else if (highPerformanceRate < 0.1) {
      patterns.push('improvement_needed');
    } else {
      patterns.push('mixed_performance');
    }

    return patterns;
  }

  private analyzeTrends(performanceOverTime: any[]): any {
    if (performanceOverTime.length < 3) {
      return {
        overall: 'insufficient_data',
        byPlatform: {},
        direction: 'unknown',
        strength: 'unknown'
      };
    }

    // Calculate overall trend using linear regression
    const trend = this.calculateLinearTrend(performanceOverTime.map((p, i) => ({
      x: i,
      y: p.avgEngagementRate || 0
    })));

    let direction: string;
    let strength: string;

    if (Math.abs(trend.slope) < 0.001) {
      direction = 'stable';
      strength = 'none';
    } else if (trend.slope > 0) {
      direction = 'improving';
      strength = trend.slope > 0.01 ? 'strong' : trend.slope > 0.005 ? 'moderate' : 'weak';
    } else {
      direction = 'declining';
      strength = trend.slope < -0.01 ? 'strong' : trend.slope < -0.005 ? 'moderate' : 'weak';
    }

    return {
      overall: direction,
      byPlatform: {}, // Could be expanded for platform-specific trends
      direction,
      strength,
      slope: trend.slope,
      correlation: trend.correlation
    };
  }

  private analyzeSeasonality(performanceOverTime: any[]): any {
    // Simple seasonality analysis - could be enhanced with more sophisticated methods
    if (performanceOverTime.length < 14) {
      return {
        weeklyPattern: 'insufficient_data',
        monthlyPattern: 'insufficient_data',
        insights: ['Need more data to identify seasonal patterns']
      };
    }

    // Analyze weekly patterns
    const weeklyData = this.groupByWeek(performanceOverTime);
    const weeklyVariation = this.calculateVariation(weeklyData);

    let weeklyPattern: string;
    if (weeklyVariation > 0.02) {
      weeklyPattern = 'strong_weekly_variation';
    } else if (weeklyVariation > 0.01) {
      weeklyPattern = 'moderate_weekly_variation';
    } else {
      weeklyPattern = 'stable_weekly_pattern';
    }

    return {
      weeklyPattern,
      monthlyPattern: 'insufficient_data', // Would need more data
      insights: this.generateSeasonalityInsights(weeklyPattern, weeklyVariation)
    };
  }

  private calculateMomentum(performanceOverTime: any[]): any {
    if (performanceOverTime.length < 5) {
      return {
        current: 'unknown',
        strength: 'unknown',
        direction: 'unknown'
      };
    }

    // Calculate momentum using recent vs. earlier performance
    const recentPeriod = performanceOverTime.slice(-Math.floor(performanceOverTime.length / 3));
    const earlierPeriod = performanceOverTime.slice(0, Math.floor(performanceOverTime.length / 3));

    const recentAvg = recentPeriod.reduce((sum, p) => sum + (p.avgEngagementRate || 0), 0) / recentPeriod.length;
    const earlierAvg = earlierPeriod.reduce((sum, p) => sum + (p.avgEngagementRate || 0), 0) / earlierPeriod.length;

    const momentumChange = recentAvg - earlierAvg;
    const momentumPercent = earlierAvg > 0 ? (momentumChange / earlierAvg) * 100 : 0;

    let direction: string;
    let strength: string;

    if (Math.abs(momentumPercent) < 5) {
      direction = 'stable';
      strength = 'none';
    } else if (momentumPercent > 0) {
      direction = 'positive';
      strength = momentumPercent > 20 ? 'strong' : momentumPercent > 10 ? 'moderate' : 'weak';
    } else {
      direction = 'negative';
      strength = momentumPercent < -20 ? 'strong' : momentumPercent < -10 ? 'moderate' : 'weak';
    }

    return {
      current: direction,
      strength,
      direction,
      changePercent: momentumPercent,
      recentAvg,
      earlierAvg
    };
  }

  private generateForecasts(performanceOverTime: any[], trends: any): any {
    if (performanceOverTime.length < 5 || trends.overall === 'insufficient_data') {
      return {
        shortTerm: 'insufficient_data',
        confidence: 'low',
        recommendations: ['Collect more data for accurate forecasting']
      };
    }

    // Simple linear projection
    const currentAvg = performanceOverTime.slice(-3).reduce((sum, p) => sum + (p.avgEngagementRate || 0), 0) / 3;
    const projectedChange = trends.slope * 7; // Project 7 days ahead
    const forecast = Math.max(0, currentAvg + projectedChange);

    let confidence: string;
    if (Math.abs(trends.correlation) > 0.7) {
      confidence = 'high';
    } else if (Math.abs(trends.correlation) > 0.4) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      shortTerm: forecast,
      confidence,
      trend: trends.direction,
      recommendations: this.generateForecastRecommendations(trends, forecast, currentAvg)
    };
  }

  // Utility methods
  private countOccurrences(items: string[]): { [key: string]: number } {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  private calculateDistribution(content: any[], field: string): { [key: string]: number } {
    const counts = this.countOccurrences(content.map(c => c[field]).filter(Boolean));
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(counts).reduce((acc, [key, count]) => {
      acc[key] = total > 0 ? count / total : 0;
      return acc;
    }, {} as { [key: string]: number });
  }

  private calculateTimeDistribution(content: any[]): { [key: string]: number } {
    const hours = content.map(c => {
      if (c.timestamp) {
        return new Date(c.timestamp).getHours();
      }
      return null;
    }).filter(h => h !== null);

    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as { [key: number]: number });

    const total = hours.length;
    return Object.entries(hourCounts).reduce((acc, [hour, count]) => {
      acc[`${hour}:00`] = total > 0 ? count / total : 0;
      return acc;
    }, {} as { [key: string]: number });
  }

  private compareMetric(value1: number, value2: number): { difference: number; significance: string } {
    const difference = value1 - value2;
    const percentDifference = value2 > 0 ? Math.abs(difference / value2) * 100 : 0;

    let significance: string;
    if (percentDifference > 50) {
      significance = 'high';
    } else if (percentDifference > 20) {
      significance = 'medium';
    } else if (percentDifference > 5) {
      significance = 'low';
    } else {
      significance = 'none';
    }

    return { difference, significance };
  }

  private calculateLinearTrend(points: { x: number; y: number }[]): { slope: number; correlation: number } {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumYY = points.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;

    return { slope: isNaN(slope) ? 0 : slope, correlation: isNaN(correlation) ? 0 : correlation };
  }

  private groupByWeek(performanceOverTime: any[]): number[] {
    // Group data by week and calculate weekly averages
    const weeks: { [key: string]: number[] } = {};
    
    performanceOverTime.forEach(item => {
      const date = new Date(item.date);
      const weekKey = this.getWeekKey(date);
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(item.avgEngagementRate || 0);
    });

    return Object.values(weeks).map(weekData => 
      weekData.reduce((sum, val) => sum + val, 0) / weekData.length
    );
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week}`;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private calculateVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private generateSeasonalityInsights(weeklyPattern: string, variation: number): string[] {
    const insights: string[] = [];

    switch (weeklyPattern) {
      case 'strong_weekly_variation':
        insights.push('Your content performance varies significantly by day of week');
        insights.push('Focus on posting during your highest-performing days');
        break;
      case 'moderate_weekly_variation':
        insights.push('Some days of the week perform better than others');
        insights.push('Consider adjusting your posting schedule based on daily performance');
        break;
      case 'stable_weekly_pattern':
        insights.push('Your content performs consistently throughout the week');
        insights.push('Current posting schedule is well-optimized');
        break;
    }

    return insights;
  }

  private generateForecastRecommendations(trends: any, forecast: number, current: number): string[] {
    const recommendations: string[] = [];

    if (trends.direction === 'improving') {
      recommendations.push('Continue current strategy - performance is trending upward');
      recommendations.push('Consider increasing content volume to capitalize on positive momentum');
    } else if (trends.direction === 'declining') {
      recommendations.push('Review and adjust content strategy - performance is declining');
      recommendations.push('Analyze recent changes that might be impacting performance');
    } else {
      recommendations.push('Performance is stable - maintain current approach');
      recommendations.push('Look for opportunities to test new strategies for growth');
    }

    return recommendations;
  }

  private generatePatternBasedRecommendations(insights: any, trendingPatterns: any): string[] {
    const recommendations: string[] = [];

    // Platform recommendations
    if (insights.platformPerformance.length > 0) {
      const bestPlatform = insights.platformPerformance[0];
      recommendations.push(`Focus more content on ${bestPlatform.platform} - your best performing platform`);
    }

    // Timing recommendations
    if (insights.bestPostingHours.length > 0) {
      const bestHour = insights.bestPostingHours[0];
      recommendations.push(`Post more content at ${bestHour.hour}:00 for optimal engagement`);
    }

    // Trending hashtag recommendations
    if (trendingPatterns.trendingHashtags.length > 0) {
      const topTrending = trendingPatterns.trendingHashtags[0];
      recommendations.push(`Consider using trending hashtag #${topTrending.hashtag}`);
    }

    return recommendations.slice(0, 5);
  }

  private generateContentInsights(characteristics: ContentCharacteristics, comparison: BenchmarkComparison): string[] {
    const insights: string[] = [];

    // Word count insights
    if (comparison.wordCountComparison.significance !== 'none') {
      const direction = comparison.wordCountComparison.difference > 0 ? 'longer' : 'shorter';
      insights.push(`High-performing content tends to be ${direction} than your average`);
    }

    // Hashtag insights
    if (comparison.hashtagCountComparison.significance !== 'none') {
      const direction = comparison.hashtagCountComparison.difference > 0 ? 'more' : 'fewer';
      insights.push(`Successful content uses ${direction} hashtags on average`);
    }

    // Engagement insights
    if (characteristics.commonHashtags.length > 0) {
      const topHashtag = characteristics.commonHashtags[0];
      insights.push(`#${topHashtag.hashtag} appears in ${topHashtag.count} high-performing posts`);
    }

    return insights;
  }

  private generateContentRecommendations(characteristics: ContentCharacteristics, insights: string[]): string[] {
    const recommendations: string[] = [];

    // Word count recommendations
    if (characteristics.avgWordCount > 0) {
      recommendations.push(`Aim for approximately ${Math.round(characteristics.avgWordCount)} words for optimal performance`);
    }

    // Hashtag recommendations
    if (characteristics.commonHashtags.length > 0) {
      const topHashtags = characteristics.commonHashtags.slice(0, 3);
      recommendations.push(`Use these high-performing hashtags: ${topHashtags.map(h => `#${h.hashtag}`).join(', ')}`);
    }

    // Platform recommendations
    const topPlatform = Object.entries(characteristics.platformDistribution)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topPlatform) {
      recommendations.push(`${topPlatform[0]} generates ${Math.round(topPlatform[1] * 100)}% of your high-performing content`);
    }

    return recommendations.slice(0, 5);
  }

  private generateTrendInsights(trends: any, seasonality: any, momentum: any, trendingPatterns: any): string[] {
    const insights: string[] = [];

    // Overall trend insights
    if (trends.direction === 'improving') {
      insights.push(`Your content performance is ${trends.strength} improving over time`);
    } else if (trends.direction === 'declining') {
      insights.push(`Your content performance is ${trends.strength} declining - review recent changes`);
    } else {
      insights.push('Your content performance is stable over time');
    }

    // Momentum insights
    if (momentum.direction === 'positive') {
      insights.push(`Recent momentum is ${momentum.strength} positive - ${momentum.changePercent.toFixed(1)}% improvement`);
    } else if (momentum.direction === 'negative') {
      insights.push(`Recent momentum is ${momentum.strength} negative - ${Math.abs(momentum.changePercent).toFixed(1)}% decline`);
    }

    // Seasonality insights
    if (seasonality.weeklyPattern !== 'insufficient_data') {
      insights.push(`Your content shows ${seasonality.weeklyPattern.replace('_', ' ')}`);
    }

    return insights;
  }

  private generateTrendRecommendations(trends: any, seasonality: any, trendingPatterns: any): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    if (trends.direction === 'declining') {
      recommendations.push('Analyze recent content changes and revert to previous successful strategies');
      recommendations.push('Consider A/B testing different content approaches');
    } else if (trends.direction === 'improving') {
      recommendations.push('Continue current strategy and consider scaling successful content types');
    }

    // Seasonality recommendations
    if (seasonality.weeklyPattern === 'strong_weekly_variation') {
      recommendations.push('Optimize posting schedule based on day-of-week performance patterns');
    }

    // Trending topic recommendations
    if (trendingPatterns.trendingHashtags.length > 0) {
      const topTrending = trendingPatterns.trendingHashtags.slice(0, 3);
      recommendations.push(`Leverage trending topics: ${topTrending.map((h: any) => `#${h.hashtag}`).join(', ')}`);
    }

    return recommendations.slice(0, 5);
  }
}

// Types and interfaces
export interface PatternAnalysisOptions {
  dateFrom?: string;
  dateTo?: string;
  platform?: Platform;
  timeInterval?: string;
}

export interface ContentAnalysisOptions {
  dateFrom?: string;
  dateTo?: string;
  platform?: Platform;
  contentType?: string;
  minEngagementRate?: number;
  minClickThroughRate?: number;
}

export interface TrendAnalysisOptions {
  dateFrom?: string;
  dateTo?: string;
  platform?: Platform;
  timeInterval?: string;
}

export interface PerformancePatterns {
  userId: string;
  analysisDate: string;
  timeRange: {
    from: string | null;
    to: string | null;
  };
  platformPatterns: PlatformPattern[];
  contentTypePatterns: ContentTypePattern[];
  temporalPatterns: TemporalPattern;
  hashtagPatterns: HashtagPattern;
  engagementPatterns: EngagementPattern;
  successFactors: SuccessFactor[];
  recommendations: string[];
}

export interface PlatformPattern {
  platform: string;
  contentCount: number;
  avgEngagementRate: number;
  avgClickThroughRate: number;
  performanceScore: number;
  patternType: 'high_performer' | 'consistent' | 'variable' | 'underperformer';
  insights: string[];
}

export interface ContentTypePattern {
  contentType: string;
  contentCount: number;
  avgEngagementRate: number;
  avgClickThroughRate: number;
  effectivenessScore: number;
  recommendation: string;
}

export interface TemporalPattern {
  bestHours: Array<{
    hour: number;
    avgEngagementRate: number;
    contentCount: number;
    effectiveness: string;
  }>;
  dayOfWeekPatterns: Array<{
    dayOfWeek: number;
    dayName: string;
    avgEngagementRate: number;
    contentCount: number;
    effectiveness: string;
  }>;
  postingFrequency: {
    avgPostsPerDay: number;
    consistency: string;
    recommendation: string;
  };
  insights: string[];
}

export interface HashtagPattern {
  topPerformingHashtags: Array<{
    hashtag: string;
    usageCount: number;
    effectiveness: string;
  }>;
  underutilizedHashtags: Array<{
    hashtag: string;
    usageCount: number;
    effectiveness: string;
  }>;
  trendingOpportunities: Array<{
    hashtag: string;
    trendScore: number;
    avgEngagement: number;
    opportunity: string;
  }>;
  insights: string[];
}

export interface EngagementPattern {
  avgEngagementRate: number;
  consistency: string;
  highPerformanceRate: number;
  engagementTypes: Array<{
    platform: string;
    engagementType: string;
    strength: string;
  }>;
  patterns: string[];
}

export interface SuccessFactor {
  type: 'platform' | 'timing' | 'hashtag' | 'content_type' | 'length' | 'style';
  factor: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  description: string;
  recommendation: string;
}

export interface SuccessfulContentAnalysis {
  userId: string;
  analysisDate: string;
  criteria: {
    minEngagementRate: number;
    minClickThroughRate: number;
    platform: string | null;
    contentType: string | null;
  };
  highPerformingContent: any[];
  characteristics: ContentCharacteristics;
  benchmarkComparison: BenchmarkComparison;
  insights: string[];
  recommendations: string[];
}

export interface ContentCharacteristics {
  avgWordCount: number;
  commonHashtags: Array<{ hashtag: string; count: number }>;
  avgHashtagCount: number;
  commonKeywords: Array<{ keyword: string; count: number }>;
  avgEngagementRate: number;
  avgClickThroughRate: number;
  platformDistribution: { [platform: string]: number };
  contentTypeDistribution: { [contentType: string]: number };
  postingTimeDistribution: { [hour: string]: number };
}

export interface BenchmarkComparison {
  wordCountComparison: { difference: number; significance: string };
  hashtagCountComparison: { difference: number; significance: string };
  engagementRateComparison: { difference: number; significance: string };
  clickThroughRateComparison: { difference: number; significance: string };
}

export interface TrendAnalysis {
  userId: string;
  analysisDate: string;
  timeRange: {
    from: string | null;
    to: string | null;
    interval: string;
  };
  overallTrend: string;
  platformTrends: any;
  seasonalPatterns: any;
  momentum: any;
  forecasts: any;
  trendingTopics: any[];
  insights: string[];
  recommendations: string[];
}

// Export singleton instance
export const patternRecognitionService = new PatternRecognitionService();