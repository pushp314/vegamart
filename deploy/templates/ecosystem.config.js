module.exports = {
  apps: [
    {
      name: "vegamart-backend",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 1, // Start with 1 instance to avoid WebSockets/state concurrency issues unless specifically configured for cluster
      exec_mode: "fork",
      max_memory_restart: "512M",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      error_file: "../logs/backend-error.log",
      out_file: "../logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 10000,
    },
    {
      name: "vegamart-frontend",
      cwd: "./gali-connect-main",
      script: ".output/server/index.mjs",
      instances: "max", // Frontend SSR is typically stateless and safe for cluster
      exec_mode: "cluster",
      max_memory_restart: "512M",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      kill_timeout: 10000,
    },
  ],
};
