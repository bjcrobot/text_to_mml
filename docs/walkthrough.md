# Text to MML Converter Walkthrough

## Overview
This project converts input text (e.g., novels, articles) into Music Macro Language (MML) based on character codes and types. It includes both a Web Application for real-time playback and a Python script for batch processing.

## Features
- **Text Analysis**: Converts characters to musical notes based on Unicode values.
- **Dynamic Timing**: Adjusts tempo based on line length.
- **Rhythm**: Converts punctuation to rests and repeated characters to longer note durations.
- **Dual Interface**:
    - **Web App**: Interactive UI with instant playback using Tone.js.
    - **Python Script**: CLI tool for processing text files.

## How to Run

### Web Application
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Open the URL shown in the terminal (usually `http://localhost:5173`).

### Python Script
1.  Run the script with a text file as an argument:
    ```bash
    python converter.py sample.txt
    ```
2.  Or pipe text via stdin:
    ```bash
    echo "こんにちは" | python converter.py
    ```
3.  The MML will be output to the console. You can redirect it to a file:
    ```bash
    cd python
    python converter.py sample.txt > output.mml
    ```
4.  To export as a MIDI file:
    ```bash
    python converter.py sample.txt --midi output.mid
    ```

## Verification Results
- [x] **Logic**:
    - MML generation logic covers all 5 requested rules.
    - Timing logic handles tempo changes accurately.
    - **Bug Fix**: Resolved "AudioContext was not allowed to start" by lazily initializing the synthesizer on first user interaction.
    - **Bug Fix**: Fixed double playback and unresponsive Stop button by refactoring to use `Tone.Transport` for scheduling.
    - **Bug Fix**: Fixed Stop button being disabled during playback by separating audio stop logic from UI reset logic.
    - **Feature**: Added Pause/Resume functionality with a toggle button.
    - **Cleanup**: Removed debug logs and test button after successful verification.
    - TypeScript compilation is clean.
- [x] **Python Version**:
    - Validated that `python/converter.py` produces MML output consistent with the logic.
    - CLI arguments work as expected.
    - **MIDI Export**: Validated that `--midi` flag generates a valid .mid file.

## Next Steps (Optional)
- [ ] Add GUI to Python script (`--gui` flag).
- [ ] Selectable instruments.
