# Cloudflare Python Worker compatibility spike

Date: 2026-09-17. The spike is reproducible from `experiments/python-worker/`; its prepared working copy is ignored under `.artifacts/`.

## Results

The literal wrapper is:

```python
from workers import wsgi
from app import app
Default = wsgi.entrypoint(app)
```

Official Cloudflare documentation confirms Flask and WSGI are supported. Native CPython tests proved application initialization, all four blueprints, Jinja rendering, `content.py`, Flask request/JSON handling, cookies/sessions, current headers, and validation paths. Warm native measurements used 20 batches of 20 requests with rate limiting disabled to isolate route work:

| Route | Median wall time | 95th percentile batch average | Tested result |
|---|---:|---:|---|
| `/` Jinja render | 0.738 ms | 0.939 ms | 200, current template |
| `/api/github` fallback | 0.219 ms | 0.268 ms | 200 JSON |
| `/api/chat` unconfigured | 0.260 ms | 0.354 ms | 503 JSON |
| `/api/contact` validation | 0.268 ms | 0.293 ms | 400 JSON |

These are Windows CPython wall-clock measurements. They exclude Pyodide startup, WSGI bridging, D1, and external fetches. They are useful compatibility checks and are **not Cloudflare CPU measurements**.

`pywrangler` 1.17.3 reached creation of its CPython 3.13.2 Emscripten/Pyodide environment, then required `xbuildenv-0.29.4.tar.gz`. The sandbox blocked that download. The automatic approval service rejected an unsandboxed run because the workspace had no approval credits. Consequently, a Cloudflare/Pyodide route run and DevTools CPU profile were not obtained. The repository does not claim otherwise.

## Dependency classification

| Dependency | Classification | Evidence / production impact |
|---|---|---|
| Flask 3.0.3 spike / 3.1.3 current | Works unchanged at framework level | Official WSGI support; the original spike and the upgraded native route suite pass. Python Workers remains beta. |
| Jinja2 | Works unchanged at framework level | Current homepage renders; production does this once in CI to spend no request CPU. |
| `content.py` / blueprints | Works unchanged until their storage/network calls | Imports and registration pass. |
| Flask-SQLAlchemy | Not suitable for D1 | Current SQLite database targets an ephemeral in-memory filesystem. D1 exposes an async binding, not a SQLAlchemy DBAPI connection. Models remain useful locally. |
| Flask-Limiter | Works only with a different durable adapter | `memory://` is isolate-local and cannot enforce distributed limits. Production uses atomic D1 counters. |
| `requests` | Not suitable for Workers | Cloudflare supports async HTTP libraries (`aiohttp`, `httpx2`) or the Workers `fetch()` FFI. All current calls are synchronous and need rewriting. |
| `python-dotenv` | Not required in production | Useful for local Flask; Worker secrets/bindings replace `.env`. |
| Gunicorn | Not required in production | WSGI is provided by the Workers runtime; Gunicorn remains a container adapter only. |
| `smtplib` | Not suitable for this production design | Worker socket/SMTP behavior is unnecessary; Brevo HTTPS is portable and supported. |

## Runtime decision matrix

| Criterion | Python/Flask Worker | JavaScript Worker |
|---|---|---|
| Existing code reuse | High for routing/templates, low for I/O/storage | Moderate; pure prompts/contracts exported during build |
| Runtime maturity | Beta | General availability, native runtime |
| Package compatibility | Flask works; current sync HTTP and DB do not | No package blocker found |
| D1 integration | FFI adapter and async redesign | Native prepared statements/batches |
| AI/GitHub/email HTTP | Replace `requests` with async/FFI | Native `fetch`, abort timeouts |
| Rate limiting | D1 adapter required | Atomic D1 counters implemented |
| Static asset bypass | Supported with route patterns | `/api/*` only is configured |
| Measured Cloudflare CPU | Blocked; unknown | Bundle compiles; production profile still requires deployment |
| Bundle | Pyodide plus Python packages; not measured | 196.15 KiB raw / 38.48 KiB gzip in dry run |
| Testing | New beta toolchain plus Flask/D1 seams | Node unit tests plus Wrangler/D1 integration |
| Maintenance | Two Python data models unless heavily adapted | Explicit production adapters; Flask remains local |
| Free-tier reliability | Unproven under 10 ms CPU | Lower startup/package risk; still requires live metrics |

## Selection

**JavaScript Worker selected.** Static Jinja output bypasses Worker execution. Only `/api/*` invokes the Worker. Native D1 and `fetch` remove the largest compatibility and CPU unknowns. Python continues to own content, Jinja templates, local Flask development, and prompt construction. This is the smallest reliable boundary given current evidence.

Cloudflare production CPU remains an acceptance check. After the first deployment, use Workers metrics and a DevTools CPU profile with representative cached and uncached requests. If p95 CPU approaches 8 ms, disable dynamic GitHub HTML rendering or move it to scheduled cached assets before traffic grows.
