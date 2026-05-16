const fs = require('fs');
const path = require('path');

// Load /opt/accessiblewebsite/.env (mode 600) into a plain object at boot.
// pm2 caches env, so use `pm2 delete all && pm2 start ecosystem.config.cjs`
// after editing .env — `pm2 restart --update-env` only picks up shell env.
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

module.exports = {
  apps: [
    {
      name: 'accessiblewebsite-web',
      cwd: '/opt/accessiblewebsite/apps/web',
      script: './dist/server/entry.mjs',
      env: { ...env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4100' },
      max_memory_restart: '512M',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      error_file: '/var/log/pm2/accessiblewebsite-web.error.log',
      out_file: '/var/log/pm2/accessiblewebsite-web.out.log',
    },
    {
      name: 'accessiblewebsite-scanner',
      cwd: '/opt/accessiblewebsite/apps/scanner',
      script: './dist/index.js',
      env: { ...env, NODE_ENV: 'production' },
      max_memory_restart: '900M',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      error_file: '/var/log/pm2/accessiblewebsite-scanner.error.log',
      out_file: '/var/log/pm2/accessiblewebsite-scanner.out.log',
    },
  ],
};
