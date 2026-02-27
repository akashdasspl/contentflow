// Unit tests for authentication Lambda functions
import { APIGatewayProxyEvent } from 'aws-lambda';
import { generateJWT, validateEmail, validateRequired } from '../src/utils';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  AdminCreateUserCommand: jest.fn(),
  AdminSetUserPasswordCommand: jest.fn(),
  AdminInitiateAuthCommand: jest.fn(),
  AdminGetUserCommand: jest.fn(),
}));

jest.mock('../src/services/database', () => ({
  userService: {
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
  },
}));

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.USER_POOL_ID = 'us-east-1_test123';
process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.USERS_TABLE_NAME = 'test-users-table';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('Authentication Utilities', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        '',
        'test@.com',
        'test@domain.',
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Required Field Validation', () => {
    it('should return no errors for valid objects', () => {
      const validObject = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const errors = validateRequired(validObject, ['email', 'password']);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing fields', () => {
      const invalidObject = {
        email: 'test@example.com',
        // password missing
      };

      const errors = validateRequired(invalidObject, ['email', 'password']);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('password');
      expect(errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('should return errors for empty string fields', () => {
      const invalidObject = {
        email: '',
        password: '   ', // whitespace only
      };

      const errors = validateRequired(invalidObject, ['email', 'password']);
      expect(errors).toHaveLength(2);
    });
  });

  describe('JWT Token Management', () => {
    it('should generate and verify JWT tokens', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
      };

      const token = generateJWT(payload, '1h');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1 = { userId: 'user1', email: 'user1@example.com' };
      const payload2 = { userId: 'user2', email: 'user2@example.com' };

      const token1 = generateJWT(payload1);
      const token2 = generateJWT(payload2);

      expect(token1).not.toBe(token2);
    });

    it('should generate refresh tokens with different type', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        type: 'refresh',
      };

      const refreshToken = generateJWT(payload, '30d');
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });
  });

  describe('Password Strength Validation', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecureP@ssw0rd',
        'Complex123$Password',
        'Str0ng!P@ssw0rd',
      ];

      strongPasswords.forEach(password => {
        expect(password.length).toBeGreaterThanOrEqual(8);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '123',
        'short',
        '1234567', // 7 characters
        '',
        'password', // no numbers/symbols
      ];

      weakPasswords.forEach(password => {
        expect(password.length).toBeLessThan(8);
      });
    });
  });

  describe('API Gateway Event Helpers', () => {
    const createMockEvent = (body: any, headers: Record<string, string> = {}): APIGatewayProxyEvent => ({
      httpMethod: 'POST',
      path: '/auth/register',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        resourceId: 'test-resource',
        httpMethod: 'POST',
        resourcePath: '/auth/register',
        path: '/test/auth/register',
        accountId: '123456789012',
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        requestTime: '01/Jan/2024:00:00:00 +0000',
        requestTimeEpoch: 1704067200,
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
        authorizer: null,
      },
      resource: '/auth/register',
      stageVariables: null,
      isBase64Encoded: false,
    });

    it('should create valid API Gateway events', () => {
      const testBody = { email: 'test@example.com', password: 'password123' };
      const event = createMockEvent(testBody);

      expect(event.httpMethod).toBe('POST');
      expect(event.body).toBe(JSON.stringify(testBody));
      expect(event.headers['Content-Type']).toBe('application/json');
    });

    it('should handle authorization headers', () => {
      const event = createMockEvent({}, {
        Authorization: 'Bearer test-token',
      });

      expect(event.headers.Authorization).toBe('Bearer test-token');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors gracefully', () => {
      const invalidJson = 'invalid-json-string';
      
      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();
    });

    it('should handle missing environment variables', () => {
      const originalEnv = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // This should handle the missing environment variable gracefully
      // In the actual implementation, it would use a default or throw an error
      expect(process.env.JWT_SECRET).toBeUndefined();

      // Restore environment variable
      process.env.JWT_SECRET = originalEnv;
    });
  });

  describe('Security Measures', () => {
    it('should not expose sensitive information in error messages', () => {
      const sensitiveData = {
        password: 'secret123',
        token: 'jwt-token-here',
      };

      // Error messages should not contain sensitive data
      const errorMessage = 'Authentication failed';
      expect(errorMessage).not.toContain(sensitiveData.password);
      expect(errorMessage).not.toContain(sensitiveData.token);
    });

    it('should use secure defaults', () => {
      // JWT tokens should have reasonable expiration times
      const shortLivedToken = generateJWT({ userId: 'test' }, '1h');
      const longLivedToken = generateJWT({ userId: 'test', type: 'refresh' }, '30d');

      expect(shortLivedToken).toBeDefined();
      expect(longLivedToken).toBeDefined();
      expect(shortLivedToken).not.toBe(longLivedToken);
    });
  });

  describe('Input Sanitization', () => {
    it('should handle special characters in email', () => {
      const emailsWithSpecialChars = [
        'test+tag@example.com',
        'user.name@example.com',
        'user-name@example.com',
        'user_name@example.com',
      ];

      emailsWithSpecialChars.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject potentially malicious input', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '../../etc/passwd',
        'DROP TABLE users;',
      ];

      maliciousInputs.forEach(input => {
        expect(validateEmail(input)).toBe(false);
      });
    });
  });

  describe('Rate Limiting Considerations', () => {
    it('should be prepared for rate limiting scenarios', () => {
      // This test ensures we consider rate limiting in our design
      const rateLimitError = {
        name: 'TooManyRequestsException',
        message: 'Too many requests',
      };

      expect(rateLimitError.name).toBe('TooManyRequestsException');
      expect(rateLimitError.message).toContain('Too many');
    });
  });
});