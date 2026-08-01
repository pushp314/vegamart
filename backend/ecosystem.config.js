/**
 * PM2 production process configuration for Gali Connect backend.
 *
 * Start:            pm2 start ecosystem.config.js
 * Reload:           pm2 reload gali-connect-backend
 * Restart on boot:  pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "gali-connect-backend",
      script: "dist/server.js",
      instances: process.env.WEB_CONCURRENCY || "max",
      exec_mode: "cluster",
      max_memory_restart: "512M",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 10_000,
      time: true,
    },
  ],
};
