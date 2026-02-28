# Quick Deploy to AWS Elastic Beanstalk

## Step 1: Create Deployment ZIP

Run this command in PowerShell:

```powershell
# Create a ZIP file with only necessary files
Compress-Archive -Path prototype-server.js,index.html,package.json,package-lock.json,Procfile,.ebextensions -DestinationPath contentflow-deploy.zip -Force
```

## Step 2: Deploy to Elastic Beanstalk

1. Go to: https://console.aws.amazon.com/elasticbeanstalk/
2. Click "Create Application"
3. Fill in:
   - **Application name**: contentflow-ai
   - **Platform**: Node.js
   - **Platform branch**: Node.js 20 running on 64bit Amazon Linux 2023
   - **Application code**: Upload your code
   - Click "Choose file" and select `contentflow-deploy.zip`
4. Click "Create application"
5. Wait 5-10 minutes for deployment
6. Your app will be live at: http://contentflow-ai.elasticbeanstalk.com

## Alternative: Deploy via AWS CLI

```powershell
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js-20 contentflow-ai --region us-east-1

# Create environment and deploy
eb create contentflow-env

# Open in browser
eb open
```

## Step 3: Test Your Deployment

Once deployed, test:
```powershell
curl http://your-app-url.elasticbeanstalk.com/health
```

## Troubleshooting

View logs:
```powershell
eb logs
```

Or in AWS Console:
- Go to Elastic Beanstalk → Your App → Logs → Request Logs
