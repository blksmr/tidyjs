import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log('[watch] build finished');
        });
    },
};

/**
 * Externalize node:* prefixed built-in imports.
 * With platform: "neutral", esbuild doesn't know about Node built-ins.
 * @type {import('esbuild').Plugin}
 */
const nodeBuiltinsPlugin = {
    name: 'node-builtins',
    setup(build) {
        build.onResolve({ filter: /^node:/ }, (args) => ({
            path: args.path,
            external: true,
        }));
    },
};

/**
 * Copy oxc-parser native bindings (.node files) to dist/.
 * At runtime, oxc-parser's bundled bindings.js resolves ./parser.<platform>.node
 * relative to the output file (dist/extension.js), via import.meta.url.
 */
function copyNativeBindings() {
    const oxcDir = path.join(process.cwd(), 'node_modules', '@oxc-parser');
    const distDir = path.join(process.cwd(), 'dist');

    if (!fs.existsSync(oxcDir)) {
        console.warn('Warning: @oxc-parser bindings not found in node_modules');
        return;
    }

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    for (const dir of fs.readdirSync(oxcDir)) {
        if (!dir.startsWith('binding-')) continue;
        const bindingDir = path.join(oxcDir, dir);
        for (const file of fs.readdirSync(bindingDir)) {
            if (file.endsWith('.node')) {
                fs.copyFileSync(
                    path.join(bindingDir, file),
                    path.join(distDir, file),
                );
                console.log(`Copied native binding: ${file}`);
            }
        }
    }
}

/**
 * Node extension configuration — ESM format.
 * oxc-parser JS is bundled, its native .node binary is copied to dist/.
 * @see https://code.visualstudio.com/api/working-with-extensions/bundling-extension
 * @type {import('esbuild').BuildOptions}
 */
const config = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'esm',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    metafile: !production,
    platform: 'neutral',
    target: ['node20'],
    outfile: 'dist/extension.js',
    mainFields: ['module', 'main'],
    conditions: ['node', 'import'],
    external: [
        'vscode',
        'fs', 'fs/promises', 'path', 'os', 'url', 'util', 'module',
        'child_process',
    ],
    logLevel: 'silent',
    legalComments: 'none',
    plugins: [
        nodeBuiltinsPlugin,
        esbuildProblemMatcherPlugin,
    ],
};

async function main() {
    const ctx = await esbuild.context(config);

    if (watch) {
        copyNativeBindings();
        await ctx.watch();
    } else {
        const result = await ctx.rebuild();
        copyNativeBindings();
        if (result.metafile) {
            fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
            console.log('Metafile written to dist/meta.json');
        }
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
