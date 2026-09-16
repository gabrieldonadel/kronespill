# Kronespill

A playable replica of the Norwegian *kronespill* — the coin-flick machine also
called a *knipsekasse* or *kroneautomat*. The game came to Norway in 1937 via
Norges Røde Kors, descended from the German *Bajazzo* by way of the Finnish
*pajatso*, and Røde Kors and Redningsselskapet ran thousands of them as
fundraisers until the new 1-krone coin of 1997 stopped fitting the mechanism.

The cabinet here was rebuilt from a photograph of a 1-krone machine: the
airbrushed backplate, the arch, the two bumpers, the chrome pin above each
crown, the nine pockets paying **3 2 3 2 10 3 2 3 2**, the rail beneath them,
the chevron, the eighteen coin tubes, the striped launch chute and the
`Bruk kun feilfrie kronestykker` plate down the right frame member.

## Playing it

| Control | What it does |
| --- | --- |
| **LEGG PÅ MYNT** | Insert one krone. One at a time, as the plate says. |
| **Lever** | Drag down to set the flick, release to shoot. |
| **Coin bowl** | Tap it to pocket your winnings. |

The coin is flicked up the channel down the **right edge** of the glass, rounds
the guide at the top right and is released heading left along the ceiling, then
falls through the pins. A flick too weak to round the guide drops back out of
the channel — a wasted krone, exactly as on the machine.

A coin that drops into a crown hole pays what the shield says, **out of the tube
stock behind that hole**: coins leave the bottom of the tube one at a time and
the stack steps down as they fall into the bowl. A coin that misses rolls off
the rail and the machine keeps it.

The coin is the real thing — both faces of a 1983 Olav V krone, photographed and
masked to the rim. A loaded machine shows a couple of hundred coins at once, so
the art is decoded **once per face** with expo-image's `useImage` and every coin
draws from that same reference; each tube is memoised on its own count, so
paying a win re-renders one tube rather than the whole bank. A machine of this vintage takes exactly that coin; the 1997
replacement with its centre hole is what put these machines out of service.

## How it is put together

| File | Job |
| --- | --- |
| `src/engine.ts` | Board constants and the `Tune` knobs. No physics. |
| `src/board.ts` | The single description of the collision geometry. |
| `src/physics.ts` | The solver: [planck.js](https://github.com/piqnt/planck.js), a TypeScript rewrite of Box2D. |
| `src/payout.ts` | Where a win's coins come from. Pure, and tested. |
| `src/sound.ts` | Sound, cut from a video of the real machine. |
| `src/Game.tsx` | The cabinet, the controls and the round. |

Geometry is in board units, where the glass is 100 wide and a 1-krone coin is
4.4 across, which makes one unit 4.77 mm on the real cabinet. `src/board.ts` is
the only place the geometry is written down: planck builds its fixtures from it,
the renderer draws the rails from it, and the checker validates it. That is what
keeps the picture and the physics from drifting apart.

The coin is a disc with real angular dynamics, so it rolls along the rail and
spins off the pins. Contact impulses come out of the solver and drive both the
sound and the haptics, so a glancing touch is quiet and a solid pin strike is
not.

**The launcher is on the right.** Both the photograph and the reference video
(a *Salina Alu* cabinet, made in Østfold in the 1980s) show a black-covered
channel down the right edge of the glass, running from the top down to just
above the shields, with the flick mechanism outside the frame at the top right.
The guide at its head is a 5.5-unit groove — wide enough to pass a coin, narrow
enough to hold it through the turn.

**Gravity is derived, not dialled in.** The cabinet hangs on the wall leaning
back, so the coin runs on an inclined plane and only feels g·sin(theta) along the
board. At 18 degrees that is 635 board units/s², which sets the pace of the
whole game.

## Balancing it

`src/physics.ts` runs unchanged in Hermes and in Node, so the machine is
balanced and checked away from a device.

```
node --import ./scripts/register.mjs scripts/check-board.mjs   # geometry faults
node --import ./scripts/register.mjs scripts/sim.mjs 4000      # payback, hit rate, flight
node --import ./scripts/register.mjs scripts/grid.mjs 900      # sweep the knobs
node --import ./scripts/register.mjs scripts/resonance.mjs 230 330 250 24
node --import ./scripts/register.mjs scripts/payout.test.mjs   # payout accounting
```

Current board, over 4 000 simulated flicks:

| | |
| --- | --- |
| hit rate | 29.9% |
| payback | 0.852 kr per krone played |
| house edge | 14.8% |
| flight | 2.35 s mean, 4.28 s worst |
| jammed coins | none |
| jackpot | 1.4% of flicks |
| spread | all nine holes between 2.9% and 4.3% |

No flick strength beats the machine: payback stays between 0.6 and 1.1 across
the whole power range. That needs the flick jitter in `TUNE` — without it the
board has narrow strengths that land the jackpot over and over.

### Two rules the geometry has to obey

`scripts/check-board.mjs` enforces both, because neither is visible on a device
until a coin is stuck behind glass:

1. **No wedges.** Every gap between two obstacles is either wider than a coin or
   effectively closed. A gap in between traps a coin forever. This is why the
   small screws flanking the bumpers, and the extra pins above each crown on the
   real cabinet, are drawn rather than simulated.
2. **Every mouth clears a coin.** A pocket narrower than 4.4 units can never pay.

### Where the model departs from the machine

- **The rail under the shields is unbroken.** The winning holes are slots in the
  backplate, behind the plane the coin rolls in, so dropping into one needs the
  coin to line up in a depth axis a flat board does not have. `TUNE.enterRate`
  is the rate at which that alignment happens per second spent over a hole: a
  coin rolling quickly gets few chances, a coin that stops over a hole
  eventually falls in. It is the machine's main economic knob.

  This replaced an earlier attempt to gate entry on the coin's velocity. Once
  the coin had real angular dynamics it simply rolled into holes, because in two
  dimensions a hole in the floor is a hole in the floor — the missing dimension
  had to be modelled, not approximated.
- The chevron rail and the tube bank are drawn, not simulated. By the time a
  coin reaches them the round is already decided.
- A coin balanced on a pin gets nudged, the way a real cabinet is never quite
  still. After too long it counts as lost rather than hanging the game.

## Sound

Every sample in `assets/sfx` is the real machine, cut from a video of it: the
pin strikes, the coin landing in the tube bank, the payout cascade, the flick.
They were picked by measurement rather than by ear — bright metallic transients
at 4–6 kHz with sub-millisecond attacks, and a payout cascade with no voice in
it. 36 KB in total.

Impact loudness follows the contact impulse planck reports. The thresholds are
set so the machine gives one to three audible ticks per flick, which is what the
video's audio does.

## Running it

Expo Go is enough — the app is pure JavaScript.

```
npx expo start
```

Development switches, both off unless you set them:

- `EXPO_PUBLIC_AUTOPLAY=1` in `.env.local` makes the machine insert and flick on
  its own, logging every outcome. This is how the whole loop gets exercised
  without a pair of hands. On web, `?autoplay` does the same.
- `EXPO_PUBLIC_KITE_URL` / `EXPO_PUBLIC_KITE_TOKEN` wire up remote control in
  development builds only. `.env.local` is not committed.
