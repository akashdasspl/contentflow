// Test AWS Bedrock Connection
require('dotenv').config();
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

async function testBedrockConnection() {
  console.log("🔍 Testing AWS Bedrock Connection...\n");
  
  // Check environment variables
  console.log("📋 Configuration:");
  console.log(`   Region: ${process.env.AWS_REGION || "us-east-1"}`);
  console.log(`   Model: ${process.env.BEDROCK_TEXT_GENERATION_MODEL || "anthropic.claude-3-sonnet-20240229-v1:0"}`);
  console.log(`   AWS Access Key: ${process.env.AWS_ACCESS_KEY_ID ? "✅ Set" : "❌ Missing"}`);
  console.log(`   AWS Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? "✅ Set" : "❌ Missing"}`);
  console.log();

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log("❌ ERROR: AWS credentials not found in .env file");
    console.log("\n📝 Add these to your .env file:");
    console.log("   AWS_ACCESS_KEY_ID=your_access_key_here");
    console.log("   AWS_SECRET_ACCESS_KEY=your_secret_key_here");
    console.log("\n💡 Get credentials from: AWS Console → IAM → Users → Your User → Security Credentials");
    return;
  }

  try {
    console.log("🚀 Attempting to connect to AWS Bedrock...");
    
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1"
    });

    const modelId = process.env.BEDROCK_TEXT_GENERATION_MODEL || "anthropic.claude-3-sonnet-20240229-v1:0";
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: "Say 'Hello, Bedrock is working!' in one sentence."
          }
        ]
      })
    });

    console.log(`📡 Invoking model: ${modelId}...`);
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log("\n✅ SUCCESS! Bedrock is working!");
    console.log(`\n🤖 Response: ${responseBody.content[0].text}`);
    console.log("\n🎉 Your AWS Bedrock setup is complete and working!");
    
  } catch (error) {
    console.log("\n❌ ERROR: Failed to connect to Bedrock");
    console.log(`\n📋 Error Details: ${error.message}`);
    
    if (error.message.includes("AccessDeniedException")) {
      console.log("\n🔧 Fix: Your IAM user needs these permissions:");
      console.log("   - bedrock:InvokeModel");
      console.log("   - bedrock:InvokeModelWithResponseStream");
      console.log("\n💡 Go to: AWS Console → IAM → Users → Your User → Add Permissions");
    } else if (error.message.includes("on-demand throughput") || error.message.includes("model access")) {
      console.log("\n🔧 Fix: Model access not enabled");
      console.log("   The model will auto-enable on first use, but you may need to:");
      console.log("   1. Wait a few minutes and try again");
      console.log("   2. Try a different model (e.g., claude-3-haiku)");
      console.log("   3. Check AWS Bedrock console for model availability in your region");
    } else if (error.message.includes("credentials")) {
      console.log("\n🔧 Fix: Check your AWS credentials");
      console.log("   - Verify AWS_ACCESS_KEY_ID is correct");
      console.log("   - Verify AWS_SECRET_ACCESS_KEY is correct");
      console.log("   - Make sure credentials are not expired");
    }
  }
}

testBedrockConnection();
