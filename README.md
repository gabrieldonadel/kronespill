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
| **Lever** | Drag down to set the flick, release to shoot the coin up the chute. |
| **Coin bowl** | Tap it to pocket your winnings. |

A coin that drops into a crown hole pays what the shield says, out of the tube
stock behind it. A coin that misses rolls off the rail and the machine keeps it.

## The board

`src/engine.ts` holds the geometry and the physics. Everything is in board
units, where the glass is 100 wide and a 1-krone coin is 4.4 across, which makes
one unit about 4.8 mm on the real cabinet.

The same `step()` runs in a Reanimated worklet on the phone and in plain Node in
`scripts/`, so the machine is balanced and checked away from a device.

```
node scripts/check-board.mjs   # geometry faults
node scripts/sim.mjs 15000     # payback, hit rate, flight time
node scripts/grid.mjs 1500     # sweep the tuning knobs
node scripts/resonance.mjs 230 330 400 30   # hunt exploitable flick strengths
```

Current board, over 15 000 simulated flicks:

| | |
| --- | --- |
| hit rate | 26.3% |
| payback | 0.863 kr per krone played |
| house edge | 13.7% |
| flight | 0.97 s mean, 3.8 s worst |
| jammed coins | none |
| jackpot | 2.5% of flicks, a third of all payout |

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

- A hole only takes a coin that is dropping and not skating sideways
  (`vyCapture`, `vxCapture`). On the real cabinet the coin rolls on its edge and
  rides straight over a hole unless it is nearly stopped above it; in two
  dimensions that has to be stated explicitly, and it is what keeps the machine
  ahead of the player.
- The chevron rail and the tube bank are drawn, not simulated. By the time a
  coin reaches them the round is already decided.
- A coin balanced on a pin gets nudged, the way a real cabinet is never quite
  still. After too long it counts as lost rather than hanging the game.

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
