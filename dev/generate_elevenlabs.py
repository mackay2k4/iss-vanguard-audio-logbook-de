#!/usr/bin/env python3
"""
Generate final MP3s with ElevenLabs multi-voice TTS.
Processes in batches of 25. Skips already generated files.
"""

import os, re, json, subprocess, sys
from pathlib import Path

env_file = Path('.env')
for line in env_file.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        os.environ[k.strip()] = v.strip()

from elevenlabs import ElevenLabs

client = ElevenLabs()

# Paths
TEXT_DIR = Path("../data/text")
OUT_DIR = Path("../data/audiofiles")
SFX_DIR = Path("sfx")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load mappings
with open("voice_mapping.json", "r", encoding="utf-8") as f:
    vm = json.load(f)
voices = vm["voices"]
role_map = vm["role_to_voice"]

with open("sfx/_effect_mapping.json", "r", encoding="utf-8") as f:
    sfx_map = json.load(f)

# Settings
MODEL = "eleven_flash_v2_5"
VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.5}
BATCH_SIZE = 25


def get_voice_id(speaker):
    voice_key = role_map.get(speaker, "romolus")
    return voices[voice_key]["id"]


def preprocess_text(text):
    """Join mid-sentence line breaks and fix abbreviations."""
    text = text.replace("km/h", "Kilometer pro Stunde")
    text = text.replace("km/s", "Kilometer pro Sekunde")
    # Fix pronunciation of speaker tags with numbers
    text = text.replace("[Außenteammitglied 1]", "[Außenteammitglied eins]")
    text = text.replace("[Außenteammitglied 2]", "[Außenteammitglied zwei]")
    text = text.replace("[Außenteammitglied 3]", "[Außenteammitglied drei]")
    text = text.replace("[Teammitglied 1]", "[Teammitglied eins]")
    text = text.replace("[Teammitglied 2]", "[Teammitglied zwei]")
    text = text.replace("[Teammitglied 3]", "[Teammitglied drei]")
    text = text.replace("[Stimme 1]", "[Stimme eins]")
    text = text.replace("[Stimme 2]", "[Stimme zwei]")
    return text


def parse_segments(content):
    """Parse text into speech and sfx segments."""
    lines = content.strip().split("\n")
    # Skip header if still present (legacy)
    if lines and re.match(r"^(PROTOKOLL|STARTPROTOKOLL)", lines[0]):
        lines = lines[1:]

    segments = []
    current_speaker = "NARRATOR"
    current_text = []

    for line in lines:
        # Sound effect
        sfx_match = re.match(r"^\s*\*\*\*\s*(.+?)\s*\*\*\*\s*$", line)
        if sfx_match:
            if current_text:
                joined = " ".join(current_text)
                if joined.strip():
                    segments.append(("speech", current_speaker, preprocess_text(joined)))
                current_text = []
            segments.append(("sfx", sfx_match.group(1), None))
            continue

        # Speaker tag
        speaker_match = re.match(r"^\[(.+?)\]:\s*(.*)", line)
        if speaker_match:
            if current_text:
                joined = " ".join(current_text)
                if joined.strip():
                    segments.append(("speech", current_speaker, preprocess_text(joined)))
                current_text = []
            current_speaker = speaker_match.group(1)
            # Keep the speaker tag in text so it gets read aloud
            speaker_text = f"[{speaker_match.group(1)}]: {speaker_match.group(2)}" if speaker_match.group(2) else ""
            if speaker_text:
                current_text = [speaker_text]
            else:
                current_text = [f"[{speaker_match.group(1)}]:"]
            continue

        # Continuation - join if mid-sentence
        if line.strip():
            if current_text and current_text[-1] and not current_text[-1][-1] in '.!?:"…':
                current_text[-1] += " " + line.strip()
            else:
                current_text.append(line.strip())

    if current_text:
        joined = " ".join(current_text)
        if joined.strip():
            segments.append(("speech", current_speaker, preprocess_text(joined)))

    return segments


