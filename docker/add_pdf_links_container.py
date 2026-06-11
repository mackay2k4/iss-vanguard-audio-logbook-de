#!/usr/bin/env python3
"""Container version: generates online PDF with play links."""

import os
import re
from pathlib import Path

import fitz

BASE_URL = os.environ.get("ISS_VANGUARD_BASE_URL", "http://localhost:8080/play")
INPUT_PDF = Path("/data/import/DE_ISS_Vanguard_Logbuch_links_boxV1-1.pdf")
OUTPUT_PDF = Path("/usr/share/nginx/html/DE_ISS_Vanguard_Logbuch_online.pdf")
TEXT_DIR = Path("/data/text")


def get_split_protocols():
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


def get_audio_protocols():
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
    if not INPUT_PDF.exists():
        print(f"  Source PDF not found: {INPUT_PDF}")
        return

    splits = get_split_protocols()
    audio_protocols = get_audio_protocols()

    doc = fitz.open(str(INPUT_PDF))
    annotations_added = 0

    for page_num in range(len(doc)):
        page = doc[page_num]

        # STARTPROTOKOLL
        for inst in page.search_for("STARTPROTOKOLL"):
            if inst.y1 - inst.y0 < 12:
                continue
            if 0 not in audio_protocols:
                continue
            icon_x = inst.x1 + 5
            icon_y = inst.y0 + 2
            rect = fitz.Rect(icon_x, icon_y, icon_x + 12, icon_y + 12)
            annot = page.add_freetext_annot(rect, "▶", fontsize=9, fontname="helv",
                text_color=(0.1, 0.5, 0.9), fill_color=(1, 1, 1))
            annot.set_opacity(0.9)
            annot.update()
            page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": f"{BASE_URL}/0"})
            annotations_added += 1

        # PROTOKOLL X
        for inst in page.search_for("PROTOKOLL"):
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

            full_instances = page.search_for(f"PROTOKOLL {prot_num}")
            full_rect = next((fi for fi in full_instances if fi.y1 - fi.y0 >= 12), inst)

            icon_x = full_rect.x1 + 5
            icon_y = full_rect.y0 + 2

            if prot_num in splits:
                for i, letter in enumerate(splits[prot_num]):
                    x_pos = icon_x + i * 18
                    rect = fitz.Rect(x_pos, icon_y, x_pos + 16, icon_y + 12)
                    annot = page.add_freetext_annot(rect, f"▶{letter}", fontsize=7, fontname="helv",
                        text_color=(0.1, 0.5, 0.9), fill_color=(1, 1, 1))
                    annot.set_opacity(0.9)
                    annot.update()
                    page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": f"{BASE_URL}/{prot_num}_{letter}"})
                    annotations_added += 1
            else:
                rect = fitz.Rect(icon_x, icon_y, icon_x + 12, icon_y + 12)
                annot = page.add_freetext_annot(rect, "▶", fontsize=9, fontname="helv",
                    text_color=(0.1, 0.5, 0.9), fill_color=(1, 1, 1))
                annot.set_opacity(0.9)
                annot.update()
                page.insert_link({"kind": fitz.LINK_URI, "from": rect, "uri": f"{BASE_URL}/{prot_num}"})
                annotations_added += 1

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT_PDF))
    doc.close()
    print(f"  {annotations_added} annotations added")


if __name__ == "__main__":
    main()
