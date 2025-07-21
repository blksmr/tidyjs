const process = require("node:process");
const console = require("node:console");
const lodashPlugin = require("esbuild-plugin-lodash");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @see https://code.visualstudio.com/api/working-with-extensions/bundling-extension#using-esbuild
 */
async function main() {
  const ctx = await require("esbuild").context({
    entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		metafile: !production,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		legalComments: 'none',
    plugins: [
			lodashPlugin(),
			esbuildProblemMatcherPlugin,
		],
  });
  if (watch) {
    await ctx.watch();
  } else {
    const result = await ctx.rebuild();
    if (result.metafile) {
      require('fs').writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
      console.log('Metafile written to dist/meta.json');
    }
    await ctx.dispose();
  }
}

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
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});