import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const nodeBuiltinsPlugin = {
    name: 'node-builtins',
    setup(build) {
        build.onResolve({ filter: /^node:/ }, (args) => ({
            path: args.path,
            external: true,
        }));
    },
};

/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    minify: production,
    sourcemap: !production,
    platform: 'node',
    target: ['node20'],
    outfile: 'dist/cli.js',
    mainFields: ['module', 'main'],
    conditions: ['node', 'import'],
    external: ['fs', 'fs/promises', 'path', 'os', 'url', 'util', 'module', 'child_process'],
    banner: { js: '#!/usr/bin/env node' },
    plugins: [nodeBuiltinsPlugin],
};

function copyNativeBindings() {
    const distDir = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

    // Look for oxc-parser bindings (hoisted to root node_modules)
    const searchPaths = [
        path.join(process.cwd(), 'node_modules', '@oxc-parser'),
        path.join(process.cwd(), '..', '..', 'node_modules', '@oxc-parser'),
    ];

    for (const oxcDir of searchPaths) {
        if (!fs.existsSync(oxcDir)) continue;
        for (const dir of fs.readdirSync(oxcDir)) {
            if (!dir.startsWith('binding-')) continue;
            const bindingDir = path.join(oxcDir, dir);
            for (const file of fs.readdirSync(bindingDir)) {
                if (file.endsWith('.node')) {
                    fs.copyFileSync(path.join(bindingDir, file), path.join(distDir, file));
                    console.log(`Copied native binding: ${file}`);
                }
            }
        }
        break;
    }
}

async function main() {
    if (production) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    const ctx = await esbuild.context(config);
    if (watch) {
        await ctx.watch();
        console.log('[cli] watching...');
    } else {
        await ctx.rebuild();
        copyNativeBindings();
        await ctx.dispose();
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
