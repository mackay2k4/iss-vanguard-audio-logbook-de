#!/usr/bin/env python3
"""
Add play icons with links to LOCAL MP3 files in the PDF.
The PDF must be placed in the same folder as the MP3s.
Links open the MP3 file directly (OS default player).
"""

import re
from pathlib import Path

import fitz  # pymupdf

INPUT_PDF = Path("import/DE_ISS_Vanguard_Logbuch_links_boxV1-1.pdf")
OUTPUT_PDF = Path("../data/DE_ISS_Vanguard_Logbuch_offline.pdf")
TEXT_DIR = Path("../data/text")


def get_split_protocols() -> dict[int, list[str]]:
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
    print("Adding offline play icons to PDF...")

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
            filename = "audiofiles/protokoll_0000.ogg"
            annot = page.add_freetext_annot(
                rect, "▶", fontsize=9, fontname="helv",
                text_color=(0.8, 0.4, 0.0), fill_color=(1, 1, 1),
            )
            annot.set_opacity(0.9)
            annot.update()
            page.insert_link({"kind": fitz.LINK_LAUNCH, "from": rect, "file": filename})
            annotations_added += 1

        text_instances = page.search_for("PROTOKOLL")

        for inst in text_instances:
            # Filter: only large-font headers (height >= 12pt)
            height = inst.y1 - inst.y0
            if height < 12:
                continue

            clip = fitz.Rect(inst.x0, inst.y0, inst.x1 + 80, inst.y1)
            text = page.get_text("text", clip=clip).strip()

            m = re.match(r"PROTOKOLL\s+(\d+)", text, re.IGNORECASE)
            if not m:
                continue

            prot_num = int(m.group(1))
            if prot_num not in audio_protocols:
                continue

            # Find full rect of "PROTOKOLL XXX"
            full_search = f"PROTOKOLL {prot_num}"
            full_instances = page.search_for(full_search)
            full_rect = None
            for fi in full_instances:
                if fi.y1 - fi.y0 >= 12:
                    full_rect = fi
                    break
            if not full_rect:
                full_rect = inst

            # Position icon to the right
            icon_x = full_rect.x1 + 5
            icon_y = full_rect.y0 + 2

            if prot_num in splits:
                letters = splits[prot_num]
                for i, letter in enumerate(letters):
                    x_pos = icon_x + i * 18
                    rect = fitz.Rect(x_pos, icon_y, x_pos + 16, icon_y + 12)
                    filename = f"audiofiles/protokoll_{prot_num:04d}_{letter}.ogg"

                    annot = page.add_freetext_annot(
                        rect,
                        f"▶{letter}",
                        fontsize=7,
                        fontname="helv",
                        text_color=(0.8, 0.4, 0.0),
                        fill_color=(1, 1, 1),
                    )
                    annot.set_opacity(0.9)
                    annot.update()

                    # Link to local file (relative path)
                    page.insert_link({
                        "kind": fitz.LINK_LAUNCH,
                        "from": rect,
                        "file": filename,
                    })
                    annotations_added += 1
            else:
                rect = fitz.Rect(icon_x, icon_y, icon_x + 12, icon_y + 12)
                filename = f"audiofiles/protokoll_{prot_num:04d}.ogg"

                annot = page.add_freetext_annot(
                    rect,
                    "▶",
                    fontsize=9,
                    fontname="helv",
                    text_color=(0.8, 0.4, 0.0),
                    fill_color=(1, 1, 1),
                )
                annot.set_opacity(0.9)
                annot.update()

                page.insert_link({
                    "kind": fitz.LINK_LAUNCH,
                    "from": rect,
                    "file": filename,
                })
                annotations_added += 1

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT_PDF))
    doc.close()

    print(f"\n  Annotations added: {annotations_added}")
    print(f"  Output: {OUTPUT_PDF}")
    print(f"  (PDF must be in same folder as MP3 files)")


if __name__ == "__main__":
    main()
