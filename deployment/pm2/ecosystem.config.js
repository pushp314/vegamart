// =============================================================================
// Vegamart — PM2 ecosystem (rendered by setup-pm2.sh into
// /opt/vegamart/configs/ecosystem.config.js with real paths).
//
// Apps:
//   vegamart-api — Express/TypeScript backend (cluster mode)
//   vegamart-web — TanStack Start SSR server (fork mode, single instance)
//
// Both use the `current` release symlink, so deploys and rollbacks only need
// to swap the symlink and `pm2 reload`.
// =============================================================================

module.exports = {
  apps: [
    {
      name: "vegamart-api",
      cwd: "{{APP_BASE_DIR}}/releases/current/backend",
      script: "dist/server.js",
      exec_mode: "cluster",
      instances: "{{PM2_BACKEND_INSTANCES}}",
      max_memory_restart: "512M",
      autorestart: true,
      watch: false,
      kill_timeout: 10000,
      listen_timeout: 15000,
      out_file: "{{APP_BASE_DIR}}/logs/api-out.log",
      error_file: "{{APP_BASE_DIR}}/logs/api-error.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "{{API_PORT}}",
      },
    },
    {
      name: "vegamart-web",
      cwd: "{{APP_BASE_DIR}}/releases/current/gali-connect-main",
      script: ".output/server/index.mjs",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      autorestart: true,
      watch: false,
      kill_timeout: 10000,
      listen_timeout: 15000,
      out_file: "{{APP_BASE_DIR}}/logs/web-out.log",
      error_file: "{{APP_BASE_DIR}}/logs/web-error.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "{{WEB_PORT}}",
        HOST: "127.0.0.1",
        NITRO_HOST: "127.0.0.1",
      },
    },
  ],
};
