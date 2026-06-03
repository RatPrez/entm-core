const esbuild = require('esbuild');

const isWatch = process.env.IS_WATCH_MODE === '1';

const shared = {
    bundle:   true,
    target:   'es2020',
    format:   'cjs',
    logLevel: 'info',
};

const builds = [
    {
        ...shared,
        entryPoints: ['src/client/index.ts'],
        outfile:     'dist/client.js',
        platform:    'browser',
    },
    {
        ...shared,
        entryPoints: ['src/server/index.ts'],
        outfile:     'dist/server.js',
        platform:    'node',
    },
];

async function main() {
    if (isWatch) {
        const contexts = await Promise.all(builds.map(b => esbuild.context(b)));
        await Promise.all(contexts.map(ctx => ctx.watch()));
        console.log('Watching for changes...');
    } else {
        await Promise.all(builds.map(b => esbuild.build(b)));
    }
}

main().catch(err => { console.error(err); process.exit(1); });
