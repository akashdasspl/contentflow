import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { SocialMediaContentGenerator } from "./src/services/content-generators";

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Root route
app.get("/", (req, res) => {
  return res.send("✅ Backend running");
});

const generator = new SocialMediaContentGenerator();

app.post("/generate", async (req, res) => {
  try {
    const { userId, contentIdea, platform, intent } = req.body;

    if (!contentIdea || !platform || !intent) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const result = await generator.generateSocialPost({
      userId: userId || "test-user",
      contentIdea,
      platform,
      intent,
    });

    return res.json({ success: true, data: result }); // ✅ RETURN added
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message }); // ✅ RETURN added
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});