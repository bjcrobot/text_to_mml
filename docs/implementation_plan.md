# Text-to-MML Converter Implementation Plan

## Goal Description
Create a web application that converts input text (e.g., novels from Aozora Bunko) into MML (Music Macro Language) based on specific rules and plays it back as audio. This serves as a "joke tool" to sonify text.

## User Review Required
> [!IMPORTANT]
> **Rule 1 Adjustment**: The user suggested using "the first byte of UTF-8" for pitch. However, for Japanese text (Hiragana/Kanji), the first byte is often identical (e.g., `0xE3`), which would result in a monotone sound.
> **Proposal**: I will use the **Unicode Code Point** value instead to generate diverse pitches.

> [!NOTE]
> **Rule 5 Interpretation**: The user wrote "@v100 (slow), @v200 (fast)". In MML, `@` usually denotes instrument and `v` denotes volume. Tempo is `t`. Given the context "speed of sound", I will interpret this as **Tempo (t)**.

## Proposed Changes

### Project Structure
I will use **Vite** with **Vanilla TypeScript** for a lightweight and fast implementation. **Tone.js** will be used for audio synthesis.

#### [NEW] [index.html](file:///index.html)
- Main entry point.
- Contains the layout: Header, Input Textarea, Controls (Play, Stop), and a visualizer placeholder.

#### [NEW] [src/main.ts](file:///src/main.ts)
- Handles DOM events.
- Manages Tone.js synth instances.

#### [NEW] [src/converter.ts](file:///src/converter.ts)
- Implements the conversion logic:
    1.  **Pitch**: `CodePoint % 12` mapped to scale (C, C#, D...).
    2.  **Octave**:
        - Hiragana: o5
        - Katakana: o4
        - Kanji: o3
        - Others: o4
    3.  **Rests**:
        - `、` (Comma) -> `r16`
        - `。` (Period) -> `r4`
    4.  **Duration**:
        - Default: `l8` (or `l4` depending on pacing)
        - Consecutive identical chars: Increase duration (e.g., `l2`).
    5.  **Tempo**:
        - Calculate line byte length.
        - Long line (> threshold): `t100`
        - Short line (< threshold): `t200`

#### [NEW] [src/style.css](file:///src/style.css)
- Modern, "joke tool" but polished aesthetic.
- Responsive design.

## Verification Plan

### Manual Verification
- Input various texts (Japanese novels, random strings).
- Verify that:
    - Different characters produce different pitches.
    - Hiragana/Katakana/Kanji sound in different octaves.
    - Punctuation creates pauses.
    - Line length changes the playback speed.
