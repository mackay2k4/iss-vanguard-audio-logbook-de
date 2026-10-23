# ============================================================
# ISS Vanguard Logbook — app image (single stage, fast)
# ============================================================
# The instruction crops (app/static/instructions/*.png) and the assembled
# content model (content/logbook.de.final.json) are committed project assets,
# so the image build is just "install deps + copy files" — no PDF rendering,
# no PyMuPDF, no 300-DPI crop step (which was slow and OOM-prone).
#
# Those assets are generated OUT OF BAND (only when the source PDF or the crop
# overrides change) by running:  dev/regenerate.sh
# ============================================================
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# The app package already contains the cropped instruction images and all the
# static assets (forms, docs, icons, etc.).
COPY app/ /app/app/

# Pre-assembled content model (curated text + instruction images + overrides).
COPY content/logbook.de.final.json /app/content/logbook.de.final.json

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
