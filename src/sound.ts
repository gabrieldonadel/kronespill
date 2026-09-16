/**
 * Sound for the machine, cut from a video of the real cabinet.
 *
 * Every sample here is the actual machine: the pin strikes, the coin landing in
 * the tube bank, the payout cascade, the flick. Volume follows the contact
 * impulse that planck reports, so a glancing touch is quiet and a solid hit off
 * a pin is not.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Surface } from './board';

const CLINKS = [
  require('../assets/sfx/clink_a.m4a'),
  require('../assets/sfx/clink_b.m4a'),
  require('../assets/sfx/clink_c.m4a'),
];
const THUD = require('../assets/sfx/thud.m4a');
const LAUNCH = require('../assets/sfx/launch.m4a');
const INSERT = require('../assets/sfx/insert.m4a');
const PAYOUT = require('../assets/sfx/payout.m4a');

/** Impulse below this is a touch, not a strike. Measured off the solver. */
const CLINK_FLOOR = 1.1;
const THUD_FLOOR = 1.6;
/** The real machine gives one to three audible ticks per flick. */
const MIN_GAP_MS = 45;

type Pool = { players: AudioPlayer[]; next: number };

function pool(source: unknown, size: number): Pool {
  return {
    players: Array.from({ length: size }, () => createAudioPlayer(source as never)),
    next: 0,
  };
}

let clinkPools: Pool[] = [];
let thudPool: Pool | null = null;
let launch: AudioPlayer | null = null;
let insert: AudioPlayer | null = null;
let payout: AudioPlayer | null = null;
let lastAt = 0;
let enabled = true;

export function initSound() {
  if (clinkPools.length) return;
  setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
  // Two players per variant, so overlapping strikes do not cut each other off.
  clinkPools = CLINKS.map((src) => pool(src, 2));
  thudPool = pool(THUD, 2);
  launch = createAudioPlayer(LAUNCH);
  insert = createAudioPlayer(INSERT);
  payout = createAudioPlayer(PAYOUT);
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function isSoundEnabled() {
  return enabled;
}

function fire(p: Pool | null, volume: number) {
  if (!p || !enabled) return;
  const player = p.players[p.next];
  p.next = (p.next + 1) % p.players.length;
  try {
    player.volume = Math.max(0, Math.min(1, volume));
    player.seekTo(0);
    player.play();
  } catch {
    // A player mid-seek is not worth dropping a frame over.
  }
}

function one(player: AudioPlayer | null, volume = 1) {
  if (!player || !enabled) return;
  try {
    player.volume = volume;
    player.seekTo(0);
    player.play();
  } catch {
    /* ignore */
  }
}

/** A contact from the solver: impulse magnitude and what was struck. */
export function playImpact(strength: number, on: Surface | null) {
  const soft = on === 'rail' || on === 'wall';
  const floor = soft ? THUD_FLOOR : CLINK_FLOOR;
  if (strength < floor) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  const volume = Math.max(0.12, Math.min(1, (strength - floor * 0.6) / 4));
  if (soft) fire(thudPool, volume * 0.8);
  else fire(clinkPools[Math.floor(Math.random() * clinkPools.length)], volume);
}

export function playLaunch() {
  one(launch, 0.85);
}

export function playInsert() {
  one(insert, 0.7);
}

/** The cascade into the bowl. Longer payouts simply play further into it. */
export function playPayout() {
  one(payout, 0.95);
}

export function playLost() {
  fire(thudPool, 0.45);
}
