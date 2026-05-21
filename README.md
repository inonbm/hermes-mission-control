# Hermes Mission Control

Independent internal control room for Hermes agents.

## What is included
- `supabase/migrations/0001_hermes_mission_control.sql`
- `supabase/migrations/0002_agent_telemetry_handoff_to.sql`
- `scripts/apply-migration.sh` for Postgres environments that provide `SUPABASE_DB_URL`
- `scripts/verify-e2e.ts` for end-to-end telemetry verification

## Environment
Create a `.env` file with:

```bash
VITE_SUPABASE_URL=https://mntnswwzaywvtethbqhi.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

The browser dashboard uses the anon key. The Hermes telemetry publisher and E2E verifier accept the service role key in server-side runtime only.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run verify:e2e`
