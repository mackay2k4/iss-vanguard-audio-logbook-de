# ISS Vanguard — Logbuch Web App (German)

A self-hosted companion web app for the ISS Vanguard board game. It serves the
German logbook protocols (narrative text + pixel-perfect instruction images),
a multi-voice audio player, interactive progress tracking, a clickable P999
star map, per-planet record sheets, and the rulebooks/documents — all behind a
simple login, with per-savegame state stored in SQLite.

---

## Features

- **Protocols** — narrative text (curated) + the exact instruction image cropped
  from the logbook PDF, with clickable "Lies Protokoll N" references.
- **Progress tracking** — checkboxes per protocol, stored per savegame; a
  **Fortschritt** grid shows every trackable protocol. Game icons/tokens are
  rendered as readable names (e.g. `[Erfolgs-Marker]`).
- **P999 star map** — the ISSMAP tech-tree with editable per-field notes and
  clickable "—" → "+" cost toggles (all saved per savegame); each node title
  links to that planet's record sheet.
- **Planeten** — one fillable record sheet per planet (from the official
  fillable PDF), fields stored per savegame; links back to P999.
- **Dokumente** — the rulebooks / quick reference / offline logbook PDFs and an
  external cheat-sheet link.
- **Multiple savegames** per user; **case-insensitive** login names.

---

## Quick Start (Docker)

```bash
cd docker

# 1. Create .env from the template and set the required secrets
cp .env.example .env
#    Edit .env:
#      SESSION_SECRET  — required; generate one with:
#                        python3 -c "import secrets; print(secrets.token_hex(32))"
#      ISS_VANGUARD_URL  — the public URL the app is reached at
#      ISS_VANGUARD_PORT — host port to expose (default 8080)

# 2. (Optional) reverse-proxy overrides (Traefik etc.)
cp docker-compose.override.yml.example docker-compose.override.yml   # if present

# 3. Build and start (fast: the image just copies the committed crops +
#    content model — no PDF rendering at build time)
docker compose up -d --build

# 4. Create your first user (see below) — REQUIRED to log in
docker compose exec app python -m app.cli create-user <username>

# 5. Open the app
#    http://localhost:8080  (or your configured ISS_VANGUARD_URL)
```

### Creating a user (first login)

There is **no public sign-up** — accounts are created from the command line.
After the container is running, create at least one user:

```bash
# Interactive: you'll be prompted for a password (hidden input, with confirm)
docker compose exec app python -m app.cli create-user alice
```

Other user-management commands:

```bash
# Reset / change a password (or create if the user doesn't exist yet)
docker compose exec app python -m app.cli create-user alice --force

# List users
docker compose exec app python -m app.cli list-users

# Delete a user and ALL their savegames (asks for confirmation)
docker compose exec app python -m app.cli delete-user alice
```

Notes:
- Login usernames are **case-insensitive** (`Alice` == `alice`), passwords are not.
- Users and savegames live in the SQLite DB under the `data/db/` bind mount, so
  they survive container rebuilds.

---

## Configuration

Set via `docker/.env` (consumed by `docker-compose.yml`):

| Variable            | Required | Default                              | Purpose                                            |
| ------------------- | -------- | ------------------------------------ | -------------------------------------------------- |
| `SESSION_SECRET`    | **yes**  | —                                    | Signs session cookies. Generate a random 32-byte hex. |
| `ISS_VANGUARD_URL`  | no       | `http://localhost:8080`              | Public base URL (used for absolute links).         |
| `ISS_VANGUARD_PORT` | no       | `8080`                               | Host port mapped to the container's port 80.       |
| `DATA_DB`           | no       | `/data/db/app.sqlite`                | SQLite path inside the container.                  |
| `AUDIO_DIR`         | no       | `/data/audiofiles`                   | Audio directory inside the container (read-only).  |
| `CONTENT_PATH`      | no       | `/app/content/logbook.de.final.json` | Content model path inside the container.           |

### Volumes (bind mounts)

- `../data/audiofiles → /data/audiofiles` (read-only) — the OGG audio files.
- `../data/db → /data/db` — the SQLite database (users, savegames, progress).

---

## Architecture

- **Backend**: FastAPI + uvicorn, session-cookie auth, SQLite via `aiosqlite`.
- **Frontend**: a single-page app in `app/static/` (vanilla JS), served with an
  SPA fallback so deep links / reloads (e.g. `/planet/beta-tarsoni`) work.
