#!/usr/bin/env node
// Other
import { execSync }      from 'child_process';
import {
    existsSync,
    readFileSync
}                        from 'fs';
import {
    resolve,
    dirname
}                        from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) process.env[match[1].trim()] = match[2].trim();
    }
}

const pat = process.env.VSCE_PAT;
if (!pat) {
    console.error('VSCE_PAT not set. Add it to .env:');
    console.error('  VSCE_PAT=your-token');
    process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const vsix = resolve(root, `tidyjs-${pkg.version}.vsix`);

if (!existsSync(vsix)) {
    console.error(`File ${vsix} not found. Run "npm run build" first.`);
    process.exit(1);
}

console.log(`Publishing TidyJS v${pkg.version}...`);

try {
    execSync(`vsce publish --packagePath "${vsix}" -p '${pat}'`, {
        cwd: root,
        stdio: 'inherit',
    });
    console.log(`TidyJS v${pkg.version} published successfully.`);
} catch {
    console.error('Publish failed.');
    process.exit(1);
}
