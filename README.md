# ISS Vanguard — Audio Logbook (German)

German multi-voice audio logbook for the ISS Vanguard board game, with sound effects and a web player.

## Quick Start (Docker)

```bash
cd docker

# 1. Create .env from template
cp .env.example .env
# Edit .env: set your hostname (or leave localhost for local use)

# 2. (Optional) Create override for reverse proxy (Traefik etc.)
cp docker-compose.override.yml.example docker-compose.override.yml
# Edit with your domain/labels

# 3. Start
docker compose up -d --build

# 4. Open in browser
# http://localhost:8080 (or your configured hostname)
```

The container:
- Serves the web player + audio files via nginx
- Generates the online PDF with play links at startup (based on `ISS_VANGUARD_HOSTNAME`)
- No external dependencies needed at runtime

## Quick Start (Offline / USB-Stick)

1. Download `data/ISS_Vanguard_Logbuch_Offline.zip`
2. Unzip to a folder
3. Open `index.html` in a browser — enter protocol number, play
4. Or open `DE_ISS_Vanguard_Logbuch_offline.pdf` — click ▶ icons

## Project Structure

```
iss-vanguard-audio-logbook-de/
├── data/                              # Generated content
│   ├── audiofiles/                    # 616 OGG audio files (Opus 16kbps)
│   ├── text/                          # 869 text files (manually curated)
│   ├── DE_ISS_Vanguard_Logbuch_offline.pdf
│   ├── index.html                     # Offline web player
│   └── ISS_Vanguard_Logbuch_Offline.zip
│
├── docker/                            # Docker deployment
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml.example
│   ├── .env.example
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── add_pdf_links_container.py     # Generates online PDF at startup
│   ├── nginx.conf
│   └── html/index.html                # Online web player
│
├── dev/                               # Development scripts
│   ├── .env.example                   # API keys template
│   ├── generate_elevenlabs.py         # Generate audio with ElevenLabs TTS
│   ├── add_pdf_links.py               # Generate online PDF (standalone)
│   ├── add_pdf_links_offline.py       # Generate offline PDF
│   ├── tts_preprocessing.py           # Text preprocessing for TTS
│   ├── voice_mapping.json             # Character → Voice mapping
│   ├── analysis.json                  # Character & SFX analysis
│   ├── import/                        # Source PDF
│   └── sfx/                           # Sound effects + mapping
│
└── .venv/                             # Python virtual environment
```

## Configuration

### Docker `.env`

```bash
# Hostname for nginx + PDF play links
ISS_VANGUARD_HOSTNAME=iss.example.com
# Port mapping (default 8080)
ISS_VANGUARD_PORT=8080
```

If port is 443 or 80, the PDF links use `https://hostname/play/X`.
Otherwise: `http://hostname:port/play/X`.

### Development `.env` (dev/.env)

```bash
ELEVENLABS_API_KEY=your_key_here
FREESOUND_API_KEY=your_key_here
ISS_VANGUARD_BASE_URL=https://your-domain.com/play
```

## Voice Cast

| Voice | Role |
|-------|------|
| Romolus | Narrator (reports, journals) |
| Helmut Stieglbauer | Captain Wayman |
| Daniel Corporate | CAPCOM |
| Thomas | XO Major Dahl / Pilot |
| Mila | Außenteammitglied 1 / Teammitglied 1 |
| Christian | Außenteammitglied 2 / Teammitglied 2 |
| Martin Jung | Außenteammitglied 3 / Chefnavigator Neels |
| Susi | Navigator / Dr. Corey |
| Marcus | KI (Lander / Vanguard) |
| Tristan | Todsprecher / Aliens |

## Sound Effects

18 sound effects (ElevenLabs + Freesound.org) mapped to 45 in-game effects:
Alarm, Explosion, Static, Thruster, Metal, Click, Scanner, Weapon, Tool, Tech, Cheering, Scream, Footsteps, Insects, Airlock, Rumble, Bang, Agreement

Mapping: `dev/sfx/_effect_mapping.json`

## Development

### Prerequisites

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install elevenlabs pymupdf python-dotenv
```

System: `sudo apt install ffmpeg poppler-utils`

### Regenerating Audio (from dev/)

```bash
cd dev
# Set up .env with ELEVENLABS_API_KEY

# Generate all (skips existing)
python3 generate_elevenlabs.py

# Regenerate specific log: delete OGG first
rm ../data/audiofiles/protokoll_0258.ogg
python3 generate_elevenlabs.py
```

### Regenerating PDFs

```bash
cd dev

# Online PDF (uses ISS_VANGUARD_BASE_URL from .env or env var)
ISS_VANGUARD_BASE_URL="https://my-domain.com/play" python3 add_pdf_links.py

# Offline PDF
python3 add_pdf_links_offline.py
```

### Text Files

- Location: `data/text/protokoll_XXXX.txt`
- `Kein Audio` = skipped during generation
- Split protocols: `protokoll_0905_A.txt` through `_F.txt`
- Sound effects: `*** Effect Name ***` (replaced with audio at generation)
- Speaker tags: `[Character Name]:` (triggers voice switch)

### TTS Preprocessing (automatic during generation)

- Mid-sentence line breaks → joined with space
- `km/h` → "Kilometer pro Stunde"
- `Xg` → attached (gravity unit pronunciation)
- `[Außenteammitglied 1]` → `[Außenteammitglied eins]`
- `•` bullet points → "Erstens, Zweitens, ..."
- `*** Effect ***` → sound effect MP3 inserted

## Audio Format

- Format: OGG/Opus at 16 kbps
- Total size: ~67 MB (616 files)
- Total duration: ~4 hours
- Converted from original ElevenLabs Flash output (64kbps MP3)

## Costs

- ElevenLabs Creator Plan: $22/month (one-time for generation)
- Characters used: ~119,000
- Freesound.org: free (API key required)
- Total project cost: ~$22

## License

Audio content is generated from the ISS Vanguard logbook text (©Awaken Realms).
This project is for personal/fan use with the board game.
