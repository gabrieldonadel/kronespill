// Usage: node --import ./scripts/register.mjs scripts/sim.mjs
import { register } from 'node:module';
register('./ts-resolve-hooks.mjs', import.meta.url);
