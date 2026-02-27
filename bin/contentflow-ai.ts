#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ContentFlowAiStack } from '../lib/contentflow-ai-stack';

const app = new cdk.App();

new ContentFlowAiStack(app, 'ContentFlowAiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'ContentFlow AI - AI-driven content generation platform',
});

app.synth();