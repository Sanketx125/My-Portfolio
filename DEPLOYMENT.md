# Production deployment

The selected production platform is Cloudflare Workers Static Assets plus a
JavaScript Worker and D1. GitHub Actions builds and deploys it. A `workers.dev`
hostname provides HTTPS without buying a domain.

Cloudflare and Brevo account creation cannot be automated from this repository.
Do not enable a paid Cloudflare plan or enter a card for this deployment. If the
signup shown to this account requires a card or temporary authorization, stop:
that account-specific condition has not been verified. Brevo documents that its
Free plan needs no card.

## Accounts and free-plan boundaries

| Service | Purpose | Selected free boundary |
|---|---|---|
| GitHub | Source, CI, deployment trigger | Actions limits depend on repository visibility and account plan |
| Cloudflare Workers | Static site and `/api/*` | 100,000 dynamic requests/day, 10 ms CPU/invocation, 128 MB |
| Cloudflare Static Assets | HTML/CSS/JS/images | Static requests do not consume Worker request quota |
| Cloudflare D1 | Contacts, chat, cache, limits, outbox | 5M rows read/day, 100k rows written/day, 500 MB/database, 5 GB/account |
| Cloudflare Turnstile | Bot challenge | Free plan; widget and hostname limits apply |
| Brevo | Owner notification and visitor reply | 300 email sends/day; one contact normally uses two sends |
| LLM provider | AI answers | Separate provider quota/cost; repository caps cannot make a paid model free |
| GitHub API | Portfolio statistics | GraphQL limits attached to the chosen token |

Workers Free limits fail requests rather than silently upgrading capacity. D1
includes seven-day Time Travel according to the current Cloudflare Free limits.
There is no uptime SLA on the selected free services.

## 1. Create the provider resources

1. Create or sign in to a Cloudflare Free account and enable its `workers.dev`
   subdomain. Record the account ID.
2. Install dependencies and authenticate Wrangler on a trusted computer:

   ```powershell
   npm ci
   npx wrangler login
   ```

3. Create the D1 database:

   ```powershell
   npx wrangler d1 create portfolio
   ```

   Record the returned database UUID. It is an identifier, not a credential.
4. In Cloudflare Turnstile, create a **Managed** widget for the final hostname.
   Record the public site key and keep the secret key private.
5. Create a Brevo Free account. Verify the sending address or domain that will
   be used as `MAIL_FROM`, create a transactional API key, and retain it only
   for Cloudflare secret entry.
6. Create an LLM API key with the smallest available budget and permissions.
   The runtime expects an HTTPS OpenAI-compatible `/chat/completions` API.
7. Optional: create a GitHub token for the dashboard. Grant only the read access
   required for the selected account. Private repository names are never queried;
   only `totalCount` is requested. A public-only token is preferable if the
   private count is unnecessary.

## 2. Configure GitHub

In repository **Settings → Environments**, create `production`. Restrict it to
the `main` branch. Required reviewers are optional; enabling them makes a push
wait for approval instead of deploying immediately.

Add these **production environment variables**:

| Variable | Value |
|---|---|
| `CLOUDFLARE_D1_DATABASE_ID` | UUID returned by `wrangler d1 create` |
| `SITE_URL` | Exact final HTTPS origin, without a trailing slash |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key |

For a `workers.dev` deployment, `SITE_URL` normally has the form
`https://sanket-portfolio.<account-subdomain>.workers.dev`.

Create a narrow Cloudflare API token for CI. Scope it to this account with
Workers Scripts edit and D1 edit access. Add these **production environment
secrets**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Narrow deployment token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

These two credentials deploy code. They are not copied into the Worker runtime
or public build.

Enable GitHub secret scanning and push protection where the repository/account
plan exposes them. Protect `main` with required CI and CodeQL checks if branch
protection is available.

## 3. First deployment

Merge or push the deployment branch to `main`. The production workflow will:

1. install locked Python and Node dependencies;
2. render the Jinja site with public `SITE_URL` and Turnstile site key;
3. run unit, integration, build, audit, and secret scans;
4. render an ignored production Wrangler config using the D1 UUID;
5. apply additive D1 migrations;
6. deploy static assets and the API Worker;
7. run read-only checks against the production URL.

The first run is a bootstrap deployment. It can create the Worker and D1 schema
before runtime secrets exist, but its final `/api/github` smoke check will fail
closed until `SESSION_SECRET` is installed. This one-time red workflow is
expected: set the runtime secrets in step 4, then rerun **Deploy production**.
The rerun must finish green before launch. Contact and AI return safe unavailable
errors until their own provider secrets are configured.

## 4. Set runtime secrets in Cloudflare

Open **Workers & Pages → sanket-portfolio → Settings → Variables and Secrets**.
Add each sensitive value as an encrypted **Secret**, never as plaintext source
or a GitHub variable:

| Secret | Required | Purpose |
|---|---:|---|
| `SESSION_SECRET` | yes | At least 32 random bytes; signs chat cookies and IP hashes |
| `TURNSTILE_SECRET_KEY` | yes | Server-side Turnstile verification |
| `LLM_API_KEY` | for AI | LLM provider authentication |
| `BREVO_API_KEY` | for email | Brevo transactional API authentication |
| `MAIL_FROM` | for email | Verified sender email |
| `CONTACT_TO_EMAIL` | for email | Owner notification recipient |
| `GITHUB_TOKEN` | for live stats | Primary GitHub GraphQL token |
| `GITHUB_TOKEN_2` | optional | Second account token |

Generate `SESSION_SECRET` locally without printing any other secret:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`MAIL_FROM` and `CONTACT_TO_EMAIL` are treated as secrets because they expose
personal contact information. After saving secrets, deploy the new Worker
version in the Cloudflare dashboard if prompted, then rerun **Deploy production**
from the GitHub Actions page. Do not paste runtime secrets into GitHub Actions.

