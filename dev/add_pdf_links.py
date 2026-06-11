#!/usr/bin/env python3
"""
Add play icons with hyperlinks to the ISS Vanguard logbook PDF.
Uses FreeText annotations that render ON TOP of the page content.
Each PROTOKOLL gets a ▶ icon linking to http://localhost:8080/play/X
Split protocols get ▶A ▶B ▶C etc.
"""

import os
import re
from pathlib import Path

import fitz  # pymupdf

BASE_URL = os.environ.get("ISS_VANGUARD_BASE_URL", "http://localhost:8080/play")
INPUT_PDF = Path("import/DE_ISS_Vanguard_Logbuch_links_boxV1-1.pdf")
OUTPUT_PDF = Path("../docker/html/DE_ISS_Vanguard_Logbuch_online.pdf")
TEXT_DIR = Path("../data/text")


def get_split_protocols() -> dict[int, list[str]]:
    """Find protocols that are split into A, B, C, etc."""
    splits = {}
    for f in TEXT_DIR.glob("protokoll_*_*.txt"):
        m = re.match(r"protokoll_(\d+)_([A-F])\.txt", f.name)
        if m:
            num = int(m.group(1))
            letter = m.group(2)
            if num not in splits:
                splits[num] = []
            splits[num].append(letter)
    for num in splits:
        splits[num].sort()
    return splits


def get_audio_protocols() -> set[int]:
    """Get set of protocol numbers that have audio."""
    audio = set()
    for f in TEXT_DIR.glob("protokoll_*.txt"):
        m = re.match(r"protokoll_(\d+)\.txt", f.name)
        if not m:
            continue
        num = int(m.group(1))
        content = f.read_text(encoding="utf-8")
        if "Kein Audio" not in content and "Split in" not in content:
            audio.add(num)
    splits = get_split_protocols()
    audio.update(splits.keys())
    return audio


def main():
    print("Adding play icons to PDF...")

    splits = get_split_protocols()
    audio_protocols = get_audio_protocols()

    print(f"  Audio protocols: {len(audio_protocols)}")
    print(f"  Split protocols: {len(splits)}")

    doc = fitz.open(str(INPUT_PDF))
    annotations_added = 0

    for page_num in range(len(doc)):
        page = doc[page_num]

        # Also handle STARTPROTOKOLL (= log 0)
        start_instances = page.search_for("STARTPROTOKOLL")
        for inst in start_instances:
            height = inst.y1 - inst.y0
            if height < 12:
                continue
            if 0 not in audio_protocols:
                continue
            icon_x = inst.x1 + 5
            icon_y = inst.y0 + 2
            rect = fitz.Rect(icon_x, icon_y, icon_x + 12, icon_y + 12)
            url = f"{BASE_URL}/0"
            annot = page.add_freetext_annot(
                rect, "▶", fontsize=9, fontname="helv",
                text_color=(0.1, 0.5, 0.9), fill_color=(1, 1, 1),
            )
            annot.set_opacity(0.9)
            annot.update()
            page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": url})
            annotations_added += 1

        # Search for PROTOKOLL headers - need to verify it's actually uppercase
        # pymupdf search_for is case-insensitive, so we need to verify
        text_instances = page.search_for("PROTOKOLL")

        for inst in text_instances:
            # Filter by height: headers are large font (height > 12pt)
            # Inline references "Lies Protokoll X" are small (height ~10pt)
            height = inst.y1 - inst.y0
            if height < 12:
                continue

            # Get the actual text at this position
            clip = fitz.Rect(inst.x0, inst.y0, inst.x1 + 80, inst.y1)
            text = page.get_text("text", clip=clip).strip()

            m = re.match(r"PROTOKOLL\s+(\d+)", text, re.IGNORECASE)
            if not m:
                continue

            prot_num = int(m.group(1))
            if prot_num not in audio_protocols:
                continue

            # Find the full rect of "PROTOKOLL XXX" including the number
            full_search = f"PROTOKOLL {prot_num}"
            full_instances = page.search_for(full_search)
            # Filter: only use the large-font instance (height >= 12)
            full_rect = None
            for fi in full_instances:
                if fi.y1 - fi.y0 >= 12:
                    full_rect = fi
                    break
            if not full_rect:
                full_rect = inst

            # Position: to the right of the full "PROTOKOLL X" text
            icon_x = full_rect.x1 + 5
            icon_y = full_rect.y0 + 2

            if prot_num in splits:
                # Multiple play buttons: ▶A ▶B ▶C
                letters = splits[prot_num]
                for i, letter in enumerate(letters):
                    x_pos = icon_x + i * 18
                    rect = fitz.Rect(x_pos, icon_y, x_pos + 16, icon_y + 12)
                    url = f"{BASE_URL}/{prot_num}_{letter}"

                    # Create a Link annotation with visible appearance
                    annot = page.add_freetext_annot(
                        rect,
                        f"▶{letter}",
                        fontsize=7,
                        fontname="helv",
                        text_color=(0.1, 0.5, 0.9),
                        fill_color=(1, 1, 1),
                    )
                    annot.set_opacity(0.9)
                    annot.update()

                    # Add URI link over the same area
                    page.insert_link({
                        "kind": fitz.LINK_URI,
                        "from": rect,
                        "uri": url,
                    })
                    annotations_added += 1
            else:
                # Single play button
                rect = fitz.Rect(icon_x, icon_y, icon_x + 12, icon_y + 12)
                url = f"{BASE_URL}/{prot_num}"

                annot = page.add_freetext_annot(
                    rect,
                    "▶",
                    fontsize=9,
                    fontname="helv",
                    text_color=(0.1, 0.5, 0.9),
                    fill_color=(1, 1, 1),
                )
                annot.set_opacity(0.9)
                annot.update()

                page.insert_link({
                    "kind": fitz.LINK_URI,
                    "from": rect,
                    "uri": url,
                })
                annotations_added += 1

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT_PDF))
    doc.close()

    print(f"\n  Annotations added: {annotations_added}")
    print(f"  Output: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
