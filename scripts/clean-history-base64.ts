/**
 * One-time script to strip audioBase64 and screenshotDataUrl from config.json history.
 * Usage: npx ts-node scripts/clean-history-base64.ts
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(
  os.homedir(),
  'Library/Application Support/OpenType/config.json'
);

if (!fs.existsSync(configPath)) {
  console.log('config.json not found at', configPath);
  process.exit(0);
}

const raw = fs.readFileSync(configPath, 'utf-8');
const sizeBefore = Buffer.byteLength(raw);
const data = JSON.parse(raw);

let removed = 0;
if (Array.isArray(data.history)) {
  for (const item of data.history) {
    if (item.audioBase64) {
      delete item.audioBase64;
      removed++;
    }
    if (item.context?.screenshotDataUrl) {
      delete item.context.screenshotDataUrl;
      removed++;
    }
  }
}

if (removed === 0) {
  console.log('No base64 fields found — config.json is clean.');
  process.exit(0);
}

const out = JSON.stringify(data, null, 2);
const sizeAfter = Buffer.byteLength(out);
fs.writeFileSync(configPath, out, 'utf-8');

console.log(`Cleaned ${removed} base64 fields.`);
console.log(`Size: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB → ${(sizeAfter / 1024 / 1024).toFixed(2)} MB`);
