// Real AI server using AWS Bedrock
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1"
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "✅ Bedrock AI Server running" });
});

// Generate content using AWS Bedrock
app.post("/generate", async (req, res) => {
  try {
    const { userId, contentIdea, platform, intent } = req.body;

    if (!contentIdea || !platform || !intent) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: contentIdea, platform, intent",
      });
    }

    console.log(`Generating ${intent} content for ${platform}: "${contentIdea}"`);

    // Create platform-specific prompt
    const prompt = createPrompt(contentIdea, platform, intent);

    // Call AWS Bedrock - try multiple models in order of preference
    const models = [
      "anthropic.claude-3-sonnet-20240229-v1:0",
      "anthropic.claude-3-haiku-20240307-v1:0",
      "anthropic.claude-v2:1",
      "anthropic.claude-v2"
    ];
    
    const modelId = process.env.BEDROCK_TEXT_GENERATION_MODEL || models[0];
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const generatedContent = responseBody.content[0].text;

    console.log("✅ Content generated successfully");

    return res.json({
      success: true,
      data: {
        contentId: `content-${Date.now()}`,
        userId: userId || "test-user",
        platform,
        intent,
        content: generatedContent,
        metadata: {
          wordCount: generatedContent.split(" ").length,
          characterCount: generatedContent.length,
          generatedAt: new Date().toISOString(),
          model: modelId
        },
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    
    let errorMessage = error.message || "Failed to generate content";
    
    // Provide helpful error messages
    if (error.message && error.message.includes("on-demand throughput")) {
      errorMessage = "Model access not enabled. Please enable model access in AWS Bedrock console or use a different model.";
    } else if (error.message && error.message.includes("AccessDeniedException")) {
      errorMessage = "AWS credentials don't have permission to access Bedrock. Please check IAM permissions.";
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

function createPrompt(idea, platform, intent) {
  const platformSpecs = {
    linkedin: {
      maxLength: "1300 characters",
      style: "professional and engaging",
      features: "Use emojis sparingly, include relevant hashtags (3-5), add a call-to-action"
    },
    twitter: {
      maxLength: "280 characters",
      style: "concise and impactful",
      features: "Use 1-2 relevant hashtags, make it shareable"
    },
    instagram: {
      maxLength: "2200 characters",
      style: "visual and engaging",
      features: "Use emojis, include 5-10 relevant hashtags, encourage engagement"
    }
  };

  const spec = platformSpecs[platform] || platformSpecs.linkedin;
  
  const intentGuidance = intent === "promotional" 
    ? "Focus on promoting and highlighting benefits. Create excitement and urgency."
    : "Focus on educating and providing value. Explain concepts clearly and provide actionable insights.";

  return `You are a professional social media content creator. Create ${intent} content for ${platform} about: "${idea}"

Platform: ${platform}
Content Type: ${intent}
Maximum Length: ${spec.maxLength}
Style: ${spec.style}

Requirements:
- ${intentGuidance}
- ${spec.features}
- Make it engaging and authentic
- Use appropriate tone for ${platform}
- Keep within ${spec.maxLength}

Generate the content now (only the post content, no explanations):`;
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🤖 ContentFlow AI - Bedrock Server   ║
╚════════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
✅ Using AWS Bedrock for AI generation
✅ Model: ${process.env.BEDROCK_TEXT_GENERATION_MODEL || "claude-3-5-haiku"}
✅ Region: ${process.env.AWS_REGION || "us-east-1"}

Ready to generate real AI content! 🎉
  `);
});
