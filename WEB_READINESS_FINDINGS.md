# Kronespill web-readiness findings

Date: 2026-10-02  
Audited deployment: <https://kronespill-exact2--r4khwmsl2c.expo.app>  
Audited app commit: `1594e49`  
Exact2 commit: `b2b863d7` plus local compatibility patches

## Executive summary

The deployment is a valid Exact2 web build, but it is not yet a production-ready
web version of Kronespill. The basic game loop works in desktop Chrome with
WebGPU: the app initializes, accepts insert/charge/release input, advances the
simulation, and renders the 3D world. The problems are in browser compatibility,
responsive composition, audio, persistence, migration parity, and verification.

The highest-priority work is:

1. Add a supported-browser gate and a visible fallback/error state for devices
   without a usable WebGPU adapter.
2. Give the cabinet and camera one stable aspect-ratio/layout model so the HUD,
   controls, labels, and rendered machine stay aligned at every viewport size.
3. Fix and verify WebAudio unlocking from touch input, especially Mobile Safari.
4. Persist the saved game in browser storage and restore it after reload.
5. Restore the original machine's interaction and presentation features, then
   reinstate its statistical and browser-level verification.

## What works now

- The static deployment and all required WebAssembly and asset URLs return HTTP
  200.
- In current desktop Chrome with WebGPU, Exact2 finishes initialization and the
  world reports 166 stock coins and a 20-krone player bank.
- Keyboard input works: `I` inserts a coin, holding and releasing Space sets the
  power and launches it.
- Emulated touch input in Chrome works for the basic loop: tap insert, hold the
  flick button, and release to launch.
- The three Rust unit/integration tests pass: payout source selection,
  insert/release state transition, and deterministic replay.

These checks prove the core loop exists. They do not prove browser coverage,
presentation parity, audio, persistence, or the original game's economics.

## Blocking findings

### P0 — No WebGPU compatibility handling

The game world is an Exact2 GPU module and requires a usable browser graphics
adapter. When `navigator.gpu` is unavailable, the Exact2 shell still renders the
HUD, marks the root as no longer busy, leaves the bank and stock at zero, disables
the controls, and only writes this to the developer console:

```text
exact gpu: no adapter: No suitable graphics adapter found
```

To a player this looks like a broken, empty machine. There is no explanation,
retry action, browser requirement, or non-WebGPU renderer.

Required feature:

- Detect GPU-module initialization success before presenting the game as ready.
- If no adapter is available, show an accessible compatibility panel with the
  browser/OS requirement and a retry action.
- Preferably provide a Canvas 2D/WebGL fallback or a non-interactive cabinet
  preview; otherwise explicitly define WebGPU as the minimum requirement.
- Test this path by forcing `navigator.gpu` unavailable and by refusing adapter
  creation.

### P0 — Cabinet layout and rendered world use different coordinate systems

`app.contract` lets the canvas take all remaining space (`width="100%"`,
`flex=1`) without preserving the cabinet's proportions. The payout labels and
controls are positioned as percentages of that responsive DOM box, while the
machine is rendered through an orthographic world camera. They only line up at
some aspect ratios.

At a tested short landscape viewport, the nine payout labels spread across the
whole canvas while the rendered pockets occupy only the center. The control row
overlaps the tube bank, and the right-side instruction plate is clipped. Mobile
portrait produces a very tall canvas, while desktop produces a wide, short one.

Required feature:

- Define one cabinet aspect ratio from the original `100 x 122` glass plus its
  frame/tray, and fit it inside the viewport with letterboxing as needed.
- Place pocket labels, the side plate, tray, and controls in cabinet coordinates,
  not independent viewport percentages.
- Either keep all cabinet chrome inside the GPU surface or publish projected
  anchor geometry to Contract so DOM overlays track the rendered pockets.
- Add viewport checks for at least 390x844 portrait, 844x390 landscape,
  768x1024 tablet, and 1280x720 desktop.

### P0 — Touch does not reliably unlock web audio

The game creates a suspended `AudioContext`, as browsers require. Under Chrome's
mobile/touch emulation, the first trusted `pointerdown` calls `resume()`, but the
context remains suspended and Chrome reports that it was not allowed to start.
The input and simulation continue, so the failure presents as a silent machine.

This is a host-level Exact2 issue or ordering issue rather than missing audio
files; all seven samples are deployed. It must be confirmed on the target iPhone
because browser user-activation rules differ by browser and input type.

Required feature:

- Resume or create the audio context synchronously inside a browser-accepted
  user activation (`pointerdown`, `touchend`, or explicit “Enable sound” action).
- Keep the first requested sound until audio becomes ready instead of dropping it.
- Expose sound readiness/failure to the UI and restore the original mute toggle.
- Verify on real Mobile Safari and Chrome/Edge desktop, not only with simulated
  game input.

### P0 — Browser state is not persisted

After inserting a coin, the bank changes from 20 to 19. Reloading the page resets
it to 20; both `localStorage` and `sessionStorage` remain empty. The migration's
README says the game has saved state, but no browser persistence is wired into
the deployed app.

Required feature:

- Save the Exact2 world snapshot or a versioned `Machine` record after meaningful
  state changes.
- Restore it at startup, including bank, tray, statistics, tube counts, and any
  in-progress-round policy.
