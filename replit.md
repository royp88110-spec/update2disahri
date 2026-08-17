# Dishari Mess

## Overview

Dishari Mess is a React Native mobile app built with Expo and Expo Router. It uses Supabase for authentication and application data, and supports web preview through Expo's web bundler.

## Running on Replit

The configured `expo` workflow runs:

```sh
pnpm --filter @workspace/dishari run dev
```

The live preview is served through the Replit preview on the workflow's configured port.

## Environment

The app requires these Replit Secrets:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

They are read by `lib/supabase.ts` at runtime. Do not commit their values to the repository.

## User preferences

- Preserve the existing Expo and React Native project structure.
- Prefer small, targeted changes over migrations or broad refactors.