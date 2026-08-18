---
name: Expo workflow port
description: Replit preview workflow behavior for this imported Expo app
---

The imported Expo `dev` script reads `$PORT`; Replit's workflow configuration may not provide that variable automatically. Bind the workflow command explicitly with `PORT=5000` when starting the web preview.

**Why:** Without an explicit port, Expo exits with `option requires argument: --port` before Metro starts.

**How to apply:** Keep the project's existing Expo command and configure the preview workflow as `PORT=5000 pnpm run dev`; do not rewrite the app's run script just for workflow setup.