const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'frontend');
const publicDir = path.join(rootDir, 'public');

fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(sourceDir, publicDir, { recursive: true });

console.log('Prepared frontend assets in public/.');
