import {
  createResponse,
  createSuccessResponse,
  createErrorResponse,
  validateRequired,
  validateEmail,
  validateContentLength,
  validatePlatform,
  validateContentType,
  validateContentIntent,
  generateId,
  generateUserId,
  extractKeywords,
  calculateReadingTime,
  truncateText,
  getPlatformConstraints,
  isValidDateRange,
} from '../src/utils';

describe('Utility Functions', () => {
  describe('API Response Helpers', () => {
    test('createResponse creates proper API Gateway response', () => {
      const response = createResponse(200, { message: 'success' });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(JSON.parse(response.body)).toEqual({ message: 'success' });
    });

    test('createSuccessResponse creates success response', () => {
      const data = { id: '123', name: 'test' };
      const response = createSuccessResponse(data);
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data,
      });
    });

    test('createErrorResponse creates error response', () => {
      const response = createErrorResponse('Something went wrong', 400);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Something went wrong');
      expect(body.error.timestamp).toBeDefined();
    });
  });

  describe('Validation Functions', () => {
    test('validateRequired identifies missing fields', () => {
      const obj = { name: 'John', email: '' };
      const errors = validateRequired(obj, ['name', 'email', 'age']);
      
      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('email');
      expect(errors[1].field).toBe('age');
    });

    test('validateEmail validates email format', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    test('validateContentLength validates content length', () => {
      expect(validateContentLength('short content')).toBe(true);
      expect(validateContentLength('a'.repeat(500))).toBe(true);
      expect(validateContentLength('a'.repeat(501))).toBe(false);
      expect(validateContentLength('a'.repeat(100), 50)).toBe(false);
    });

    test('validatePlatform validates platform names', () => {
      expect(validatePlatform('blog')).toBe(true);
      expect(validatePlatform('twitter')).toBe(true);
      expect(validatePlatform('facebook')).toBe(true);
      expect(validatePlatform('invalid-platform')).toBe(false);
    });

    test('validateContentType validates content types', () => {
      expect(validateContentType('blog-post')).toBe(true);
      expect(validateContentType('social-post')).toBe(true);
      expect(validateContentType('caption')).toBe(true);
      expect(validateContentType('invalid-type')).toBe(false);
    });

    test('validateContentIntent validates content intents', () => {
      expect(validateContentIntent('informational')).toBe(true);
      expect(validateContentIntent('promotional')).toBe(true);
      expect(validateContentIntent('educational')).toBe(true);
      expect(validateContentIntent('entertainment')).toBe(true);
      expect(validateContentIntent('invalid-intent')).toBe(false);
    });
  });

  describe('ID Generation', () => {
    test('generateId creates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });

    test('generateId with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_/);
    });

    test('generateUserId creates user ID with prefix', () => {
      const userId = generateUserId();
      expect(userId).toMatch(/^user_/);
    });
  });

  describe('Content Processing Helpers', () => {
    test('extractKeywords extracts relevant keywords', () => {
      const text = 'This is a sample text about artificial intelligence and machine learning';
      const keywords = extractKeywords(text);
      
      expect(keywords).toContain('sample');
      expect(keywords).toContain('text');
      expect(keywords).toContain('artificial');
      expect(keywords).toContain('intelligence');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    test('calculateReadingTime calculates reading time', () => {
      const text = 'word '.repeat(199) + 'word'; // 200 words exactly
      const readingTime = calculateReadingTime(text);
      
      expect(readingTime).toBe(1); // 200 words / 200 wpm = 1 minute
    });

    test('calculateReadingTime with custom WPM', () => {
      const text = 'word '.repeat(299) + 'word'; // 300 words exactly
      const readingTime = calculateReadingTime(text, 100);
      
      expect(readingTime).toBe(3); // 300 words / 100 wpm = 3 minutes
    });

    test('truncateText truncates long text', () => {
      const longText = 'This is a very long text that should be truncated';
      const truncated = truncateText(longText, 20);
      
      expect(truncated).toBe('This is a very lo...');
      expect(truncated.length).toBe(20);
    });

    test('truncateText does not truncate short text', () => {
      const shortText = 'Short text';
      const result = truncateText(shortText, 20);
      
      expect(result).toBe(shortText);
    });
  });

  describe('Platform Constraints', () => {
    test('getPlatformConstraints returns Twitter constraints', () => {
      const constraints = getPlatformConstraints('twitter');
      
      expect(constraints.maxLength).toBe(280);
      expect(constraints.hashtagLimit).toBe(2);
      expect(constraints.mentionLimit).toBe(10);
    });

    test('getPlatformConstraints returns blog constraints', () => {
      const constraints = getPlatformConstraints('blog');
      
      expect(constraints.minLength).toBe(800);
      expect(constraints.maxLength).toBe(2000);
      expect(constraints.optimalLength).toBe(1200);
    });

    test('getPlatformConstraints returns empty for unknown platform', () => {
      const constraints = getPlatformConstraints('unknown');
      
      expect(constraints).toEqual({});
    });
  });

  describe('Date Validation', () => {
    test('isValidDateRange validates date ranges', () => {
      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      expect(isValidDateRange(yesterday, today)).toBe(true);
      expect(isValidDateRange(today, yesterday)).toBe(false);
      expect(isValidDateRange(today, tomorrow)).toBe(true); // Future end date allowed if start is not in future
    });
  });
});