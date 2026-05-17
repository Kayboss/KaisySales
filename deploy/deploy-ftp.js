/**
 * Deploy KaisySales to cPanel via FTP
 *
 * Usage:
 *   1. Copy deploy/.env.example → deploy/.env and fill in your FTP details
 *   2. Run: node deploy/deploy-ftp.js
 */

const path = require('path');
const fs = require('fs');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');

// Load env
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('Missing deploy/.env. Copy deploy/.env.example and fill in your FTP details.');
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASS', 'REMOTE_PATH'];
for (const key of required) {
  if (!env[key]) {
    console.error(`Missing ${key} in deploy/.env`);
    process.exit(1);
  }
}

const REMOTE_PATH = env.REMOTE_PATH.replace(/\/?$/, ''); // strip trailing slash

async function uploadDir(client, localDir, remoteDir) {
  console.log(`  Uploading ${localDir} → ${remoteDir}`);
  await client.ensureDir(remoteDir);
  await client.clearWorkingDir();
  await client.uploadFromDir(localDir);
}

async function deploy() {
  console.log('1. Building project...');
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('2. Connecting to cPanel...');
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: env.FTP_HOST,
      user: env.FTP_USER,
      password: env.FTP_PASS,
      secure: env.FTP_SECURE !== 'false',
    });

    console.log(`3. Uploading dist/ → ${REMOTE_PATH}/`);
    await uploadDir(client, path.join(__dirname, '..', 'dist'), REMOTE_PATH);

    console.log(`4. Uploading api/ → ${REMOTE_PATH}/api/`);
    await uploadDir(client, path.join(__dirname, '..', 'api'), `${REMOTE_PATH}/api`);

    console.log('\nDone! Visit your site to see the changes.');
  } catch (err) {
    console.error('Deploy failed:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