- Handle corrupt/old saves and provide an intentional reset action.
- Add reload, new-tab, and schema-version tests.

## Missing migration parity

The Exact2 version is currently a functional reinterpretation, not a feature-
complete port of the original app.

| Original feature | Exact2 web status | Needed work |
| --- | --- | --- |
| Drag-down mechanical lever | Replaced by press-and-hold button | Restore a vertical drag gesture, knob movement, and release threshold while retaining keyboard access. |
| Detailed photographed cabinet | Replaced by a sparse 3D board | Restore the airbrushed field, crowns, starburst, launch channel, chrome details, glass, sill, and tray. |
| Individual two-faced coin stacks | Replaced by gold cuboid bars | Render individual coins/faces and keep them synchronized with stock. |
| Dynamic stack tops are collision surfaces | Stock bars have no colliders; misses are assigned to the nearest open tube after crossing a threshold | Rebuild physical stack surfaces when counts change, or reproduce the original tested landing model. |
| Visible payout cascade into a coin bowl | Immediate stock/count change plus sound | Animate each paid coin from its source tube into the tray and make the tray visibly collectible. |
| Impact-weighted sound | A fixed-gain clink is selected on contact begin | Use collision impulse to scale/select impact audio and keep the original cooldown behavior. |
| Sound on/off control | Missing | Add a persistent mute control and accessible state label. |
| Haptic feedback | Missing | Restore on native targets; document that ordinary web pages cannot guarantee equivalent haptics. |
| Autoplay smoke mode | Missing | Add an equivalent deterministic development mode or replace it with an automated host test. |
| Responsive whole-cabinet scaling | Missing | Fit a single coherent machine rather than independently scaling the world and overlays. |
| App icons/favicon/install polish | Manifest has no icons and declares `lang: en` | Add install icons/favicon, Norwegian language metadata, and install/offline behavior if PWA installation is desired. |

## Simulation and correctness gaps

The original repository had checks for geometry validity, 756 no-escape probe
drops, payout accounting, a 4,000-round economy simulation, power-band resonance,
hit distribution, flight duration, and tube behavior. Those checks were removed
in the migration. The replacement has three tests and an empty, unverified
`pins.json` baseline.

This matters because the underlying model changed from the tuned 2D Planck board
to a Rapier-based 3D scene with simplified resolution rules. Determinism alone
does not show that the migrated machine has the intended hit rate, payback,
flight times, pocket distribution, or no-escape behavior.

Required verification:

- Port the geometry and no-escape probes to the Exact2 simulation.
- Run a seeded multi-thousand-round economy test and set accepted ranges for hit
  rate, payback, house edge, flight duration, and all-nine-pocket coverage.
- Verify every tube profile: empty, full, photographed V, and ragged.
- Establish `pins.json` with Linux/web agreement rather than leaving it
  `unverified`.
- Add a real web-host test for startup, touch insert/hold/release, audio unlock,
  resize/orientation, collect, refill, reload/restore, and unsupported WebGPU.

## Build and delivery gaps

- The deployed static payload is about 5.5 MB before transport compression,
  including an approximately 3.2 MB GPU WebAssembly module and an approximately
  0.8 MB app WebAssembly module. The app module was built without `wasm-opt`.
- The current build required uncommitted compatibility changes in the Exact2
  checkout (generated shell API updates, web capability linkage, and build-script
  dependency resolution). A clean Exact2 checkout cannot yet be assumed to
  reproduce this deployment.
- This URL is an EAS preview deployment, not the production alias/custom domain.

Required feature/work:

- Land or pin the Exact2 compatibility fixes and prove a clean-clone build.
- Install `wasm-opt`, compare compressed transfer sizes, and remove assets or
  optional modules not needed by this app.
- Add immutable caching for content-addressed assets and verify repeat-load
  behavior.
- Promote only after the compatibility and acceptance checks pass.

## Recommended implementation order

1. **Make failure honest:** GPU capability gate, loading state, and visible error.
2. **Fix the viewport model:** one cabinet aspect ratio and aligned overlays.
3. **Fix input/audio on hardware:** real iPhone Safari test, audio unlock, mute.
4. **Add persistence:** versioned save/restore plus reset.
5. **Restore gameplay presentation:** lever, stack coins/colliders, payout/tray,
   cabinet artwork, impact-scaled sound.
6. **Restore proof:** simulation ranges, no-escape tests, proof pins, web browser
   matrix, and clean-clone build.
7. **Optimize and release:** wasm optimization, PWA metadata if desired, then an
   EAS production deployment.

## Definition of “works properly on web”

The web release is ready when all of the following are true:

- A supported browser reaches an interactive machine without console errors.
- An unsupported browser receives a clear, actionable message instead of a
  zeroed, disabled machine.
- Touch and keyboard can complete insert, variable-strength flick, settlement,
  payout, collect, and refill.
- Sound starts after the first intentional interaction and can be muted.
- Portrait, landscape, tablet, and desktop layouts keep every cabinet element
  visible and aligned.
- Reload restores the player's state.
- Seeded simulation results remain inside agreed economic/physics ranges and no
  coin escapes.
- A clean checkout can reproduce and deploy the build without local framework
  patches.

