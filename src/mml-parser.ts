export interface MMLEvent {
    type: 'note' | 'rest' | 'tempo' | 'octave' | 'volume';
    pitch?: string; // e.g., "C4", "F#5"
    duration?: number; // denominator, e.g., 4, 8, 16
    durationSec?: number; // for playback
    midiPitch?: number; // for MIDI
    isRest?: boolean;
    originalToken?: string;
}

export function parseMML(mml: string): MMLEvent[] {
    const tokens = mml.split(/\s+/);
    const events: MMLEvent[] = [];

    let currentOctave = 4;
    let currentDurationVal = 8; // default 8th note
    let currentBpm = 120;

    tokens.forEach(token => {
        if (!token) return;
        const cmd = token.charAt(0).toLowerCase();
        const valStr = token.slice(1);
        const val = parseInt(valStr);

        if (cmd === 't') {
            if (!isNaN(val) && val > 0) {
                currentBpm = val;
                events.push({ type: 'tempo', duration: val }); // duration used as bpm holder
            }
        }
        else if (cmd === 'o') {
            if (!isNaN(val)) {
                currentOctave = val;
                events.push({ type: 'octave', duration: val }); // duration used as octave holder
            }
        }
        else if (cmd === 'l') {
            if (!isNaN(val)) currentDurationVal = val;
        }
        else if (cmd === 'r') {
            const durVal = valStr ? parseInt(valStr) : currentDurationVal;
            const beatCount = 4 / durVal;
            const durationSec = beatCount * (60 / currentBpm);
            events.push({
                type: 'rest',
                duration: durVal,
                durationSec: durationSec,
                isRest: true
            });
        }
        else if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(cmd)) {
            let note = cmd.toUpperCase();
            let rest = valStr;

            if (rest.startsWith('+') || rest.startsWith('#')) {
                note += '#';
                rest = rest.slice(1);
            } else if (rest.startsWith('-')) {
                note += 'b';
                rest = rest.slice(1);
            }

            const durVal = rest ? parseInt(rest) : currentDurationVal;
            const beatCount = 4 / durVal;
            const durationSec = beatCount * (60 / currentBpm);
            const fullNote = `${note}${currentOctave}`;

            events.push({
                type: 'note',
                pitch: fullNote,
                duration: durVal,
                durationSec: durationSec,
                isRest: false
            });
        }
    });

    return events;
}
