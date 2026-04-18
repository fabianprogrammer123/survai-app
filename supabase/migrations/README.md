# Supabase Migrations

Forward-only SQL files that bring a fresh database to the current schema.

## Naming convention

```
YYYYMMDDHHMMSS_short_snake_case_description.sql
```

The timestamp prefix sorts files chronologically and ensures global uniqueness across branches. Pick the timestamp at the moment you create the file (UTC).

## Idempotency

Every migration must be safely re-runnable. Patterns to use:

| Construct | Idempotent form |
|---|---|
| Table | `CREATE TABLE IF NOT EXISTS public.foo (...)` |
| Column add | `ALTER TABLE foo ADD COLUMN IF NOT EXISTS x text` |
| Index | `CREATE INDEX IF NOT EXISTS idx_foo_x ON foo(x)` |
| Function | `CREATE OR REPLACE FUNCTION ...` |
| Policy | `DROP POLICY IF EXISTS "name" ON foo; CREATE POLICY "name" ...` |
| Trigger | `DROP TRIGGER IF EXISTS name ON foo; CREATE TRIGGER name ...` |

Reason: the canonical migration file gets re-applied to the production project on schema changes; non-idempotent migrations either crash on re-run or leave orphaned objects.

## How to apply

### To the live project (via the Supabase Dashboard)

1. https://supabase.com/dashboard/project/<your-ref>/sql/new
2. Paste the file's contents
3. Click "Run"
4. Verify expected tables/policies/etc appear in Dashboard → Table Editor

### To the live project (via Supabase MCP, when wired up)

```
mcp__plugin_supabase_supabase__apply_migration with name="<short_name>" query="<sql>"
```

The MCP tracks migrations in `supabase_migrations.schema_migrations` automatically. The dashboard SQL Editor does not — it just runs SQL.

### To a local Supabase instance (if you spin one up)

```bash
supabase db reset  # destroys + re-applies all migrations from scratch
```

## How to verify a migration matches the live schema

Quick checklist after applying:
1. `mcp__plugin_supabase_supabase__list_tables` — all expected tables present, RLS enabled
2. Spot-check one query that exercises the new RLS policies
3. Run the smoke chain in [docs/BACKEND-AUDIT.md](../../docs/BACKEND-AUDIT.md#how-to-re-run-the-verification-chain)

## When to add a new migration vs. update an existing one

- **Add a new file** if the change has been applied to a project anyone else might be using. Forward-only history.
- **Update an existing file** only if it hasn't been applied anywhere yet (e.g. you're still iterating on the canonical schema during initial setup).

The current state (as of M0):
- `20260417000000_base_schema.sql` — canonical baseline. Has been applied to the live project (`shgsuahugiiuyopwyxtp`) as three separate migrations during development; the consolidated file gives fresh installs the same final schema in one shot.

## Anti-patterns

- ❌ `DROP TABLE` in a migration that runs against a project with real data — wraps you in a recovery story you don't want
- ❌ Inline `INSERT` of seed data — keep seed data in a separate `seeds/` directory, not in migrations
- ❌ Hardcoding a generated id (`INSERT ... VALUES ('11111111-...', ...)`) — use defaults, references, or look-ups
- ❌ Putting RLS-bypassing logic in a `SECURITY DEFINER` function without explicit `SET search_path = public` — opens a search-path injection vector
