# Dockerfile for AWS App Runner (optional - if using container deployment)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY prototype-server.js .
COPY index.html .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start application
CMD ["node", "prototype-server.js"]
