const fs = require('fs');
const path = require('path');

function readDotEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const obj = {};
    for (const l of lines) {
      const line = l.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      obj[k] = v;
    }
    return obj;
  } catch (e) {
    return {};
  }
}

const repoRoot = path.resolve(__dirname, '..');
const envFromProcess = {
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

let username = envFromProcess.ADMIN_USERNAME;
let password = envFromProcess.ADMIN_PASSWORD;

if (!username || !password) {
  const envFile = path.join(repoRoot, 'security', '.env');
  const parsed = readDotEnv(envFile);
  username = username || parsed.ADMIN_USERNAME;
  password = password || parsed.ADMIN_PASSWORD;
}

username = username || 'SUPERUTILISATEUR';
password = password || 'Bijoux1234$';

const out = `// security/config.js — generated at build time\n// WARNING: this file exposes client-side config. Do not put secrets here for production.\nwindow.SECURITY_CONFIG = {\n  ADMIN_USERNAME: ${JSON.stringify(username)},\n  ADMIN_PASSWORD: ${JSON.stringify(password)}\n};\n`;

const outPath = path.join(repoRoot, 'security', 'config.js');
fs.writeFileSync(outPath, out, 'utf8');
console.log('Generated', outPath);
