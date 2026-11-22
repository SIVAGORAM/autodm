const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const standaloneApp = path.join(appRoot, '.next', 'standalone', 'frontend');
const serverFile = path.join(standaloneApp, 'server.js');
const staticSource = path.join(appRoot, '.next', 'static');
const publicSource = path.join(appRoot, 'public');

if (!fs.existsSync(serverFile)) {
  throw new Error(`Expected standalone server output at ${serverFile}`);
}
if (!fs.existsSync(staticSource) || !fs.existsSync(publicSource)) {
  throw new Error('Expected Next.js static and public assets after build.');
}

fs.cpSync(staticSource, path.join(standaloneApp, '.next', 'static'), { recursive: true });
fs.cpSync(publicSource, path.join(standaloneApp, 'public'), { recursive: true });

console.log('Prepared standalone Next.js server with public and static assets.');
