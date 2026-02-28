#!/bin/bash

# ContentFlow AI - EC2 Deployment Script
echo "🚀 Starting ContentFlow AI deployment..."

# Update code
echo "📥 Pulling latest changes..."
git pull

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Restart application
echo "🔄 Restarting application..."
pm2 restart contentflow-prototype || pm2 start prototype-server.js --name contentflow-prototype

# Show status
echo "✅ Deployment complete!"
echo ""
pm2 status
echo ""
echo "🌐 Access your app at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
