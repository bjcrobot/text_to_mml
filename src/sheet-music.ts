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

        const vf = new Factory({
            renderer: { elementId: this.divId, width: 800, height: 200 }
        });

        const notes: StaveNote[] = [];
        let totalBeats = 0;

        events.forEach(event => {
            if (event.type === 'note' && event.pitch && event.duration) {
                const keys = [event.pitch.replace(/^([a-gA-G][#b]?)(\d+)$/, '$1/$2').toLowerCase()];
                const durationStr = String(event.duration);
                const isDotted = durationStr.includes('.');
                const vexDuration = durationStr.replace('.', '');

                const note = new StaveNote({ keys: keys, duration: vexDuration });

                if (isDotted) {
                    note.addModifier(new Dot());
                }

                notes.push(note);

                let beatVal = 4 / parseInt(vexDuration);
                if (isDotted) beatVal *= 1.5;
                totalBeats += beatVal;

            } else if (event.type === 'rest' && event.duration) {
                const durationStr = String(event.duration);
                const isDotted = durationStr.includes('.');
                const vexDuration = durationStr.replace('.', '') + "r";

                const note = new StaveNote({ keys: ["b/4"], duration: vexDuration });

                if (isDotted) {
                    note.addModifier(new Dot());
                }

                notes.push(note);

                let beatVal = 4 / parseInt(vexDuration.replace('r', ''));
                if (isDotted) beatVal *= 1.5;
                totalBeats += beatVal;
            }
        });

        if (notes.length === 0) return;

        const requiredWidth = Math.max(800, notes.length * 40 + 100);
        vf.getContext().resize(requiredWidth, 200);

        const context = vf.getContext();

        // Create Stave
        const staveObj = vf.Stave({ x: 10, y: 40, width: requiredWidth - 20 });
        staveObj.addClef('treble');
        staveObj.addTimeSignature('4/4');
        staveObj.setTempo({ bpm: tempo, name: 'BPM' }, 0);

        const voice = vf.Voice().setStrict(false).addTickables(notes);

        vf.Formatter().joinVoices([voice]).format([voice], requiredWidth - 50);

        staveObj.setContext(context).draw();
        voice.draw(context, staveObj);
    }
}