- **Content model**: `content/logbook.de.final.json` — curated narrative text +
  per-protocol instruction image + progress checkboxes + manual overrides.
- **Instruction images**: `app/static/instructions/protokoll_XXXX.png`, cropped
  from the logbook PDF.

### Build philosophy — crop once, reuse

The instruction crops and the content model are **committed project assets**.
The Docker image build is a single fast stage that just installs dependencies
and copies those assets — it does **not** render the PDF (that step was slow and
memory-heavy). You only regenerate the crops/content when the source PDF or the
crop overrides change (see below).

---

## Regenerating the content (out of band)

Run this only when you change the source PDF, crop coordinates, checkbox counts,
or `dev/protocol_overrides.json`. It re-crops the instruction images and
rebuilds the content model into the committed locations.

```bash
# from the project root
./dev/regenerate.sh
```

What it does:
1. `dev/crop_instructions.py` — crop each protocol's instruction block from the
   PDF (300 DPI) → `app/static/instructions/protokoll_XXXX.png`
2. `dev/count_checkboxes.py` — count printed checkbox squares per protocol
   (feeds how many progress boxes a protocol shows)
3. `dev/build_final.py` — assemble `content/logbook.de.final.json` (curated text
   + instruction images + checkboxes + overrides)

After regenerating, rebuild the image to ship the new assets:

```bash
cd docker && docker compose up -d --build
```

### Per-protocol overrides

`dev/protocol_overrides.json` is the single source of truth for manual tweaks:
- `crop` — adjust the instruction-image crop band per protocol.
- `checkboxes` — custom progress-box labels (supports `[icon:KEY]` markers).
- `nodeTrackers` / `diagramOverlay` — the P55 node tracker + clickable markers.
- `special` — bespoke widgets (P880 text fields, P999 diagram-notes map).
- `imageRefs` — supply/correct "Lies Protokoll N" links when the PDF text layer
  dropped them.

---

## Project structure

```
iss-vanguard-logs/
├── app/                              # FastAPI application
│   ├── main.py                       # app factory + SPA fallback
│   ├── cli.py                        # user management (create/delete/list)
│   ├── config.py                     # env-var settings
│   ├── db.py                         # SQLite access (users, savegames, state)
│   ├── auth.py                       # password hashing + session auth
│   ├── content.py                    # loads/serves the content model
│   ├── routes/                       # API routers (auth, content, savegames, checks, audio)
│   └── static/                       # the SPA + committed assets
│       ├── index.html, app.js, style.css
│       ├── instructions/             # cropped protocol images (committed)
│       ├── forms/                    # P999 map + hotspots, planet sheet assets
│       ├── docs/                     # rulebook / reference / logbook PDFs
│       └── icons/                    # extracted game icons
│
├── content/
│   ├── logbook.de.json               # source metadata (order/title/audio)
│   └── logbook.de.final.json         # assembled content model (committed)
│
├── data/                             # source + runtime data (not in the image)
│   ├── audiofiles/                   # OGG audio (bind-mounted, read-only)
│   ├── text/                         # curated narrative text
│   ├── db/                           # SQLite DB (runtime, gitignored)
│   └── *.pdf                         # source PDFs (logbook, rulebooks, sheets)
│
├── dev/                              # out-of-band tooling
│   ├── regenerate.sh                 # re-crop + rebuild content model
│   ├── crop_instructions.py
│   ├── count_checkboxes.py
│   ├── build_final.py
│   └── protocol_overrides.json       # manual per-protocol overrides
│
└── docker/
    ├── Dockerfile                    # single-stage app image
    ├── docker-compose.yml
    └── .env                          # secrets (gitignored)
```

---

## Development (running locally without Docker)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Env (minimum)
export SESSION_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
export DATA_DB=./data/db/app.sqlite
export CONTENT_PATH=./content/logbook.de.final.json
export AUDIO_DIR=./data/audiofiles

# Create a user, then run
python -m app.cli create-user alice
uvicorn app.main:app --host 0.0.0.0 --port 8080
# open http://localhost:8080
```

To regenerate crops/content locally you also need PDF tooling:

```bash
pip install pymupdf pillow
./dev/regenerate.sh
```

---

## License

Game content (text, logbook, rulebook, icons) is © Awaken Realms. This project
is a personal/fan companion tool for use with the physical ISS Vanguard game.
