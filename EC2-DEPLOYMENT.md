# Deploy ContentFlow AI to AWS EC2

## Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance

2. Configure:
   - **Name**: contentflow-ai-server
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance type**: t2.micro (Free tier - 1GB RAM, 1 vCPU)
   - **Key pair**: Create new or use existing (download .pem file)
   - **Network settings**: 
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere
     - Allow Custom TCP (port 3000) from anywhere
   - **Storage**: 8GB (Free tier)

3. Click "Launch Instance"

4. Wait for instance to be "Running" and note the **Public IPv4 address**

## Step 2: Connect to EC2 Instance

### From Windows (using PowerShell):

```powershell
# Navigate to where your .pem key is
cd C:\path\to\your\key

# Set permissions (if needed)
icacls contentflow-ai-key.pem /inheritance:r
icacls contentflow-ai-key.pem /grant:r "%username%:R"

# Connect via SSH
ssh -i contentflow-ai-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Alternative: Use PuTTY
1. Download PuTTY and PuTTYgen
2. Convert .pem to .ppk using PuTTYgen
3. Connect using PuTTY with the .ppk file

## Step 3: Install Node.js on EC2

Once connected to your EC2 instance:

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 (process manager)
sudo npm install -g pm2
```

## Step 4: Upload Your Application

### Option A: Using Git (Recommended)

```bash
# Install git
sudo apt install git -y

# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install dependencies
npm install
```

### Option B: Using SCP (from your local machine)

```powershell
# From your Windows machine
scp -i contentflow-ai-key.pem -r G:\AWS_project ubuntu@YOUR_EC2_PUBLIC_IP:~/contentflow-ai
```

Then on EC2:
```bash
cd ~/contentflow-ai
npm install
```

## Step 5: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add your configuration:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
BEDROCK_TEXT_GENERATION_MODEL=anthropic.claude-3-haiku-20240307-v1:0
```

Save: `Ctrl+X`, then `Y`, then `Enter`

## Step 6: Start the Server

### For Prototype Server (Mock Data):

```bash
# Start with PM2
pm2 start prototype-server.js --name contentflow-prototype

# Check status
pm2 status

# View logs
pm2 logs contentflow-prototype
```

### For Bedrock Server (Real AI):

```bash
# Start with PM2
pm2 start bedrock-server.js --name contentflow-bedrock

# Check status
pm2 status
```

## Step 7: Configure PM2 to Start on Boot

```bash
# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup

# Copy and run the command that PM2 outputs
```

## Step 8: Configure Nginx (Optional - for port 80)

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/contentflow
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/contentflow /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 9: Access Your Application

- **With port 3000**: http://YOUR_EC2_PUBLIC_IP:3000
- **With Nginx (port 80)**: http://YOUR_EC2_PUBLIC_IP

## Step 10: Useful PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs

# Restart application
pm2 restart contentflow-prototype

# Stop application
pm2 stop contentflow-prototype

# Delete application
pm2 delete contentflow-prototype

# Monitor resources
pm2 monit
```

## Security Best Practices

1. **Update Security Group**:
   - Only allow SSH from your IP
   - Use port 80/443 for public access (not 3000)

2. **Setup HTTPS** (Optional):
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (requires domain name)
sudo certbot --nginx -d yourdomain.com
```

3. **Setup Firewall**:
```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Troubleshooting

### Check if server is running:
```bash
pm2 status
pm2 logs
```

### Check if port 3000 is listening:
```bash
sudo netstat -tulpn | grep 3000
```

### Restart everything:
```bash
pm2 restart all
sudo systemctl restart nginx
```

### View system resources:
```bash
free -h
df -h
top
```

## Cost Estimate

- **t2.micro (Free Tier)**: Free for 12 months, then ~$8/month
- **Data Transfer**: First 100GB free/month
- **Storage**: 8GB = ~$0.80/month

**Total**: Free for 12 months, then ~$9/month

## Updating Your Application

```bash
# Pull latest changes
cd ~/contentflow-ai
git pull

# Install new dependencies
npm install

# Restart application
pm2 restart contentflow-prototype
```

## Quick Deploy Script

Save this as `deploy.sh`:

```bash
#!/bin/bash
echo "🚀 Deploying ContentFlow AI..."

# Pull latest code
git pull

# Install dependencies
npm install

# Restart application
pm2 restart contentflow-prototype

echo "✅ Deployment complete!"
pm2 status
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Need Help?

- Check PM2 logs: `pm2 logs`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check system logs: `sudo journalctl -xe`
