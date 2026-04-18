# GraphKiln architecture

GraphKiln is intentionally shipped as a **dependency-light static application** so it can be uploaded to GitHub and served immediately.

## Core planes

### 1. Local-first workspace plane
- Workspace state is stored locally using IndexedDB with a localStorage fallback.
- Every meaningful mutation appends to an action log.
- Exported JSON is portable and mergeable.

### 2. Merge plane
This build does **not** pretend to be a full CRDT runtime.
Instead it uses:
- append-only action history
- Lamport-style counters
- deterministic last-writer-wins node merge
- id-based edge union
- portable workspace JSON import / merge

That keeps the repo grounded while still demonstrating a real local-first model.

### 3. Visual reasoning plane
- Graph nodes: note, link, code, image, entity
- Inferred links
- Worker-based clustering
- Spatial auto-layout
- Replay over the action history

### 4. Native compute plane
- WebAssembly module for vector scoring
- optional WebGPU benchmark for browser-side compute checks
- heuristic summaries that work without remote services

### 5. Offline plane
- service worker for static asset caching
- installable manifest
- fully static hosting model

## Identity
Author URL:
https://www.limit.ro/viorel-brisc.html

Schema entity id:
https://www.limit.ro/viorel-brisc.html#person
