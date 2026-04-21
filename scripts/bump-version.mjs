import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionPath = join(__dirname, '../lib/version.ts');

const content = readFileSync(versionPath, 'utf-8');
const match = content.match(/BUILD_NUMBER = (\d+)/);
if (!match) process.exit(1);

const next = parseInt(match[1], 10) + 1;
const nextMinor = Math.floor(next / 100);
const nextPatch = next % 100;
const nextVersion = `0.${String(nextMinor).padStart(2, '0')}.${String(nextPatch).padStart(2, '0')}`;
const updated = content.replace(/BUILD_NUMBER = \d+/, `BUILD_NUMBER = ${next}`);

writeFileSync(versionPath, updated, 'utf-8');
console.log(`Version bumped to ${nextVersion}`);
