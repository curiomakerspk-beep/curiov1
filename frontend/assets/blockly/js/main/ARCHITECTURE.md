# js/main — Blockly workspace logic

This folder replaces the old `js/block_01.js` … `js/block_05.js` (kept as
`.bak` files one level up, in `js/`, for reference — do not delete them, they
back the reconstruction check described below).

## Why these files, in this order

All files here are loaded from `index.html` as plain `<script defer>` tags
(no bundler, no ES modules — this is a hand-built Blockly IDE, not a React
app). Classic deferred scripts execute **in the order they appear in the
HTML**, sharing one global scope, exactly as if they were one concatenated
file. That constraint drove every decision below:

- **The split points are cut-only, never reorder.** Every file here is a
  *contiguous slice* of the original `block_01.js`–`block_05.js`, in their
  original relative order. Nothing was moved earlier or later than where it
  already ran. This was verified mechanically: concatenating every file back
  together in load order reproduces the original source byte-for-byte.
- **Some target topics ended up as more than one file** because the same
  topic's code was not contiguous in the original — and reordering
  non-contiguous code to merge it into one topic file is exactly the kind of
  change that can silently break something (a variable used before its new
  earlier position would have defined it, an event handler now registered in
  a different order). See "Known deviations" below.

## File map (load order)

| # | File | Lines in old block_02.js | Contents |
|---|------|---------------------------|----------|
| 1 | `toolbox-config.js` | *(was block_01.js)* | `window.toolboxConfig` — the category toolbox definition |
| 2 | `terminal-state.js` | 1–606 | Terminal/response panel state, `Blockly.Python` alias setup |
| 3 | `bluetooth.js` | 607–860 | BLE scan/connect/notify (`BLE_SERVICE_UUID` etc.) |
| 4 | `usb-serial-and-transport.js` | 861–1662 | USB/Web Serial, disconnect helpers (USB *and* BLE), unified command/upload, status display, WiFi/MQTT |
| 5 | `modals.js` | 1663–2827 | Port/Motor/Servo/LED/Keypad selection modals |
| 6 | `block-styling.js` | 2828–3269 | Block gradients/shadows (CSS-in-JS) |
| 7 | `custom-fields.js` | 3270–3461 | Custom RGB picker field |
| 8 | `block-definitions.js` | 3462–4643 | `defineBlocks()` — every custom Blockly block |
| 9 | `python-generators.js` | 4644–5274 | `defineGenerators()` — Python codegen per block |
| 10 | `button-lock-mutex.js` | 5275–5353 | Run/Stop button lock/mutex system |
| 11 | `training-3d-misc.js` | 5354–5595 | 3D speedometer modal (Three.js) |
| 12 | `simulation-modal.js` | 5596–5719 | 3D simulation modal (10 simulations) |
| 13 | `model-viewer-3d.js` | 5720–5921 | Generic 3D model viewer modal |
| 14 | `app-init.js` | 5922–9594 | `async function start()` — the entire boot/wiring sequence (see below — kept as one file deliberately) |
| 15 | `live-mode-engine.js` | 9595–10102 | `LiveModeEngine` — real-time hardware feedback |
| 16 | `panel-toggle-and-boot.js` | 10103–10144 | Panel-view toggle, project dropdown, `window.addEventListener('load', start)` |
| 17 | `cross-page-integration-1.js` | 10145–10505 | Open AI/voice/pose/board screens (postMessage to `App.js`), apply trained AI/voice classes |
| 18 | `bike-3d-model.js` | 10506–10849 | Bike 3D model modal (Three.js) |
| 19 | `cross-page-integration-2.js` | 10850–10944 | Apply trained pose classes, `window.addEventListener('message', …)` receiver, standalone-browser sessionStorage fallbacks |
| 20 | `port-label-field-patch.js` | 10945–10992 | Patches `Blockly.Field.getText` so pins show as P1/P2… instead of D3/E0… |
| 21 | `flyout-patch.js` | *(was block_03.js)* | Flyout position/corner-radius patch |
| 22 | `devices-panel.js` | *(was block_04.js)* | Devices panel USB/BLE status polling |
| 23 | `code-panel-tabs.js` | *(was block_05.js)* | Code panel tab switcher, chat functions — **this is the `cyclePanelView` implementation that actually wins** (see below) |

## Known deviations from a "perfect" split

**`app-init.js` is 3,673 lines — the biggest file here by far.** It is the
body of a single `async function start()` that Blockly's `window.onload`
calls to boot the whole workspace. Inside it are sub-concerns (block search,
a particle-effects engine, the workspace change-listener, file menu/storage
logic) that *look* like they deserve their own files — but they're declared
as nested functions inside `start()`'s closure, not top-level. Pulling them
out would mean turning private nested functions into globals and is a real
scoping change, not a pure move. I left it intact rather than risk that.

**"training-3d-misc" content is split across two files that aren't adjacent
in the load order:** `training-3d-misc.js` (the speedometer, position 11) and
`bike-3d-model.js` (position 18). They're both "misc 3D training modals" by
topic, but ~4,900 lines of unrelated code (block definitions, codegen,
app-init, live-mode-engine) run between them in the original file. Merging
them into one `training-3d-misc.js` would mean moving the bike-modal code
earlier by thousands of lines — a reorder, not a cut. I gave the second one
its own honest name (`bike-3d-model.js`) instead.

**"cross-page-integration" is likewise two files** (`-1.js` and `-2.js`),
because `bike-3d-model.js` sits between them in the original source (same
reasoning as above).

**A pre-existing dead-code duplicate, preserved as-is:** `panel-toggle-and-boot.js`
contains a `window.cyclePanelView = function () {...}` — but `code-panel-tabs.js`
(the old `block_05.js`) *also* defines `function cyclePanelView() {...}`, and
loads after it. In the browser, the later plain function declaration wins, so
**`code-panel-tabs.js`'s version is the one that actually runs**; the one in
`panel-toggle-and-boot.js` is shadowed/dead. This was already true before this
refactor (it's an artifact of the original block_02.js/block_05.js split) —
I preserved the exact same load order so the same one keeps winning, rather
than "fixing" it and risking a behavior change nobody asked for.

## Verification performed

- Concatenating files 2–20 in the table above, in order, reproduces the old
  `js/block_02.js.bak` byte-for-byte.
- Files 1, 21, 22, 23 are byte-identical copies of `block_01/03/04/05.js.bak`.
- Every file in this folder parses as valid JavaScript (Babel, `sourceType: "script"`).
- **Not verified:** actual runtime behavior in a browser/WebView. This is core
  app logic (BLE, USB, camera-adjacent training hooks, 3D viewers, block
  codegen) — please click through Bluetooth connect, USB upload, block
  search, the 3D speedometer/simulation/model-viewer/bike modals, live mode,
  and the devices panel before trusting this in production.
