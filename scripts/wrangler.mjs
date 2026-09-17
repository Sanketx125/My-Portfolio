import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

// Keep Flask's .env out of Worker builds. Worker development uses .dev.vars.
const logDirectory = resolve('.wrangler-cache/logs');
mkdirSync(logDirectory, {recursive: true});
const env = {
  ...process.env,
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  WRANGLER_LOG_PATH: logDirectory,
};
const args = process.argv.slice(2);
if (args[0] === 'dev' || args.includes('--local') || args.includes('--dry-run')) {
  const localConfig = resolve('.wrangler-cache/config');
  mkdirSync(localConfig, {recursive: true});
  env.XDG_CONFIG_HOME = localConfig;
}
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
const result = spawnSync(process.execPath, [cli, ...args], {stdio: 'inherit', env});
process.exit(result.status ?? 1);
