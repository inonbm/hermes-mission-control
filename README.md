# Hermes Mission Control

Independent internal control room for Hermes agents.

## What is included
- `supabase/migrations/0001_hermes_mission_control.sql`
- `scripts/apply-migration.sh` for Postgres environments that provide `SUPABASE_DB_URL`

## Environment
Create a `.env` file with:

```bash
VITE_SUPABASE_URL=https://mntnswwzaywvtethbqhi.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

The browser dashboard uses the anon key. The Hermes telemetry publisher accepts the service role key in server-side runtime only.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
