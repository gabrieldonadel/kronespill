# Kronespill

An Exact2 port of the Norwegian coin-flick machine also known as a
*knipsekasse* or *kroneautomat*.

The cabinet is authored in Contract, while deterministic Rust owns the 240 Hz
simulation, Rapier collision world, tube stock, payouts, sound cues, and saved
game state. The original photographed 1983 Olav V krone and the seven samples
cut from a real machine live under `art/` and are baked by Exact2.

## Controls

| Control | Action |
| --- | --- |
| **LEGG PÅ MYNT** / `I` | Insert one krone. |
| **KNIPS** / hold `Space` | Charge the flick; release to launch. |
| Coin bowl / `C` | Move winnings back into the player's bank. |
| `R` | Refill with 20 kroner after the bank and bowl are empty. |

The nine pockets pay **3 2 3 2 10 3 2 3 2**. A win is paid from the fuller of
the two tubes behind its pocket. A miss joins the nearest tube with room; a
full machine sends the coin through the centre cash-box chute.

## Run

Use an Exact2 checkout through `EXACT2`, or keep it as a sibling directory:

```sh
export EXACT2=../exact2
PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH" \
  bun "$EXACT2/game/dev.mjs" .
```

The same app targets web, macOS, iOS, and Linux. Exact2's game shell is
generated under `.shells/`; baked assets go under `assets/`; neither is source.

## Verify

```sh
PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH" \
  bun "$EXACT2/game/app/shells.mjs" . --test

bun "$EXACT2/game/prove.mjs" .
```

`logic/tests/sim.rs` checks payout accounting, insert/flick state transitions,
and deterministic replay. `proof.mjs` drives the real host and captures the web
surface; the first Linux/web run establishes `pins.json`.
