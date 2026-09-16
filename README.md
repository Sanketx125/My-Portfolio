# Sanket Mane — Portfolio

A modern, animated personal portfolio: Flask + Jinja2 backend, hand-written CSS
design system (no framework), vanilla JS with GSAP motion, a **live GitHub
dashboard**, an **interactive geospatial map**, a **Ctrl/Cmd+K command palette**,
an AI assistant with a **recruiter-pitch mode**, and a working contact form
(SQLite + email).

Everything on the page — bio, skills, experience, projects, education, map
coordinates, and what the chatbot is allowed to say — comes from a single file,
`content.py`. There is nothing person-specific hardcoded into the HTML templates.

---

## Feature tour

| Feature | What it does | Where |
|---|---|---|
| **Live GitHub dashboard** | Contribution heatmap, public/private repo counts, stars, language breakdown, featured repos — via the GraphQL API, cached server-side | `services/github.py`, `partials/_github.html` |
| **Interactive geospatial map** | Leaflet + CARTO dark tiles; each project is a pin, synced with the Projects filter | `static/js/map.js`, `partials/_map.html` |
| **Command palette** | `Ctrl/Cmd+K` (or `/`) to jump anywhere, open a project, download the résumé, copy email, toggle theme | `static/js/command-palette.js` |
| **AI recruiter mode** | The chat widget has an *Ask* / *Recruiter pitch* toggle; recruiter mode makes a structured, evidence-based hiring case | `blueprints/chat.py`, `static/js/chat-widget.js` |
| **Motion system** | Scroll reveals, hero contour draw-in, parallax, count-ups — all respecting `prefers-reduced-motion` | `static/js/animations.js` |
| **Contact form** | CSRF-protected, honeypot, rate-limited, saves to DB and emails you | `blueprints/contact.py` |

---

## Quick start (local)

```bash
# 1. Create a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy the env template and fill in real values
cp .env.example .env

# 4. Run it
python app.py
```

Open **http://localhost:5000**. The database (SQLite) is created automatically on
first run.

> **Windows note:** if a `DATABASE_URL` is set globally in your environment it
> takes precedence. Override it for the session with
> `set DATABASE_URL=sqlite:///portfolio.db` before `python app.py`.

---

## Environment variables

See `.env.example` for the full list with comments. The ones that matter most:

| Variable | What it does | If left blank |
|---|---|---|
| `GITHUB_TOKEN` / `GITHUB_USERNAME` | Powers the live GitHub dashboard | The GitHub section shows a tasteful "connect a token" state — the rest of the page is unaffected |
| `LLM_API_KEY` (+ `LLM_API_BASE`, `LLM_MODEL`) | Powers the "Ask Sanket's AI" widget, including recruiter mode | Chat returns a friendly "not configured, use the contact form" message |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `CONTACT_TO_EMAIL` | Emails you contact-form submissions | Submission is still saved to the database, you just won't get an email |
| `FLASK_SECRET_KEY` | Signs the session cookie used for CSRF protection | Works locally with the dev default — **set a real random value before deploying** |
| `GITHUB_CACHE_TTL_SECONDS` | How long GitHub data is cached in-process | Defaults to `3600` (1 hour) |

The chat backend is provider-agnostic: point `LLM_API_BASE` / `LLM_API_KEY` /
`LLM_MODEL` at OpenCode Zen, OpenAI, OpenRouter, Groq, or a self-hosted
OpenAI-compatible server — no code changes needed.

---

## Setting up the GitHub dashboard

1. Create a personal access token at <https://github.com/settings/tokens>.
   - **Classic token:** scopes `read:user` + `repo`.
     (`repo` is only needed so the **private repo count** can be read.)
   - **Fine-grained token:** *User permissions → read*, plus
     *Repository permissions → Metadata: read* on the repos you own.
2. Put it in `.env`:
   ```
   GITHUB_USERNAME=Sanketx125
   GITHUB_TOKEN=ghp_your_token_here
   ```
3. Restart the app.

**Privacy:** the token is used **server-side only** — it is never sent to the
browser, never rendered into the HTML, and never exposed by `/api/github`.
Private repositories are read as a **count only**; their names, descriptions and
URLs are never requested from GitHub, so they cannot leak onto the page.

