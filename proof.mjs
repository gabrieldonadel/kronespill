#!/usr/bin/env bun
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const exact2 = resolve(import.meta.dir, process.env.EXACT2 ?? '../exact2');
const { proof } = await import(pathToFileURL(resolve(exact2, 'game/proof.mjs')).href);

if (import.meta.main) await proof(import.meta, async ({ open, check, host, out, pin }) => {
  const session = await open();
  const node = (tree, id) => tree.nodes.find(item => item.props?.testId === id);
  check('cabinet exposes its controls', !!node(await session.tree(), 'insert'));
  await session.tap('insert');
  check('insert loads one coin', (await session.world('world').snapshot()).resources.Machine.phase === 1);
  await session.world('world').hold('Space', 500);
  await session.world('world').run(1200);
  const state = await session.world('world').snapshot();
  check('release launches the coin', state.resources.Machine.played === 1);
  pin(state.tick, state);
  if (host === 'web') await session.screenshot(resolve(out, 'game.png'));
  await session.close();
});

