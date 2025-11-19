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
            const char = line[i];

            // Rule 3: Punctuation
            if (char === '、' || char === ',') {
                mml += "r16 ";
                i++;
                continue;
            }
            if (char === '。' || char === '.') {
                mml += "r4 ";
                i++;
                continue;
            }

            // Rule 4: Repetition
            // Check how many times this char repeats
            let repeatCount = 1;
            while (i + repeatCount < line.length && line[i + repeatCount] === char) {
                repeatCount++;
            }

            // Determine Note Length based on repetition
            // Default l8. If repeats, make it longer.
            // 1 -> 8, 2 -> 4, 3 -> 2, 4+ -> 1
            let duration = "8";
            if (repeatCount === 2) duration = "4";
            else if (repeatCount === 3) duration = "2";
            else if (repeatCount >= 4) duration = "1";

            // Rule 2: Character Type to Octave
            // Hiragana: o5, Katakana: o4, Kanji: o3, Others: o4
            let octave = 4;
            if (isHiragana(char)) octave = 5;
            else if (isKatakana(char)) octave = 4;
            else if (isKanji(char)) octave = 3;
            else octave = 4; // Default

            // Rule 1: Character Code to Pitch
            // Use Unicode code point % 12
            const code = char.codePointAt(0) || 0;
            const noteIndex = code % 12;
            const note = NOTES[noteIndex];

            // Construct MML token
            mml += `o${octave} ${note}${duration} `;

            i += repeatCount;
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
