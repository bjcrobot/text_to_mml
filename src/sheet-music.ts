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
        let totalBeats = 0;

        // Map MMLEvents to VexFlow StaveNotes
        events.forEach(event => {
            if (event.type === 'note' && event.pitch && event.duration) {
                // pitch: "C#4" -> keys: ["c#/4"]
                // Regex to match Note + Accidental(optional) + Octave
                const keys = [event.pitch.replace(/^([a-gA-G][#b]?)(\d+)$/, '$1/$2').toLowerCase()];
                const duration = String(event.duration);

                notes.push(new StaveNote({ keys: keys, duration: duration }));
                totalBeats += 4 / event.duration;
            } else if (event.type === 'rest' && event.duration) {
                // Rest needs a key (usually "b/4") and type "r"
                const duration = String(event.duration) + "r";
                notes.push(new StaveNote({ keys: ["b/4"], duration: duration }));
                totalBeats += 4 / event.duration;
            }
        });

        if (notes.length === 0) return;

        // Calculate voice time signature
        const voiceBeats = Math.ceil(totalBeats);
        const timeSig = `${voiceBeats}/4`;

        // Create a voice with the calculated length
        const voice = score.voice(notes, { time: timeSig });

        voice.setStrict(false);

        // Add voice to system
        system.addStave({
            voices: [voice]
        }).addClef('treble');

        vf.draw();

        // Resize SVG to fit content
        const requiredWidth = Math.max(800, voiceBeats * 50 + 50);
        const svg = div.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', String(requiredWidth));
            svg.setAttribute('viewBox', `0 0 ${requiredWidth} 200`);
        }
    }
}