Public runtime settings are intentionally committed in `wrangler.jsonc`:

- `LLM_API_BASE` and `LLM_MODEL`
- `GITHUB_USERNAME` and optional `GITHUB_USERNAME_2`
- `CHAT_DAILY_BUDGET` and `CONTACT_DAILY_BUDGET`

Edit those non-secret values in source and push normally when they need to
change.

## 5. Acceptance checks

Run the read-only smoke test:

```powershell
python scripts/smoke_test.py https://your-final-origin.example
```

Then complete these manual checks from a normal and a private browser window:

- load the homepage at desktop and mobile widths; inspect the browser console;
- verify GSAP/ScrollTrigger motion and reduced-motion behavior;
- open the map, filter projects, open Ctrl/Cmd+K, toggle the theme, and download
  the résumé;
- submit one real contact, confirm the success response, both emails, and the D1
  contact/outbox records;
- send one general and one recruiter-mode prompt, then a follow-up that depends
  on history;
- reload and confirm browser chat display history; the server conversation is
  bound to the signed HttpOnly cookie;
- verify GitHub live statistics or the safe fallback;
- inspect network responses and built assets for credentials;
- create a contact, redeploy the same commit, and query D1 again to prove the
  record survives deployment.

Inspect production data without exposing message bodies in CI logs:

```powershell
$env:CLOUDFLARE_D1_DATABASE_ID = "your-d1-uuid"
$env:SITE_URL = "https://your-final-origin.example"
$env:TURNSTILE_SITE_KEY = "your-public-site-key"
python scripts/render_deploy_config.py
node scripts/wrangler.mjs d1 execute portfolio --remote --config .generated/wrangler.production.json --command "SELECT id,created_at FROM contacts ORDER BY id DESC LIMIT 5"
node scripts/wrangler.mjs d1 execute portfolio --remote --config .generated/wrangler.production.json --command "SELECT state,COUNT(*) AS total FROM outbox GROUP BY state"
```

Use Cloudflare Workers metrics after realistic cached and uncached API calls.
The Python compatibility measurements are local wall times, and the JS dry run
only proves bundle construction. Production p95 CPU must remain below the Free
plan's 10 ms request limit; treat 8 ms as the review threshold described in
`PYTHON_WORKER_SPIKE.md`.

## Automatic deployments

After bootstrap, the normal path is:

```text
git add .
git commit -m "update portfolio"
git push origin main
```

Pull requests and non-main pushes run CI without deployment credentials. Only a
push to `main` or a trusted manual dispatch runs `.github/workflows/deploy.yml`.
The deployment job has read-only repository permissions and serial production
concurrency.

## Custom domain

A custom domain is optional and domain registration can cost money. Add an
already-owned domain under the Worker's **Domains & Routes**. Then update:

1. GitHub variable `SITE_URL` to the exact new HTTPS origin;
2. the Turnstile widget hostname allowlist;
3. any provider allowlist that references the origin.

Rerun the production workflow. Cloudflare provisions TLS for a correctly
attached domain. Do not add an insecure HTTP origin.

## Backup and restore

Create a consistent D1 SQL export from a trusted workstation. `backups/` is
ignored by Git because it contains personal data.

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
node scripts/wrangler.mjs d1 export portfolio --remote --config .generated/wrangler.production.json --output backups/portfolio.sql
```

Store the export encrypted and restrict access. Schedule the command outside
GitHub if backups must contain production personal data; putting database dumps
in Actions artifacts or logs broadens access unnecessarily. D1 Time Travel is a
short recovery window, not a complete backup policy.

For a controlled restore, create a new D1 database, import the reviewed export,
query its counts, change `CLOUDFLARE_D1_DATABASE_ID`, and redeploy. Keeping the
old database intact makes rollback possible.

```powershell
npx wrangler d1 create portfolio-restore
npx wrangler d1 execute portfolio-restore --remote --file backups/portfolio.sql
npx wrangler d1 execute portfolio-restore --remote --command "SELECT COUNT(*) AS contacts FROM contacts"
```

Do not import over the live database until the restore has been inspected.

## Rollback

For application code, revert the bad Git commit and push `main`; the deployment
pipeline restores the matching source-controlled version. In an emergency,
Cloudflare's Worker version rollback can restore a prior runtime version, but
follow it with a Git revert so source and production agree.

D1 migrations are additive and applied before code deployment. Do not edit or
renumber an applied migration. Restore a database into a new D1 resource when a
data rollback is required.

## Troubleshooting

| Symptom | Check |
|---|---|
| Workflow rejects D1 ID or URL | Variables are present; `SITE_URL` is HTTPS with no trailing slash/path |
| Contact says verification unavailable | Turnstile public key was present during build and secret exists in Cloudflare |
| Turnstile fails after domain change | Widget hostname and `SITE_URL` exactly match the browser origin |
| Contact saved but email absent | Brevo sender verification, API key, outbox state, and 300/day provider limit |
| AI unavailable | LLM secret, model/base URL, provider balance/quota, and global daily budget |
| GitHub fallback remains | Username/token pairing, token access, GraphQL quota, and D1 cache expiry |
| API returns 429 | Per-minute, per-IP/day, or global daily budget reached |
| Static page works but API does not | Worker request quota, D1 quota, secret bindings, deployment logs |
| Local Worker sees missing secrets | Use ignored `.dev.vars`; the wrapper deliberately ignores Flask `.env` |
| Deployment smoke test fails | Verify hostname, deployment URL, and GitHub `SITE_URL`; rerun after propagation |

The Worker logs only status and route for server failures. Do not add request
bodies, authorization headers, email addresses, or provider response bodies to
logs while diagnosing failures.
