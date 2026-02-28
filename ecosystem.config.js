// PM2 Ecosystem Configuration
module.exports = {
  apps: [
    {
      name: 'contentflow-prototype',
      script: './prototype-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'contentflow-bedrock',
      script: './bedrock-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/bedrock-err.log',
      out_file: './logs/bedrock-out.log',
      log_file: './logs/bedrock-combined.log',
      time: true
    }
  ]
};
