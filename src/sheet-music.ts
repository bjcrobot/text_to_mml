import { Factory, StaveNote, Dot } from 'vexflow';
import { MMLEvent } from './mml-parser';

export class SheetMusicRenderer {
    private divId: string;

    constructor(divId: string) {
        this.divId = divId;
    }

    render(events: MMLEvent[], tempo: number = 120) {
        const div = document.getElementById(this.divId);
        if (!div) return;
        div.innerHTML = ''; // Clear previous

        if (events.length === 0) return;

        // VexFlow 4.x Factory
        // Using standard API for more control (like setTempo)
        const vf = new Factory({
            renderer: { elementId: this.divId, width: 800, height: 200 }
        });

        const score = vf.EasyScore();
        // We'll use EasyScore for note creation helper if useful, but maybe just manual StaveNotes
        // actually manual StaveNotes are already being created.

        const notes: StaveNote[] = [];
        let totalBeats = 0;

        // Map MMLEvents to VexFlow StaveNotes
        events.forEach(event => {
            if (event.type === 'note' && event.pitch && event.duration) {
                // pitch: "C#4" -> keys: ["c#/4"]
                // Regex to match Note + Accidental(optional) + Octave
                const keys = [event.pitch.replace(/^([a-gA-G][#b]?)(\d+)$/, '$1/$2').toLowerCase()];
                const duration = String(event.duration);

                const note = new StaveNote({ keys: keys, duration: duration });

                // Handle dotted notes (e.g. "8.")
                if (duration.includes('d')) { // VexFlow uses 'd' for dotted in some contexts, but constructor takes '8d'? 
                    // Actually StaveNote duration string '8d' means dotted 8th.
                    // My MML parser outputs "8." for dotted. 
                    // I need to convert "8." to "8" and add dot.
                    // Wait, my parser outputs "8." in MML, but `parseMML` converts it?
                    // Let's check mml-parser.ts or just handle it here.
                    // If duration is "8.", VexFlow expects "8" and a Dot modifier.
                }

                // My MML parser logic for duration:
                // It seems I pass `event.duration` which is a string like "8", "4", "16".
                // Does it handle dots?
                // In `converter.ts`, I added `duration = "8."`.
                // `parseMML` likely passes this through.
                // VexFlow StaveNote duration "8d" is valid? Or "8" + addDot?
                // Standard VexFlow: new StaveNote({ ... duration: "8" }).addModifier(new Dot())

                if (duration.includes('.')) {
                    note.setDuration(duration.replace('.', ''));
                    note.addModifier(new Dot());
                }

                notes.push(note);

                // Calculate beats (approx)
                let beatVal = 4 / parseInt(duration.replace('.', ''));
                if (duration.includes('.')) beatVal *= 1.5;
                totalBeats += beatVal;

            } else if (event.type === 'rest' && event.duration) {
                const duration = String(event.duration) + "r";
                const note = new StaveNote({ keys: ["b/4"], duration: duration });

                if (duration.includes('.')) {
                    note.setDuration(duration.replace('.', '') + "r"); // "8r"
                    note.addModifier(new Dot());
                }

                notes.push(note);

                let beatVal = 4 / parseInt(duration.replace('.', '').replace('r', ''));
                if (duration.includes('.')) beatVal *= 1.5;
                totalBeats += beatVal;
            }
        });

        if (notes.length === 0) return;

        // Calculate required width
        // A rough estimate: 30px per note + padding
        const requiredWidth = Math.max(800, notes.length * 40 + 100);

        // Resize renderer
        vf.getContext().resize(requiredWidth, 200);

        const system = vf.System({
            width: requiredWidth,
            formatOptions: { align_rests: true } // Optional
        });

        // Create a stave
        // System.addStave returns the system, but we can access the created stave?
        // No, System abstracts it.
        // If we want `setTempo`, we might need to access the stave.
        // `system.addStave` takes `voice` params.

        // Let's try to use `vf.Stave` directly instead of `System` for this simple single-line score.
        // It's easier to control.

        const context = vf.getContext();
        const stave = new StaveNote({ keys: ["b/4"], duration: "4r" }).getStave();
        // Wait, I need to create a Stave object.
        // `vf.Stave` is not available on `Factory` instance directly as a property?
        // `vf` is a Factory. `vf.Stave` creates a Stave.

        const staveObj = vf.Stave({ x: 10, y: 40, width: requiredWidth - 20 });
        staveObj.addClef('treble');
        staveObj.addTimeSignature('4/4'); // Just visual
        staveObj.setTempo({ bpm: tempo, name: 'BPM' }, 0);

        const voice = vf.Voice().setStrict(false).addTickables(notes);

        // Format and draw
        vf.Formatter().joinVoices([voice]).format([voice], requiredWidth - 50);

        staveObj.setContext(context).draw();
        voice.draw(context, staveObj);
    }
}
