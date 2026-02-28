// Simple prototype server for ContentFlow AI
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "✅ Backend running" });
});

// Mock content generation endpoint
app.post("/generate", async (req, res) => {
  try {
    const { userId, contentIdea, platform, intent } = req.body;

    if (!contentIdea || !platform || !intent) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: contentIdea, platform, intent",
      });
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock content based on platform
    const mockContent = generateMockContent(contentIdea, platform, intent);

    return res.json({
      success: true,
      data: {
        contentId: `content-${Date.now()}`,
        userId: userId || "test-user",
        platform,
        intent,
        content: mockContent,
        metadata: {
          wordCount: mockContent.split(" ").length,
          characterCount: mockContent.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

function generateMockContent(idea, platform, intent) {
  const templates = {
    linkedin: {
      promotional: `🚀 Exciting News About ${idea}!

I'm thrilled to share insights about ${idea} that could transform how you work.

Here's what makes this important:
✅ Innovation at its core
✅ Real-world applications
✅ Measurable impact

${idea} is reshaping our industry, and I believe it's time we all pay attention.

What are your thoughts on ${idea}? Let's discuss in the comments!

#Innovation #${idea.replace(/\s+/g, '')} #ProfessionalDevelopment`,
      
      educational: `📚 Understanding ${idea}: A Quick Guide

Let me break down ${idea} for you in simple terms.

What is ${idea}?
${idea} represents a significant development in our field that's worth understanding.

Key Takeaways:
1️⃣ Core concepts and fundamentals
2️⃣ Practical applications
3️⃣ Future implications

Why does this matter?
Understanding ${idea} helps you stay ahead in today's fast-paced environment.

Want to learn more? Drop a comment below!

#Learning #${idea.replace(/\s+/g, '')} #Education`,
    },
    
    twitter: {
      promotional: `🔥 Big news about ${idea}!

This is a game-changer for everyone in the space. Here's why you should care 👇

${idea} is revolutionizing how we think about innovation.

Ready to dive in? Let's go! 🚀

#${idea.replace(/\s+/g, '')} #Innovation`,
      
      educational: `📖 Quick thread on ${idea}:

1/ What is ${idea}? It's an important concept that's gaining traction

2/ Why it matters: Understanding ${idea} gives you a competitive edge

3/ How to apply it: Start by learning the fundamentals

Want more insights? Follow for daily tips! 💡

#${idea.replace(/\s+/g, '')}`,
    },
    
    instagram: {
      promotional: `✨ Discover ${idea} ✨

Swipe to learn why ${idea} is the next big thing! 👉

💫 Transform your approach
🎯 Achieve better results
🚀 Stay ahead of the curve

${idea} is here to change the game. Are you ready?

Tag someone who needs to see this! 👇

#${idea.replace(/\s+/g, '')} #Innovation #Trending #MustKnow`,
      
      educational: `📚 Let's talk about ${idea} 📚

Here's what you need to know:

🔹 ${idea} explained simply
🔹 Why it's important
🔹 How you can use it

Understanding ${idea} is easier than you think! Swipe for more insights ➡️

Save this post for later! 💾

#Education #${idea.replace(/\s+/g, '')} #Learning #Knowledge #Tips`,
    },
    
    facebook: {
      promotional: `🎉 Exciting Update About ${idea}! 🎉

Friends, I have to share this with you because ${idea} is absolutely transforming the way we approach things!

Here's why you should care:
👉 It's innovative and practical
👉 Real results you can see
👉 Perfect timing for everyone

${idea} isn't just a trend - it's the future. And I want YOU to be part of it!

Drop a 🔥 if you're interested in learning more!
Share this with someone who needs to see it!

#${idea.replace(/\s+/g, '')} #Innovation #Community #MustSee`,
      
      educational: `📖 Let's Learn About ${idea} Together! 📖

Hey everyone! Today I want to break down ${idea} in a way that's easy to understand.

What is ${idea}?
Simply put, ${idea} is changing how we think about our daily lives and work.

Why should you care?
✨ It's relevant to everyone
✨ Easy to implement
✨ Proven results

Key Points:
1. Understanding the basics
2. How it applies to you
3. Steps to get started

Have questions? Drop them in the comments! I'm here to help 💬

#${idea.replace(/\s+/g, '')} #Learning #Education #Community`,
    },
    
    youtube: {
      promotional: `🎬 ${idea} - The Game Changer You NEED to Know About!

Hey everyone! Welcome back to the channel! Today we're diving into something HUGE - ${idea}!

In this video, you'll discover:
✅ Why ${idea} is taking over
✅ How it can benefit YOU
✅ Real-world success stories
✅ How to get started TODAY

${idea} has been a complete game-changer, and I'm so excited to share this with you!

🔔 Don't forget to SUBSCRIBE and hit that notification bell!
👍 LIKE this video if you find it helpful!
💬 COMMENT below with your thoughts!

Timestamps:
0:00 - Introduction
0:45 - What is ${idea}?
2:30 - Why it matters
4:15 - How to get started
6:00 - Final thoughts

#${idea.replace(/\s+/g, '')} #Tutorial #HowTo #MustWatch`,
      
      educational: `📚 ${idea} Explained - Complete Beginner's Guide

Welcome to today's educational video! We're breaking down ${idea} in the most comprehensive way possible.

What You'll Learn:
📌 The fundamentals of ${idea}
📌 Step-by-step explanations
📌 Common mistakes to avoid
📌 Pro tips and best practices

This is perfect for beginners and anyone looking to deepen their understanding of ${idea}.

🎓 Resources mentioned in this video are in the description!
📝 Download the FREE guide: [link in description]
💡 Got questions? Drop them in the comments!

Don't forget to:
👍 LIKE if this helped you
🔔 SUBSCRIBE for more educational content
📢 SHARE with someone who needs this

#${idea.replace(/\s+/g, '')} #Education #Tutorial #LearnWithMe`,
    },
    
    tiktok: {
      promotional: `🔥 ${idea} is BLOWING UP right now! 🔥

Here's why everyone's talking about it:

✨ It's revolutionary
✨ Super easy to use
✨ Results are INSANE

I tried ${idea} and I'm OBSESSED! 😍

Who else is trying this? Drop a 🙋 in the comments!

Follow for more tips! 🚀

#${idea.replace(/\s+/g, '')} #Trending #Viral #MustTry #FYP #ForYou`,
      
      educational: `📚 Let me explain ${idea} in 60 seconds! ⏰

What is ${idea}? 🤔
→ [Quick explanation]

Why it matters: 💡
→ Changes everything
→ Easy to understand
→ You need to know this

How to use it: ✅
→ Step 1: Start here
→ Step 2: Do this
→ Step 3: See results!

Save this for later! 📌
Follow for more quick lessons! 🎓

#${idea.replace(/\s+/g, '')} #LearnOnTikTok #Education #Tutorial #QuickTips #FYP`,
    },
    
    blog: {
      promotional: `# Discover ${idea}: The Innovation That's Changing Everything

## Introduction

In today's fast-paced world, ${idea} has emerged as a revolutionary force that's transforming how we approach challenges and opportunities. If you haven't heard about ${idea} yet, you're about to discover something that could change your perspective entirely.

## What Makes ${idea} Special?

${idea} isn't just another trend—it's a fundamental shift in how we think and operate. Here's what sets it apart:

- **Innovation at its core**: ${idea} brings fresh perspectives to old problems
- **Practical applications**: Real-world use cases that deliver results
- **Measurable impact**: Tangible benefits you can see and track

## Why You Should Care About ${idea}

The impact of ${idea} extends far beyond initial impressions. It's reshaping industries, empowering individuals, and creating new opportunities for growth and success.

## Getting Started with ${idea}

Ready to explore ${idea}? Here's how to begin your journey:

1. **Learn the fundamentals**: Understanding the basics is crucial
2. **Start small**: Begin with manageable steps
3. **Track your progress**: Measure results and adjust accordingly

## Conclusion

${idea} represents more than just a new concept—it's an opportunity to be part of something transformative. Don't miss out on this chance to stay ahead of the curve.

**Ready to dive deeper?** Subscribe to our newsletter for exclusive insights and updates about ${idea}!

---
*Tags: ${idea.replace(/\s+/g, '-')}, innovation, transformation, future-trends*`,
      
      educational: `# Understanding ${idea}: A Comprehensive Guide

## Table of Contents
1. Introduction
2. What is ${idea}?
3. Key Concepts
4. Practical Applications
5. Getting Started
6. Conclusion

## Introduction

Welcome to this comprehensive guide on ${idea}. Whether you're a complete beginner or looking to deepen your understanding, this article will provide you with everything you need to know.

## What is ${idea}?

${idea} is a concept that has gained significant attention in recent times. At its core, ${idea} represents a new way of thinking about and approaching challenges in our modern world.

### The Fundamentals

To truly understand ${idea}, we need to break it down into its essential components:

- **Core Principle #1**: The foundation of ${idea}
- **Core Principle #2**: How it applies in practice
- **Core Principle #3**: Why it matters for you

## Key Concepts to Master

Understanding ${idea} requires familiarity with several important concepts:

### Concept 1: The Basics
${idea} starts with understanding the fundamental principles that drive its effectiveness.

### Concept 2: Practical Application
Learning how to apply ${idea} in real-world scenarios is crucial for success.

### Concept 3: Long-term Benefits
The true value of ${idea} becomes apparent over time as you implement and refine your approach.

## Practical Applications

Here are some ways you can start using ${idea} today:

1. **In your daily routine**: Simple steps to incorporate ${idea}
2. **At work**: Professional applications of ${idea}
3. **For personal growth**: How ${idea} can enhance your development

## Getting Started: Your Action Plan

Ready to begin your journey with ${idea}? Follow these steps:

**Step 1**: Research and learn the basics
**Step 2**: Start with small, manageable experiments
**Step 3**: Track your progress and results
**Step 4**: Adjust and optimize your approach

## Conclusion

${idea} offers tremendous potential for those willing to learn and apply its principles. By understanding the fundamentals and taking consistent action, you can harness the power of ${idea} to achieve your goals.

### Next Steps

- Subscribe to our newsletter for more insights
- Join our community to connect with others
- Download our free resource guide

---
*Keywords: ${idea.replace(/\s+/g, '-')}, education, learning, guide, tutorial*`,
    },
  };

  const content = templates[platform]?.[intent];
  
  if (content) {
    return content;
  }

  // Fallback generic content
  return `Check out this amazing insight about ${idea}! 

This ${intent} content is perfect for ${platform}. 

${idea} is transforming the way we think and work. Don't miss out on this opportunity to learn more!

#${idea.replace(/\s+/g, '')} #${platform} #${intent}`;
}

// Serve static files (HTML, CSS, JS) - must be after API routes
app.use(express.static(__dirname));

// Root route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 ContentFlow AI Prototype Server   ║
╚════════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
✅ Open http://localhost:${PORT} in your browser

Ready to generate content! 🎉
  `);
});
