# AWS Amplify is NOT suitable for prototype-server.js

AWS Amplify is designed for static websites and serverless functions, not for Node.js Express servers.

## Better Options for prototype-server.js:

### Option 1: AWS Elastic Beanstalk (Recommended)

1. Go to AWS Console → Elastic Beanstalk
2. Click "Create Application"
3. Settings:
   - Application name: contentflow-ai
   - Platform: Node.js
   - Platform branch: Node.js 20
   - Upload your code: Create a ZIP of your project
4. Click "Create application"

**Create ZIP file:**
```cmd
# Exclude unnecessary files
tar -czf contentflow.zip --exclude=node_modules --exclude=.git --exclude=test --exclude=dist .
```

Or manually zip these files:
- prototype-server.js
- index.html
- package.json
- package-lock.json
- Procfile
- .ebextensions/

### Option 2: AWS App Runner (Easiest)

1. Go to AWS Console → App Runner
2. Click "Create service"
3. Source: Source code repository (connect GitHub)
4. Build settings:
   - Runtime: Node.js 20
   - Build command: `npm install`
   - Start command: `node prototype-server.js`
   - Port: 3000
5. Click "Create & deploy"

### Option 3: AWS EC2 (Most Control)

See EC2-DEPLOYMENT.md for full instructions.

### Option 4: Use Amplify for Static Frontend Only

If you want to use Amplify, deploy only the static HTML/CSS/JS:
1. Remove server code
2. Call a separate API (deployed on EC2/Lambda)
3. Use Amplify just for hosting index.html

## Quick Comparison:

| Service | Best For | Cost | Complexity |
|---------|----------|------|------------|
| **Elastic Beanstalk** | Full apps | ~$10/mo | Medium |
| **App Runner** | Containers/Apps | ~$5/mo | Low |
| **EC2** | Full control | ~$8/mo | High |
| **Amplify** | Static sites | Free tier | Low |

## Recommendation:

For your hackathon prototype, use **AWS App Runner** - it's the easiest and cheapest option for Node.js servers.
