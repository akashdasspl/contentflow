// Auto-retry Bedrock connection test
require('dotenv').config();
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

let attempts = 0;
const maxAttempts = 30; // Try for 30 minutes

async function testConnection() {
  attempts++;
  console.log(`\n[Attempt ${attempts}/${maxAttempts}] Testing Bedrock connection...`);
  
  try {
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1"
    });

    const modelId = process.env.BEDROCK_TEXT_GENERATION_MODEL || "anthropic.claude-3-haiku-20240307-v1:0";
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 50,
        messages: [{ role: "user", content: "Say hello!" }]
      })
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log("\n✅ SUCCESS! Payment verified and Bedrock is working!");
    console.log(`🤖 Response: ${responseBody.content[0].text}`);
    console.log("\n🎉 You can now use AWS Bedrock!");
    process.exit(0);
    
  } catch (error) {
    if (error.message.includes("INVALID_PAYMENT_INSTRUMENT")) {
      console.log("⏳ Payment still being verified... waiting 60 seconds");
      
      if (attempts >= maxAttempts) {
        console.log("\n❌ Timeout: Payment verification taking longer than expected");
        console.log("💡 Try manually in a few hours or contact AWS support");
        process.exit(1);
      }
      
      setTimeout(testConnection, 60000); // Try again in 60 seconds
    } else {
      console.log(`\n❌ Different error: ${error.message}`);
      process.exit(1);
    }
  }
}

console.log("🔄 Starting auto-retry test...");
console.log("⏰ Will check every 60 seconds for up to 30 minutes");
console.log("💡 Press Ctrl+C to stop\n");

testConnection();