**Rate limits:** live data is fetched once per cache window (default 1 hour) and
memoised per worker. A page view after the first costs zero GitHub requests.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl` / `Cmd` + `K` | Open the command palette |
| `/` | Open the command palette (when not typing in a field) |
| `↑` / `↓` | Move through palette results |
| `Enter` | Run the selected command |
| `Esc` | Close the palette or chat |

---

## Project structure

```
portfolio/
├── app.py                       # Flask app factory
├── config.py                    # env-driven config
├── extensions.py                # shared Flask-Limiter instance
├── content.py                   # <-- single source of truth, edit this
├── models.py                    # Contact + ChatMessage SQLAlchemy models
├── blueprints/
│   ├── main.py                  # renders the page, robots.txt, sitemap.xml
│   ├── chat.py                  # POST /api/chat  (Ask + recruiter modes)
│   ├── contact.py               # POST /api/contact
│   └── github.py                # GET /api/github
├── services/
│   └── github.py                # GitHub GraphQL fetch + TTL cache + fallback
├── templates/
│   ├── base.html                # shell: head/SEO, overlays, scripts
│   ├── index.html               # composes the partials
│   └── partials/                # _nav, _hero, _about, _skills, _projects,
│                                # _map, _github, _experience, _resume, _ai,
│                                # _contact, _footer, _palette, _chat
├── static/
│   ├── css/{theme,layout,components}.css
│   ├── js/{animations,map,command-palette,chat-widget,contact-form}.js
│   ├── images/profile.jpg       # your photo, already wired in
│   └── files/resume.pdf         # your résumé, already wired in
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Editing your content

Everything lives in **`content.py`**. Update your bio, stats, skills, experience,
projects, socials or résumé there and the whole site — **including the chatbot's
knowledge** — updates automatically. No template edits needed.

Useful fields:

- **`availability`** — the badge shown in the hero and the "Currently" card.
- **`projects[].coords`** — `[lat, lng]`; drives the map pin for that project.
- **`projects[].location`** — the human-readable place shown on the card/pin.
- **`projects[].image`** — optional path under `static/` for a real screenshot.
  Leave `""` to keep the generated geospatial artwork. (Drop screenshots into
  `static/images/projects/` and point at them.)
- **`projects[].featured`** — reserved for highlighting key work.
- **`projects[].github` / `live_url`** — blank by default, so the "Code"/"Live"
  buttons only appear once you supply a real URL.
- **`resume.summary` / `resume.highlights`** — the designed résumé section (the
  PDF at `resume_pdf` is still the downloadable artifact).
- **`github.fallback_repos`** — shown only when no GitHub token is configured.
  Left empty on purpose rather than inventing repositories.
- **`og_image`** — swap the default profile photo for a 1200×630 social preview.

---

## Design notes

- Palette, type and motion follow a geospatial/precision vocabulary (contour-line
  teal, survey amber, graticule texture, real coordinates in the hero).
- Motion is layered: the hero's contour lines draw themselves in, sections and
  cards reveal on scroll, numbers count up, and the hero drifts on a subtle
  parallax — all disabled under `prefers-reduced-motion`.
- The design system is three files: **tokens/base** (`theme.css`), **layout**
  (`layout.css`), **components** (`components.css`), with a documented breakpoint
  scale (1024 / 900 / 768 / 640 / 480).

---

## Deployment

### Docker
```bash
docker build -t portfolio .
docker run -p 5000:5000 --env-file .env portfolio
```

### Render / Railway / Fly.io
All three can build directly from the included `Dockerfile`. Set the environment
variables from `.env.example` in the platform's dashboard, and point the
persistent disk (if offered) at `/app/instance` if you want the SQLite
contact-form database to survive redeploys — otherwise swap `DATABASE_URL` for a
managed Postgres/MySQL instance.

With multiple gunicorn workers each worker keeps its own GitHub cache, so at most
one GitHub request per worker per cache window — still far inside the rate limit.
Use a Redis URL for `RATELIMIT_STORAGE_URI` when running more than one worker.

### Plain VPS
```bash
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:5000 --workers 3 app:app
```
Put nginx or Caddy in front for TLS.

---

## What to double-check before going live

- [ ] Set a real, random `FLASK_SECRET_KEY`
- [ ] Add `GITHUB_TOKEN` and confirm the dashboard populates
- [ ] Confirm no private repository names appear in the page source
- [ ] Add a real `LLM_API_KEY` and confirm `LLM_API_BASE`/`LLM_MODEL` match your provider
- [ ] Add SMTP credentials so contact-form notifications actually arrive
- [ ] Set `ALLOWED_ORIGIN` to your real domain
- [ ] Swap `DATABASE_URL` for a managed database if deploying more than one instance
- [ ] Replace `og_image` with a 1200×630 social preview
- [ ] Add project screenshots to `static/images/projects/` and set `projects[].image`
- [ ] Fill in project `github`/`live_url` links in `content.py`
