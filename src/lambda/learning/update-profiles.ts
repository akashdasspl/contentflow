// Lambda function for updating learning profiles (triggered by feedback events)

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { learningIntegrationService } from '../../services/learning-integration';
import { EngagementFeedback } from '../../types';
import { logError, logInfo } from '../../utils';

export const handler = async (event: SQSEvent): Promise<void> => {
  try {
    logInfo('Learning profile update triggered', {
      recordCount: event.Records.length,
    });

    // Process each SQS record
    for (const record of event.Records) {
      await processRecord(record);
    }

    logInfo('Learning profile updates completed', {
      processedRecords: event.Records.length,
    });

  } catch (error) {
    logError('Failed to update learning profiles', error);
    throw error; // Re-throw to trigger SQS retry mechanism
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  try {
    // Parse the feedback data from SQS message
    const messageBody = JSON.parse(record.body);
    
    // Handle different message types
    if (messageBody.eventType === 'feedback-submitted') {
      const feedback: EngagementFeedback = messageBody.data;
      
      logInfo('Processing feedback for learning profile update', {
        userId: feedback.userId,
        contentId: feedback.contentId,
        platform: feedback.platform,
      });

      // Update learning profiles with new feedback
      await learningIntegrationService.updateLearningProfiles(feedback);
      
      logInfo('Learning profiles updated successfully', {
        userId: feedback.userId,
        contentId: feedback.contentId,
      });
    } else {
      logInfo('Skipping unknown message type', {
        eventType: messageBody.eventType,
        messageId: record.messageId,
      });
    }

  } catch (error) {
    logError('Failed to process SQS record', error, {
      messageId: record.messageId,
      receiptHandle: record.receiptHandle,
    });
    throw error;
  }
}