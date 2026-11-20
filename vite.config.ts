import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const dotStashBuildDir = path.resolve(rootDir, 'node_modules/dot-stash/dist/dot-stash');

/**
 * Serves and copies Stencil's pre-built `dot-stash` lazy browser bundle intact (`dot-stash.esm.js`
 * + sibling `p-*.entry.js` chunks) so Rollup does not break Stencil's runtime dynamic `import()`.
 */
function dotStashStaticPlugin(): Plugin {
  return {
    name: 'dot-stash-static-loader',
    configureServer(server) {
      server.middlewares.use('/dot-stash', (req, res, next) => {
        const reqUrl = (req.url ?? '/').split('?')[0];
        const filePath = path.resolve(dotStashBuildDir, '.' + reqUrl);
        if (
          !filePath.startsWith(dotStashBuildDir + path.sep) ||
          !existsSync(filePath) ||
          !statSync(filePath).isFile()
        ) {
          next();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          ext === '.js' || ext === '.mjs'
            ? 'text/javascript; charset=utf-8'
            : ext === '.css'
              ? 'text/css; charset=utf-8'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        createReadStream(filePath).pipe(res);
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'script',
            attrs: {
              type: 'module',
              src: './dot-stash/dot-stash.esm.js',
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
    writeBundle(options) {
      const outDir = options.dir ? path.resolve(options.dir) : path.resolve(rootDir, 'dist');
      cpSync(dotStashBuildDir, path.join(outDir, 'dot-stash'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [dotStashStaticPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
