# Deploy to AWS App Runner - Step by Step

## Prerequisites
- AWS Account with payment method verified
- Your code pushed to GitHub (or have it ready locally)

## Option 1: Deploy from GitHub (Recommended)

### Step 1: Push Code to GitHub

```powershell
# Initialize git if not already done
git init
git add .
git commit -m "Ready for App Runner deployment"

# Create repo on GitHub and push
git remote add origin https://github.com/YOUR_USERNAME/contentflow-ai.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy via AWS Console

1. **Go to AWS App Runner**:
   - URL: https://console.aws.amazon.com/apprunner/
   - Or search "App Runner" in AWS Console

2. **Create Service**:
   - Click "Create service"

3. **Source Configuration**:
   - Repository type: **Source code repository**
   - Click "Add new" to connect GitHub
   - Authorize AWS to access your GitHub
   - Select your repository: `contentflow-ai`
   - Branch: `main`
   - Click "Next"

4. **Build Settings**:
   - Configuration file: **Use a configuration file**
   - Configuration file: `apprunner.yaml`
   - Click "Next"

5. **Service Settings**:
   - Service name: `contentflow-ai`
   - Virtual CPU: **1 vCPU** (0.25 vCPU for free tier)
   - Virtual memory: **2 GB** (0.5 GB for free tier)
   - Port: `3000`
   - Click "Next"

6. **Review and Create**:
   - Review all settings
   - Click "Create & deploy"

7. **Wait for Deployment** (5-10 minutes):
   - Status will change from "Operation in progress" to "Running"
   - You'll get a URL like: `https://xxxxx.us-east-1.awsapprunner.com`

### Step 3: Test Your Deployment

```powershell
# Test health endpoint
curl https://your-app-url.awsapprunner.com/health

# Test in browser
start https://your-app-url.awsapprunner.com
```

## Option 2: Deploy from ECR (Container)

If you prefer Docker:

### Step 1: Create Dockerfile

Already created! See `Dockerfile` in your project.

### Step 2: Build and Push to ECR

```powershell
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository
aws ecr create-repository --repository-name contentflow-ai --region us-east-1

# Build image
docker build -t contentflow-ai .

# Tag image
docker tag contentflow-ai:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/contentflow-ai:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/contentflow-ai:latest
```

### Step 3: Create App Runner Service from ECR

1. Go to App Runner Console
2. Create service → Container registry
3. Select your ECR image
4. Configure port: 3000
5. Deploy!

## Updating Your App

After making changes:

```powershell
# Commit and push
git add .
git commit -m "Update app"
git push

# App Runner will auto-deploy!
```

Or manually trigger deployment:
1. Go to App Runner Console
2. Select your service
3. Click "Deploy" → "Deploy latest commit"

## Cost Estimate

**Free Tier** (First 2 months):
- Build: 100 build minutes/month
- Compute: 2,000 vCPU-minutes/month
- Memory: 4,000 GB-minutes/month

**After Free Tier**:
- ~$5-10/month for prototype usage
- Pay only for what you use

## Monitoring

View logs in AWS Console:
1. App Runner → Your Service
2. Click "Logs" tab
3. View application logs in real-time

## Troubleshooting

### Build Fails
- Check `apprunner.yaml` syntax
- Ensure `package.json` has all dependencies
- View build logs in App Runner console

### App Won't Start
- Check port is set to 3000
- View application logs
- Ensure `prototype-server.js` exists

### Can't Access App
- Check service status is "Running"
- Verify URL is correct
- Check security settings allow public access

## Environment Variables (Optional)

To add environment variables:
1. App Runner → Your Service → Configuration
2. Click "Edit"
3. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
4. Save and redeploy

## Custom Domain (Optional)

To use your own domain:
1. App Runner → Your Service → Custom domains
2. Click "Link domain"
3. Enter your domain name
4. Add DNS records as shown
5. Wait for verification

## Next Steps

Once deployed:
1. Test all features
2. Share the URL for your hackathon demo
3. Monitor usage in App Runner console
4. Update code by pushing to GitHub

Your app will be live at: `https://xxxxx.us-east-1.awsapprunner.com`
