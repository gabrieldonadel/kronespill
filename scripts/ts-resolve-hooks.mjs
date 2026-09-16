// Lets the analysis scripts import the app's extensionless TypeScript
// specifiers. Metro and tsc resolve `./engine`; Node's ESM loader does not.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    const url = new URL(specifier, context.parentURL);
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(url.href + ext);
      if (existsSync(fileURLToPath(candidate))) {
        return next(url.href + ext, context);
      }
    }
  }
  return next(specifier, context);
}
