# SQLite to D1 migration

Local Flask development can continue using SQLite. Production uses Cloudflare
D1 because a Worker filesystem does not provide durable SQLite persistence.
The migration is optional when the local database contains only test data.

The exporter opens SQLite in read-only mode and writes an ignored SQL file under
`migration-private/`. It creates deterministic source keys, so importing the
same export more than once does not duplicate contacts or chat rows.

## 1. Classify and back up the source

Stop the local Flask process so the database has no active write transaction.
Make an encrypted copy of `instance/portfolio.db`. Determine whether its contact
and chat records are real user data or development fixtures.

Chat rows are excluded by default because old browser session IDs cannot be
trusted as production authorization and local rows are commonly test data.
Import chat only after an explicit privacy and usefulness review.

## 2. Generate the private import

```powershell
python scripts/export_sqlite_to_d1.py
```

For an alternate source path:

```powershell
python scripts/export_sqlite_to_d1.py --source D:\secure\portfolio.db
```

Only when reviewed chat data must be retained:

```powershell
python scripts/export_sqlite_to_d1.py --include-chat
```

The exporter reports counts, never field contents. Inspect the generated file
on a trusted machine. `migration-private/` is Git-ignored and must remain so.

## 3. Initialize D1

The deployment workflow applies `migrations/0001_initial.sql` and
`0002_chat_migration_key.sql`. Before a manual import, verify their status:

```powershell
$env:CLOUDFLARE_D1_DATABASE_ID = "your-d1-uuid"
$env:SITE_URL = "https://your-final-origin.example"
$env:TURNSTILE_SITE_KEY = "your-public-site-key"
python scripts/render_deploy_config.py
node scripts/wrangler.mjs d1 migrations list portfolio --remote --config .generated/wrangler.production.json
node scripts/wrangler.mjs d1 migrations apply portfolio --remote --config .generated/wrangler.production.json
```

## 4. Import and verify

```powershell
node scripts/wrangler.mjs d1 execute portfolio --remote --config .generated/wrangler.production.json --file migration-private/sqlite-import.sql
node scripts/wrangler.mjs d1 execute portfolio --remote --config .generated/wrangler.production.json --command "SELECT COUNT(*) AS contacts FROM contacts"
node scripts/wrangler.mjs d1 execute portfolio --remote --config .generated/wrangler.production.json --command "SELECT COUNT(*) AS chats FROM chat_messages"
```

Compare counts with local read-only counts. Avoid printing names, email
addresses, or messages into terminal transcripts or CI logs.

Re-run the same import once as an idempotency check; counts must remain
unchanged. Then submit a production test contact using an address you control,
record its ID, redeploy the Worker, and query the ID again. This proves the live
runtime uses D1 and that data survives deployment.

## 5. Rollback and retention

Keep the source SQLite backup unchanged until production acceptance is complete.
For a failed import, create a fresh D1 database, apply migrations, correct the
private export, and import into the new database. Switch the GitHub
`CLOUDFLARE_D1_DATABASE_ID` variable only after verifying counts. This is safer
than deleting rows from the live database.

After acceptance, securely delete unnecessary plaintext exports and test data.
Retain encrypted backups according to the portfolio privacy policy. The runtime
automatically removes chat messages older than 30 days; contact rows require an
operator-defined retention/deletion process.
