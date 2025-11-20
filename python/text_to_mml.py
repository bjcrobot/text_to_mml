import argparse
import sys
import re
from midiutil import MIDIFile

NOTES = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b"]

INSTRUMENTS = {
    'piano': 1,      # Acoustic Grand Piano
    'chiptune': 81,  # Lead 1 (square)
    'strings': 49,   # String Ensemble 1
    'flute': 74,     # Flute
    'guitar': 25,    # Acoustic Guitar (nylon)
    'lead': 82       # Lead 2 (sawtooth)
}

def get_char_type(char):
    # Hiragana: 0x3040 - 0x309F
    if '\u3040' <= char <= '\u309f':
        return 'hiragana'
    # Katakana: 0x30A0 - 0x30FF
    elif '\u30a0' <= char <= '\u30ff':
        return 'katakana'
    # Kanji (Common CJK Unified Ideographs range): 0x4E00 - 0x9FFF
    elif '\u4e00' <= char <= '\u9fff':
        return 'kanji'
    return 'other'

def convert_text_to_mml(text):
    mml = ""
    lines = text.splitlines()

    # Default MML settings
    mml += "t120 v10 @0 "

    for line in lines:
        line = line.strip()
        if not line:
            mml += "r4 "
            continue

        # Rule 5: Line length to Tempo
        length = len(line)
        # Match Web version: > 20 chars -> 100 BPM, else 180 BPM
        tempo = 100 if length > 20 else 180
        
        mml += f"t{tempo} "

        i = 0
        while i < len(line):
            char1 = line[i]
            char2 = line[i+1] if i + 1 < len(line) else None

            # --- Char 1: Pitch & Octave ---
            
            # Rule 2: Character Type to Octave
            octave = 4
            ctype = get_char_type(char1)
            if ctype == 'hiragana': octave = 5
            elif ctype == 'katakana': octave = 4
            elif ctype == 'kanji': octave = 3
            else: octave = 4

            # Rule 1: Character Code to Pitch
            code1 = ord(char1)
            note_index = code1 % 12
            note = NOTES[note_index]

            # --- Char 2: Duration & Rest ---
            duration = "4" # Default
            is_rest = False

            if char2:
                code2 = ord(char2)
                rhythm_type = code2 % 8
                
                if rhythm_type == 0: duration = "16"
                elif rhythm_type == 1: duration = "8"
                elif rhythm_type == 2: duration = "8"
                elif rhythm_type == 3: duration = "4"
                elif rhythm_type == 4: duration = "2"
                elif rhythm_type == 5: duration = "8."
                elif rhythm_type == 6: 
                    is_rest = True
                    duration = "8"
                elif rhythm_type == 7: 
                    is_rest = True
                    duration = "4"

            # Construct MML token
            if is_rest:
                mml += f"r{duration} "
            else:
                mml += f"o{octave} {note}{duration} "

            i += 2

    return mml.strip()

def save_as_midi(mml, filename, program_change=1):
    midi = MIDIFile(1)  # One track
    track = 0
    time = 0    # In beats
    channel = 0
    volume = 100  # 0-127

    midi.addTrackName(track, time, "TextToMML Track")
    midi.addTempo(track, time, 120)
    midi.addProgramChange(track, channel, time, program_change)

    tokens = mml.split()
    
    current_octave = 4
    current_duration_val = 8 # Denominator (e.g. 8 for 8th note)
    
    # Note mapping for parsing
    note_map = {
        'c': 0, 'c+': 1, 'd': 2, 'd+': 3, 'e': 4, 'f': 5, 'f+': 6, 
        'g': 7, 'g+': 8, 'a': 9, 'a+': 10, 'b': 11
    }

    for token in tokens:
        if not token: continue
        cmd = token[0].lower()
        val_str = token[1:]
        
        if cmd == 't':
            # Tempo
            try:
                bpm = int(val_str)
                midi.addTempo(track, time, bpm)
            except ValueError: pass
            
        elif cmd == 'o':
            # Octave
            try:
                current_octave = int(val_str)
            except ValueError: pass
            
        elif cmd == 'l':
            # Default length
            try:
                current_duration_val = int(val_str)
            except ValueError: pass
            
        elif cmd == 'v':
            # Volume (MML 0-15 -> MIDI 0-127)
            try:
                v = int(val_str)
                volume = min(127, int(v * (127/15)))
            except ValueError: pass
            
        elif cmd == 'r':
            # Rest
            dur_val = int(val_str) if val_str else current_duration_val
            duration = 4.0 / dur_val
            time += duration
            
        elif cmd in ['c', 'd', 'e', 'f', 'g', 'a', 'b']:
            # Note
            note_name = cmd
            rest = val_str
            
            # Handle sharp/flat
            if rest.startswith('+') or rest.startswith('#'):
                note_name += '+'
                rest = rest[1:]
            elif rest.startswith('-'):
                # Flat is previous note sharp (simplified)
                # Ideally we map properly, but for now let's just ignore or handle simply
                # Since our generator only outputs +, we might not need - handling for generated MML
                pass

            # Duration
            dur_val = int(rest) if rest else current_duration_val
            duration = 4.0 / dur_val
            
            # Calculate MIDI pitch
            # C4 = 60. MIDI note = (octave + 1) * 12 + note_index
            base_note = note_map.get(note_name, 0)
            pitch = (current_octave + 1) * 12 + base_note
            
            midi.addNote(track, channel, pitch, time, duration, volume)
            time += duration

    with open(filename, "wb") as output_file:
        midi.writeFile(output_file)
    print(f"MIDI saved to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Convert text to MML and optionally MIDI.')
    parser.add_argument('file', nargs='?', help='Input text file path')
    parser.add_argument('--gui', action='store_true', help='Launch GUI (Not implemented yet)')
    parser.add_argument('--midi', '-m', help='Output MIDI file path')
    parser.add_argument('--instrument', '-i', choices=INSTRUMENTS.keys(), default='piano', help='Select instrument (default: piano)')
    
    args = parser.parse_args()

    if args.gui:
        print("GUI mode is not implemented yet.")
        return

    text = ""
    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                text = f.read()
        except FileNotFoundError:
            print(f"Error: File '{args.file}' not found.", file=sys.stderr)
            sys.exit(1)
    else:
        # Read from stdin if no file provided
        if not sys.stdin.isatty():
            # Set stdin encoding to utf-8 explicitly for Windows
            sys.stdin.reconfigure(encoding='utf-8')
            text = sys.stdin.read()
        else:
            print("Please provide a file path or pipe text to stdin.")
            parser.print_help()
            return

    if text:
        mml = convert_text_to_mml(text)
        print(mml)
        
        if args.midi:
            program_change = INSTRUMENTS.get(args.instrument, 1)
            save_as_midi(mml, args.midi, program_change)

if __name__ == "__main__":
    main()
