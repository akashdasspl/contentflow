# ContentFlow AI - Deployment Guide

## Quick Start (Local)

Run the prototype server locally:

```bash
node prototype-server.js
```

Open http://localhost:3000 in your browser.

## Deploy to Vercel (Free)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts:
   - Set up and deploy? Yes
   - Which scope? Your account
   - Link to existing project? No
   - Project name? contentflow-ai
   - Directory? ./
   - Override settings? No

4. Your app will be live at: https://contentflow-ai.vercel.app

## Deploy to Render (Free)

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Name: contentflow-ai
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node prototype-server.js`
   - Instance Type: Free

5. Click "Create Web Service"

## Deploy to Railway (Free)

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway auto-detects Node.js
5. Add start command: `node prototype-server.js`
6. Deploy!

## Environment Variables

The prototype server doesn't need any environment variables (uses mock data).

For the real Bedrock server (bedrock-server.js), you'll need:
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- BEDROCK_TEXT_GENERATION_MODEL

## Testing Your Deployment

Once deployed, test the API:

```bash
curl -X POST https://your-app.vercel.app/generate \
  -H "Content-Type: application/json" \
  -d '{
    "contentIdea": "AI in healthcare",
    "platform": "linkedin",
    "intent": "educational"
  }'
```

## Switching to Real AWS Bedrock

To use real AI instead of mock data:

1. Update your deployment to use `bedrock-server.js` instead
2. Add AWS environment variables
3. Ensure payment is verified in AWS
4. Redeploy

## Cost Estimates

- **Vercel Free Tier**: 100GB bandwidth/month
- **Render Free Tier**: 750 hours/month
- **Railway Free Tier**: $5 credit/month
- **AWS Bedrock**: ~$0.50 per 1000 generations

All platforms offer free tiers perfect for prototypes and hackathons!
