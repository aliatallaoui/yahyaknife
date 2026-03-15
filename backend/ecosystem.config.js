module.exports = {
  apps: [{
    name: 'yahya-api',
    script: 'server.js',
    instances: 'max',           // Use all available CPU cores
    exec_mode: 'cluster',       // Cluster mode for load balancing
    max_memory_restart: '500M', // Auto-restart if memory exceeds 500MB

    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 5000,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
    },

    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/log/yahya/pm2-error.log',
    out_file: '/var/log/yahya/pm2-out.log',
    merge_logs: true,            // Merge logs from all cluster instances

    // Restart behavior
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 4000,         // Wait 4s between restarts
    min_uptime: '10s',           // Consider started after 10s uptime

    // Graceful shutdown
    kill_timeout: 10000,         // 10s grace before SIGKILL
    listen_timeout: 8000,        // 8s to bind port on startup
    shutdown_with_message: true, // Send shutdown message to process

    // Health monitoring
    exp_backoff_restart_delay: 100, // Exponential backoff on crash loops
  }]
};
