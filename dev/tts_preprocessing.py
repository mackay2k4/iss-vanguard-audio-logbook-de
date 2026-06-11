#!/usr/bin/env python3
"""
TTS Preprocessing Module
Transforms text files into TTS-ready text:
- Joins mid-sentence line breaks (PDF artifacts)
- Keeps meaningful pauses (paragraph breaks, speaker changes, sound effects)
- Removes sound effect markers (returned separately for mixing)
- Replaces bullet points with ordinals
"""

import re
from pathlib import Path


def preprocess_for_tts(text: str) -> dict:
    """
    Preprocess text for TTS generation.
    
    Returns dict with:
        'tts_text': cleaned text ready for speech synthesis
        'effects': list of (position_marker, effect_name) tuples
        'characters': list of unique character names found
    """
    lines = text.strip().split('\n')
    
    # Skip header line if still present (legacy)
    if lines and re.match(r'^(PROTOKOLL|STARTPROTOKOLL)', lines[0]):
        lines = lines[1:]
    
    # Phase 1: Extract sound effects and mark positions
    effects = []
    processed_lines = []
    effect_counter = 0
    
    for line in lines:
        sfx_match = re.match(r'^\s*\*\*\*\s*(.+?)\s*\*\*\*\s*$', line)
        if sfx_match:
            effect_name = sfx_match.group(1)
            marker = f'[SFX_{effect_counter}]'
            effects.append((marker, effect_name))
            processed_lines.append(marker)
            effect_counter += 1
        else:
            processed_lines.append(line)
    
    # Phase 2: Join mid-sentence line breaks, keep meaningful ones
    joined_lines = []
    i = 0
    while i < len(processed_lines):
        line = processed_lines[i]
        stripped = line.strip()
        
        # Empty line = paragraph break (keep as pause)
        if not stripped:
            if joined_lines and joined_lines[-1] != '':
                joined_lines.append('')
            i += 1
            continue
        
        # SFX marker (keep on its own line)
        if stripped.startswith('[SFX_'):
            joined_lines.append(stripped)
            i += 1
            continue
        
        # Start building a joined line
        current = stripped
        i += 1
        
        # Keep joining next lines if they're continuations (mid-sentence)
        while i < len(processed_lines):
            next_line = processed_lines[i].strip()
            
            # Stop joining at: empty line, SFX, speaker tag
            if not next_line:
                break
            if next_line.startswith('[SFX_'):
                break
            if re.match(r'^\[.+?\]:', next_line):
                # Speaker tag = new speaker, keep separate
                break
            
            # Check if current line ends mid-sentence
            if current and current[-1] in '.!?:"…»':
                # Sentence ended — keep the break (natural pause)
                break
            
            # Mid-sentence continuation — join with space
            current = current + ' ' + next_line
            i += 1
        
        joined_lines.append(current)
    
    # Phase 3: Build final TTS text
    # Replace bullet points with ordinals
    tts_text = '\n'.join(joined_lines)
    
    bullet_count = 0
    ordinals = ['Erstens,', 'Zweitens,', 'Drittens,', 'Viertens,',
                'Fünftens,', 'Sechstens,', 'Siebtens,', 'Achtens,',
                'Neuntens,', 'Zehntens,']
    
    def replace_bullet(m):
        nonlocal bullet_count
        result = ordinals[bullet_count] if bullet_count < len(ordinals) else f'{bullet_count + 1}tens,'
        bullet_count += 1
        return result + ' '
    
    tts_text = re.sub(r'^[•]\s*', replace_bullet, tts_text, flags=re.MULTILINE)
    
    # Replace abbreviations for better pronunciation
    tts_text = tts_text.replace('km/h', 'Kilometer pro Stunde')
    tts_text = tts_text.replace('km/s', 'Kilometer pro Sekunde')
    # Fix pronunciation of speaker tags with numbers
    tts_text = tts_text.replace('[Außenteammitglied 1]', '[Außenteammitglied eins]')
    tts_text = tts_text.replace('[Außenteammitglied 2]', '[Außenteammitglied zwei]')
    tts_text = tts_text.replace('[Außenteammitglied 3]', '[Außenteammitglied drei]')
    tts_text = tts_text.replace('[Teammitglied 1]', '[Teammitglied eins]')
    tts_text = tts_text.replace('[Teammitglied 2]', '[Teammitglied zwei]')
    tts_text = tts_text.replace('[Teammitglied 3]', '[Teammitglied drei]')
    tts_text = tts_text.replace('[Stimme 1]', '[Stimme eins]')
    tts_text = tts_text.replace('[Stimme 2]', '[Stimme zwei]')
    # "2 g" / "90 g" = gravity units, keep attached to number
    tts_text = re.sub(r'(\d+(?:,\d+)?)\s+g\b', r'\1g', tts_text)
    
    # Clean up multiple blank lines
    tts_text = re.sub(r'\n{3,}', '\n\n', tts_text)
    tts_text = tts_text.strip()
    
    # Phase 4: Extract characters
    characters = list(set(re.findall(r'\[([^\]]+)\]:', tts_text)))
    
    return {
        'tts_text': tts_text,
        'effects': effects,
        'characters': characters,
    }


def get_tts_text_only(text: str) -> str:
    """Simple version: just get the TTS-ready text without effects info."""
    result = preprocess_for_tts(text)
    # Remove SFX markers from text (they'll be silent pauses)
    tts_text = re.sub(r'\[SFX_\d+\]\n?', '', result['tts_text'])
    tts_text = re.sub(r'\n{3,}', '\n\n', tts_text)
    return tts_text.strip()


# Test/demo
if __name__ == '__main__':
    text_dir = Path('../data/text')
    
    # Test with a few files
    test_files = ['protokoll_0000.txt', 'protokoll_0005.txt', 'protokoll_0258.txt', 'protokoll_0406.txt']
    
    for fname in test_files:
        f = text_dir / fname
        if not f.exists():
            continue
        content = f.read_text(encoding='utf-8')
        if 'Kein Audio' in content:
            continue
        
        result = preprocess_for_tts(content)
        
        print(f'=== {fname} ===')
        print(f'Characters: {result["characters"]}')
        print(f'Effects: {result["effects"]}')
        print(f'TTS text (first 300 chars):')
        print(result['tts_text'][:300])
        print()
        print()
