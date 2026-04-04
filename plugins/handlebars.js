import { opendir, readFile } from 'node:fs/promises';
import { join, parse, resolve } from 'node:path';
import hbs from 'handlebars';
import { normalizePath } from 'vite';

const VALID_EXTENSIONS = new Set(['.html', '.hbs']);

async function* walk(dir) {
  for await (const d of await opendir(dir)) {
    const fullFileName = join(dir, d.name);
    if (d.isDirectory()) {
      yield* walk(fullFileName);
    } else if (d.isFile()) {
      yield fullFileName;
    }
  }
}

async function resolveContext(context, pagePath) {
  if (typeof context === 'undefined') {
    return context;
  }
  if (typeof context === 'function') {
    return resolveContext(await context(pagePath), pagePath);
  }
  const output = {};
  for (const key of Object.keys(context)) {
    const value = context[key];
    if (typeof value === 'function') {
      output[key] = await value(pagePath);
    } else {
      output[key] = value;
    }
  }
  return output;
}

async function registerPartials(directoryPath, partialsSet) {
  const pathArray = Array.isArray(directoryPath) ? directoryPath : [directoryPath];
  for await (const path of pathArray) {
    try {
      const normalizedPath = normalizePath(path);
      for await (const fileName of walk(path)) {
        const normalizedFileName = normalizePath(fileName);
        const parsedPath = parse(normalizedFileName);
        if (VALID_EXTENSIONS.has(parsedPath.ext)) {
          let partialName = parsedPath.name;
          if (parsedPath.dir !== normalizedPath) {
            const prefix = parsedPath.dir.replace(`${normalizedPath}/`, '');
            partialName = `${prefix}/${parsedPath.name}`;
          }
          const content = await readFile(fileName);
          partialsSet.add(fileName);
          hbs.registerPartial(partialName, content.toString());
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
}

export default function handlebars({
  context,
  reloadOnPartialChange = true,
  compileOptions,
  runtimeOptions,
  partialDirectory,
  helpers,
} = {}) {
  const partialsSet = new Set();
  let root;

  hbs.registerHelper('resolve-from-root', function (path) {
    return resolve(root, path);
  });
  if (helpers) {
    hbs.registerHelper(helpers);
  }

  return {
    name: 'handlebars',
    configResolved(config) {
      root = config.root;
    },
    async handleHotUpdate({ server, file }) {
      if (reloadOnPartialChange && partialsSet.has(file)) {
        server.ws.send({
          type: 'full-reload',
        });
        return [];
      }
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (partialDirectory) {
          await registerPartials(partialDirectory, partialsSet);
        }
        const template = hbs.compile(html, compileOptions);
        const resolvedContext = await resolveContext(
          context,
          normalizePath(ctx.path)
        );
        return template(resolvedContext, runtimeOptions);
      },
    },
  };
}
