# Testing notes

This package was validated with:
- TypeScript compilation via `tsc -p tsconfig.json`
- WebAssembly module compilation with clang
- Node smoke tests in `tests/smoke.mjs`
- headless Chromium static-page smoke load and screenshot

## Quick commands

```bash
npm run build
npm test
python -m http.server 8080
```
