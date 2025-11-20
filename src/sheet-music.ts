import { Factory, StaveNote } from 'vexflow';
import { MMLEvent } from './mml-parser';

export class SheetMusicRenderer {
    private divId: string;

    constructor(divId: string) {
        this.divId = divId;
    }

    render(events: MMLEvent[]) {
        const div = document.getElementById(this.divId);
        if (!div) return;
        div.innerHTML = ''; // Clear previous

        // VexFlow 4.x Factory
        const vf = new Factory({
            renderer: { elementId: this.divId, width: 800, height: 200 }
        });

        const score = vf.EasyScore();
        const system = vf.System();

        const notes: StaveNote[] = [];

        // Map MMLEvents to VexFlow StaveNotes
        events.forEach(event => {
            if (event.type === 'note' && event.pitch && event.duration) {
                // pitch: "C#4" -> keys: ["c#/4"]
                // duration: 4 -> "q", 8 -> "8", 16 -> "16"
                const keys = [event.pitch.replace(/(\w+)(\d+)/, '$1/$2').toLowerCase()];
                const duration = String(event.duration);

                notes.push(new StaveNote({ keys: keys, duration: duration }));
            } else if (event.type === 'rest' && event.duration) {
                // Rest needs a key (usually "b/4") and type "r"
                const duration = String(event.duration) + "r";
                notes.push(new StaveNote({ keys: ["b/4"], duration: duration }));
            }
        });

        if (notes.length === 0) return;

        // Create a voice
        const voice = score.voice(notes, { time: '4/4' });

        // Disable strict timing to allow arbitrary MML sequences without erroring on measure bounds
        voice.setStrict(false);

        // Add voice to system
        system.addStave({
            voices: [voice]
        }).addClef('treble').addTimeSignature('4/4');

        vf.draw();

        // Resize SVG to fit content if possible
        const requiredWidth = Math.max(800, notes.length * 40);
        const svg = div.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', String(requiredWidth));
            svg.setAttribute('viewBox', `0 0 ${requiredWidth} 200`);
        }
    }
}
