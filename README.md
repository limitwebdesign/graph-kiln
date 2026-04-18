# GraphKiln

**Browser-native local-first graph reasoning workspace.**

GraphKiln is a serious static prototype for working with notes, links, code, screenshots, and entities on a graph canvas without needing a backend to get started. It stores workspace state locally first, builds inferred links, replays history, ranks related nodes with WebAssembly, clusters work off the main thread, and exposes an optional WebGPU benchmark for browser-side compute checks.

## Why this repo exists

This repo is meant to prove synthesis, not just features.

It combines:
- local-first storage
- graph UI
- worker-based analysis
- WebAssembly scoring
- offline-first delivery
- clean extension points for future on-device model adapters

## What ships in this build

- local-first persistence via IndexedDB with localStorage fallback
- graph canvas with draggable nodes
- note, link, code, image, and entity nodes
- inferred links and keyword clustering
- action-log replay
- JSON export and deterministic merge import
- WebAssembly vector scoring
- optional WebGPU benchmark
- offline cache and PWA manifest
- static hosting model with no backend required

## Run locally

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Rebuild the TypeScript output

```bash
tsc -p tsconfig.json
```

## Smoke tests

```bash
node tests/smoke.mjs
```

## Recommended GitHub setup

Repository name:
`graph-kiln`

Description:
`Browser-native local-first graph reasoning workspace with offline storage, WebAssembly scoring, worker clustering, replay, and optional WebGPU compute.`

Topics:
`local-first, webassembly, webgpu, graph, workspace, browser, offline-first`

## Runtime notes

- Works without a backend
- Saves locally and exports portable JSON
- Uses a static service worker for offline cache
- WebGPU is optional and probed at runtime
- WebAssembly is included in `./wasm/graph_score.wasm`

## On-device AI stance

This build stays honest:
- it ships a real local-first graph workspace
- it ships real browser compute hooks
- it does **not** pretend to bundle giant models
- it leaves clean extension points for later ONNX / Transformers.js adapters

## Identity

Author:
**Viorel Ciprian Brisc**  
https://www.limit.ro/viorel-brisc.html
