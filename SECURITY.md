# Security model

This repository is designed to be safe when public, provided production secrets
are entered only in the documented secret stores and any previously exposed
credential is rotated. Security reduces risk; it does not make the application
invulnerable.

## Trust boundaries

- Everything in `dist/`, HTML, CSS, JavaScript, source maps, browser storage,
  and network responses is public.
- Cloudflare Worker secrets are trusted runtime inputs. They are never generated
  into `dist/` or returned by an API.
- GitHub Actions secrets authenticate deployment only. Runtime credentials live
  in Cloudflare rather than GitHub.
- D1 contains contact personal data and chat content. Database exports are
  sensitive even when credentials are absent.
- LLM, Brevo, GitHub, Turnstile, OpenStreetMap, Google Fonts, GitHub avatars, Cloudflare,
  and GitHub Actions are external processors or dependencies.

## Implemented controls

| Risk | Control |
|---|---|
| Secret disclosure | Build never imports configuration or loads `.env`; tracked and public-artifact scanners compare known local values and token patterns |
| Cross-site requests | Dynamic POST routes require the exact `SITE_URL` origin and reject cross-site fetch metadata |
| Session tampering | Random server ID in signed `__Host-` HttpOnly, Secure, SameSite=Strict cookie; browser-provided IDs are ignored in production |
| Automated abuse | Honeypot, Turnstile action/hostname validation, D1 per-minute/per-day limits, global budgets |
| Oversized input | 12 KB streamed JSON limit, strict JSON object requirement, bounded fields and output |
| SQL injection/races | D1 prepared statements, bound values, atomic counters, leases, batched contact/outbox writes |
| XSS | Jinja/Nunjucks autoescaping, normalized GitHub fields, safe chat rendering, CSP, no user HTML passed to templates |
| Clickjacking/content sniffing | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff` |
| Provider hangs | Abort timeouts for Turnstile, LLM, Brevo, and GitHub; bounded LLM concurrency |
| Email loss | Contact and two outbox records commit before delivery; scheduled bounded retry/backoff |
| Data growth | Twenty server messages/session and 30-day chat cleanup; expired counters, leases, and sessions removed |
| Supply chain | Exact Python/npm versions, npm lockfile, SHA-pinned Actions, Dependabot, audits, CodeQL, dependency review |
| Static dependency compromise | GSAP and Leaflet copied from pinned npm packages and served from the same origin |
| Error leakage | Generic client errors, no stack traces/provider bodies in responses, minimal server logging |

Static responses receive a restrictive CSP and security headers from
`dist/_headers`. API JSON has its own `default-src 'none'` CSP and no-store
cache policy. HSTS is enabled in production. External resources allowed by the
page CSP are limited to Turnstile, Google Fonts, OpenStreetMap tiles, and GitHub
avatars.

## Rate and cost controls

- Chat: 6/minute/IP, 20/day/IP, 20 turns/signed session, 50 global provider
  attempts/day, three concurrent LLM leases, 500 output-token request cap.
- Contact: 3/minute/IP, 5/day/IP, 50 accepted contacts/day globally.
- Email: 100 external send attempts/day, including retries. Each normal contact
  creates an owner message and visitor reply.
- GitHub: 20/minute/IP and one shared successful response cached for one hour.

IP addresses are not stored directly. A daily HMAC derived from
`SESSION_SECRET` creates a short-lived limiter key. Limits are defense in depth,
not a substitute for provider-side budgets. Configure an LLM account spending
cap as well.

## Secret inventory and placement

| Value | Storage |
|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions encrypted secrets |
| `SESSION_SECRET`, `TURNSTILE_SECRET_KEY` | Cloudflare Worker secrets |
| `LLM_API_KEY`, `BREVO_API_KEY` | Cloudflare Worker secrets |
| `GITHUB_TOKEN`, `GITHUB_TOKEN_2` | Cloudflare Worker secrets |
| `MAIL_FROM`, `CONTACT_TO_EMAIL` | Cloudflare Worker secrets |
| Public IDs, hostname, usernames, model/base URL | GitHub variables or committed Wrangler vars |
| Local Flask and Worker values | Ignored `.env` and `.dev.vars` respectively |

`.env.example` and `.dev.vars.example` contain names only. The Wrangler launcher
sets `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`, preventing accidental reuse
of Flask credentials by local Worker tooling.

Never put secrets in `wrangler.jsonc`, repository variables, `content.py`,
generated HTML/JS, browser storage, source maps, issue text, workflow commands,
or database migration files. Do not paste a production secret into a chat or
terminal command that will be logged. Use interactive secret fields.

## Credential rotation

If a secret is found in a commit, build, log, artifact, or browser response,
assume compromise. Revoke or rotate it at the issuing provider first. Removing
the file or rewriting Git history does not invalidate a copied credential.
Then remove the value, rerun both secret scans, and review deployment/audit logs.

For `SESSION_SECRET`, rotation invalidates current chat cookies and creates new
server sessions. Existing D1 messages remain until retention cleanup but are not
reachable through the new signed session.

## Repository and CI hardening

The workflows grant `contents: read` by default. CodeQL alone receives
`security-events: write`. Pull requests never receive deployment credentials;
deployment runs only from `main` or trusted manual dispatch. Actions are pinned
to immutable commit SHAs, checkout does not retain credentials, deployments are
serialized, and jobs have timeouts.

Recommended GitHub settings:

1. enable secret scanning and push protection;
2. protect `main`, require pull requests and passing CI/CodeQL checks;
3. restrict force pushes and deletion;
4. restrict the `production` environment to `main`;
5. use required reviewers only if a manual production gate is desired;
6. review Dependabot PRs and refresh pinned action SHAs deliberately.

## Data handling

Contact submissions include names, email addresses, budgets, and messages.
Restrict Cloudflare account access, avoid querying message bodies in shared
terminals, and delete data according to a stated retention policy. The current
code automatically removes chats older than 30 days; it retains contacts and
mail delivery state until an operator deletes them.

Before public launch, add a privacy notice that matches the actual retention,
processors, and contact purpose required for the operator's jurisdiction. This
repository does not substitute for legal review.

Backups and `migration-private/*.sql` contain personal data. They are ignored by
Git but must also be encrypted and access-controlled outside the repository.

## Residual risks

- Free services have no uptime guarantee and can change limits or eligibility.
- Turnstile and rate limits increase abuse cost but cannot eliminate abuse.
- LLM prompt injection can influence answers; the model receives a fixed facts
  prompt and conversation text, with no filesystem, environment, network tool,
  or secret access.
- The LLM provider receives chat content; Brevo receives email content; GitHub
  and Cloudflare process requests according to their terms.
- `workers.dev` availability, Cloudflare signup/card behavior, Brevo approval,
  email deliverability, geographic eligibility, and production CPU cannot be
  proven without the owner's accounts and live traffic.
- The CSP allows inline styles because existing templates use style attributes.
  Removing those attributes would allow a stricter `style-src` policy later.

Report a vulnerability privately to the repository owner. Do not place secrets,
personal contact records, or an exploitable proof in a public issue.