def generate_log(txt_path):
    """Generate MP3 for a single log file."""
    content = txt_path.read_text(encoding="utf-8")
    if "Kein Audio" in content or "Split in" in content:
        return "skip"

    body = "\n".join(content.strip().split("\n")[1:]).strip()
    if len(body) < 10:
        return "skip"

    ogg_name = txt_path.stem + ".ogg"
    ogg_path = OUT_DIR / ogg_name

    # Skip if already exists
    if ogg_path.exists():
        return "exists"

    segments = parse_segments(content)
    if not segments:
        return "skip"

    # Generate each segment
    part_files = []
    temp_parts = []

    for i, (seg_type, name, text) in enumerate(segments):
        if seg_type == "sfx":
            sfx_file = sfx_map.get(name)
            if sfx_file and (SFX_DIR / f"{sfx_file}.mp3").exists():
                part_files.append(str(SFX_DIR / f"{sfx_file}.mp3"))
            continue

        if seg_type == "speech" and text.strip():
            voice_id = get_voice_id(name)
            part_path = OUT_DIR / f"_tmp_{i:03d}.ogg"

            try:
                audio = client.text_to_speech.convert(
                    voice_id=voice_id,
                    text=text,
                    model_id=MODEL,
                    voice_settings=VOICE_SETTINGS,
                )
                with open(part_path, "wb") as f:
                    for chunk in audio:
                        f.write(chunk)
                part_files.append(str(part_path))
                temp_parts.append(part_path)
            except Exception as e:
                print(f"      ERROR [{name}]: {e}")

    if not part_files:
        for p in temp_parts:
            p.unlink(missing_ok=True)
        return "error"

    # Concatenate
    if len(part_files) == 1:
        if temp_parts:
            temp_parts[0].rename(ogg_path)
        else:
            subprocess.run(["cp", part_files[0], str(ogg_path)], capture_output=True)
    else:
        inputs = []
        filter_parts = []
        for i, p in enumerate(part_files):
            inputs.extend(["-i", p])
            filter_parts.append(f"[{i}:a]")
        filter_str = "".join(filter_parts) + f"concat=n={len(part_files)}:v=0:a=1[out]"

        subprocess.run(
            ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_str, "-map", "[out]", str(ogg_path)],
            capture_output=True,
        )

    # Cleanup temp files
    for p in temp_parts:
        p.unlink(missing_ok=True)

    if ogg_path.exists():
        return "ok"
    return "error"


def main():
    # Get all audio files to generate
    all_files = sorted(TEXT_DIR.glob("protokoll_*.txt"))

    # Filter to audio-only
    to_generate = []
    for f in all_files:
        content = f.read_text(encoding="utf-8")
        if "Kein Audio" in content or "Split in" in content:
            continue
        body = "\n".join(content.strip().split("\n")[1:]).strip()
        if len(body) < 10:
            continue
        ogg_path = OUT_DIR / (f.stem + ".ogg")
        if not ogg_path.exists():
            to_generate.append(f)

    total = len(to_generate)
    print(f"Zu generieren: {total} Dateien")
    print(f"Batch-Größe: {BATCH_SIZE}")
    print(f"Model: {MODEL}")
    print(f"Output: {OUT_DIR}/")
    print()

    if total == 0:
        print("Nichts zu tun - alle MP3s existieren bereits.")
        return

    # Process ALL remaining (not just one batch)
    batch = to_generate
    print(f"=== Generiere alle {len(batch)} Dateien ===")

    ok = 0
    errors = 0
    for i, f in enumerate(batch):
        print(f"  [{i+1}/{len(batch)}] {f.name}...", end=" ", flush=True)
        result = generate_log(f)
        if result == "ok":
            print("✓")
            ok += 1
        elif result == "error":
            print("✗")
            errors += 1
        else:
            print(f"({result})")

    print(f"\nBatch fertig: {ok} generiert, {errors} Fehler")
    print(f"Verbleibend: {total - len(batch)}")

    # Count total progress
    existing = len(list(OUT_DIR.glob("protokoll_*.ogg")))
    print(f"Gesamt MP3s im Output: {existing}")


if __name__ == "__main__":
    main()
