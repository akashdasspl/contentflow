# ContentFlow AI - Prototype Guide

## 🚀 Quick Start

Your ContentFlow AI prototype is now running!

### What's Running

- **Backend Server**: http://localhost:3000
- **Frontend Interface**: Open http://localhost:3000 in your browser

### How to Use

1. **Open your browser** and navigate to http://localhost:3000
2. **Enter a content idea** (e.g., "AI in education", "sustainable fashion", "remote work tips")
3. **Select a platform** (LinkedIn, Twitter, or Instagram)
4. **Choose intent** (Promotional or Educational)
5. **Click "Generate Content"** and watch the magic happen!

### Features in This Prototype

✅ Simple web interface for content generation
✅ Platform-specific content templates (LinkedIn, Twitter, Instagram)
✅ Intent-based content variations (Promotional, Educational)
✅ Real-time content generation
✅ Mock AI content generation (no AWS required for testing)

### Example Ideas to Try

- "AI in healthcare"
- "Climate change solutions"
- "Productivity hacks for developers"
- "Mental health awareness"
- "Cryptocurrency basics"
- "Healthy eating tips"

### Stopping the Server

To stop the prototype server, you can:
- Press `Ctrl+C` in the terminal where it's running
- Or ask me to stop it

### Next Steps

This is a simplified prototype using mock data. To use the full AI-powered version:

1. **Fix TypeScript errors** in the codebase
2. **Configure AWS credentials** for Bedrock access
3. **Set up DynamoDB tables** for data persistence
4. **Deploy to AWS** using CDK

### Architecture

```
Browser (index.html)
    ↓
Express Server (prototype-server.js)
    ↓
Mock Content Generator
    ↓
Platform-Specific Templates
```

### Files

- `index.html` - Frontend interface
- `prototype-server.js` - Backend server with mock generation
- `server.ts` - Full TypeScript server (needs build fixes)
- `.env` - Environment configuration

### Troubleshooting

**Port already in use?**
- Change the PORT in `prototype-server.js` to 3001 or another available port

**Can't access the page?**
- Make sure the server is running (check terminal output)
- Try http://127.0.0.1:3000 instead

**Want real AI generation?**
- You'll need to fix the TypeScript build errors
- Configure AWS Bedrock credentials
- Use the full `server.ts` implementation

---

Enjoy testing your ContentFlow AI prototype! 🎉
