/**
 * Text to MML Converter Logic
 */

// Scale mapping: 0-11 -> Note names
const NOTES = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];

export interface ConversionOptions {
    baseOctave?: number;
    baseSpeed?: number; // Not directly used in MML usually, but affects tempo choice
}

export function convertTextToMML(text: string, _options: ConversionOptions = {}): string {
    if (!text) return "";

    const lines = text.split(/\r?\n/);
    let mml = "";

    // Default settings
    // t: tempo, v: volume, l: default length, o: octave
    // Starting with a standard tempo and volume
    mml += "t120 v10 @0 ";

    for (const line of lines) {
        if (line.trim() === "") {
            mml += "r4 "; // Pause for empty lines
            continue;
        }

        // Rule 5: Line length to Tempo
        // Count bytes (approximate for JS string length vs byte length, but sufficient)
        // Using simple length for now.
        const lineLen = line.length;
        const tempo = lineLen > 20 ? 100 : 180; // Slower for long lines, faster for short
        mml += `t${tempo} `;

        let i = 0;
        while (i < line.length) {
            const char1 = line[i];
            const char2 = (i + 1 < line.length) ? line[i + 1] : null;

            // Skip punctuation rules for now to prioritize the new rhythm logic, 
            // or integrate them? The user wants "2-char chunk" logic.
            // Let's stick to the pure 2-char logic for musicality as requested, 
            // but maybe keep basic punctuation as rests if they appear as char1?
            // Actually, the previous punctuation rule might conflict. 
            // Let's treat punctuation as just another character for generating rhythm 
            // to keep it simple and consistent with the "deterministic" goal.

            // --- Char 1: Pitch & Octave ---

            // Rule 2: Character Type to Octave
            let octave = 4;
            if (isHiragana(char1)) octave = 5;
            else if (isKatakana(char1)) octave = 4;
            else if (isKanji(char1)) octave = 3;
            else octave = 4;

            // Rule 1: Character Code to Pitch
            const code1 = char1.codePointAt(0) || 0;
            const noteIndex = code1 % 12;
            const note = NOTES[noteIndex];

            // --- Char 2: Duration & Rest ---
            let duration = "4"; // Default if no char2
            let isRest = false;

            if (char2) {
                const code2 = char2.codePointAt(0) || 0;
                const rhythmType = code2 % 8;

                switch (rhythmType) {
                    case 0: duration = "16"; break;
                    case 1: duration = "8"; break;
                    case 2: duration = "8"; break;
                    case 3: duration = "4"; break;
                    case 4: duration = "2"; break;
                    case 5: duration = "8."; break;
                    case 6: isRest = true; duration = "8"; break;
                    case 7: isRest = true; duration = "4"; break;
                }
            }

            // Construct MML token
            if (isRest) {
                mml += `r${duration} `;
            } else {
                mml += `o${octave} ${note}${duration} `;
            }

            i += 2;
        }
    }

    return mml.trim();
}

function isHiragana(char: string): boolean {
    return /^[\u3040-\u309F]$/.test(char);
}

function isKatakana(char: string): boolean {
    return /^[\u30A0-\u30FF]$/.test(char);
}

function isKanji(char: string): boolean {
    // Simple range for common Kanji
    return /([\u3400-\u4DBF]|[\u4E00-\u9FFF])/.test(char);
}
