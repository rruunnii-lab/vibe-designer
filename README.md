# Vibe Designer

A Figma plugin that bridges Figma and Claude Code for AI-powered design manipulation.

## What it does

Vibe Designer lets you control Figma designs through natural language via Claude Code. It scans your Figma layers, sends the data to a local bridge server, and applies AI-generated operations back to your design.

### Tabs

- **Designer** — Scans components, text, and instances from your selection. Claude Code reads the scan and writes operations (rename, move, create, delete, swap variants, etc.) that the plugin auto-applies. Results show per-node cards with before/after thumbnails and click-to-navigate.
- **Refresh** — Force-refreshes all nested component instances in a selected frame after library updates. Preserves variant and boolean selections. Shows frame-level before/after thumbnails with per-instance skip reasons.
- **Matrix** — Deep scans a selected screen to find all configurable variant/boolean properties in nested instances. Generates all combinations as duplicated screens (up to 200).
- **Variables** — Scans Figma variables and collections for use in operations.

## Setup

1. In Figma, go to **Plugins > Development > Import plugin from manifest** and select `manifest.json` from this repo
2. Start the bridge server (requires Node.js):
   ```
   node server.js
   ```
   The server runs on `localhost:9800`.
3. Open the plugin in Figma — it connects to the bridge server automatically

## How it works

```
Figma Plugin  <-->  Bridge Server (localhost:9800)  <-->  Claude Code
                         |
                    figma-components.json  (scan data)
                    figma-renames.json     (operations)
```

1. Plugin scans your Figma selection and posts component/text/instance data to the server
2. Claude Code reads the scan data and writes operations to `figma-renames.json`
3. Plugin detects the new operations file and auto-applies them to your design
4. Results are displayed with thumbnails, operation details, and locate buttons

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Figma plugin manifest |
| `code.js` | Plugin sandbox (ES5) — handles Figma API calls, instance refresh, thumbnails |
| `ui.html` | Plugin UI — tabs, result cards, bridge server communication |

## Constraints

- `code.js` must remain ES5-compatible (no arrow functions, const/let, template literals)
- The plugin sandbox cannot use `btoa()` — raw image data is sent to the UI iframe for base64 conversion

## Created by

Shurun Y.
