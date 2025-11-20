import * as Tone from 'tone';
import { convertTextToMML } from './converter';
import { parseMML } from './mml-parser';
import { SheetMusicRenderer } from './sheet-music';
// @ts-ignore
import MidiWriter from 'midi-writer-js';

// --- Instrument Definitions ---

type InstrumentType = 'piano' | 'chiptune' | 'strings' | 'flute' | 'guitar' | 'lead';

interface InstrumentPreset {
    nameKey: string;
    programChange: number; // MIDI Program Change number (1-128)
    createSynth: () => Tone.PolySynth;
}

const instrumentPresets: Record<InstrumentType, InstrumentPreset> = {
    piano: {
        nameKey: 'piano',
        programChange: 1, // Acoustic Grand Piano
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination()
    },
    chiptune: {
        nameKey: 'chiptune',
        programChange: 81, // Lead 1 (square)
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'square' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 }
        }).toDestination()
    },
    strings: {
        nameKey: 'strings',
        programChange: 49, // String Ensemble 1
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fmsawtooth' },
            envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 }
        }).toDestination()
    },
    flute: {
        nameKey: 'flute',
        programChange: 74, // Flute
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.1, decay: 0.1, sustain: 0.8, release: 0.5 }
        }).toDestination()
    },
    guitar: {
        nameKey: 'guitar',
        programChange: 25, // Acoustic Guitar (nylon)
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 } // Pluck-ish
        }).toDestination()
    },
    lead: {
        nameKey: 'lead',
        programChange: 82, // Lead 2 (sawtooth)
        createSynth: () => new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }
        }).toDestination()
    }
};

// --- Tone.js MML Parser Helper ---

class MMLPlayer {
    private synth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentType = 'piano';

    constructor() {
        // Lazy initialization
    }

    setInstrument(type: InstrumentType) {
        this.currentInstrument = type;
        if (this.synth) {
            this.synth.releaseAll();
            this.synth.dispose();
            this.synth = null;
        }
    }

    async play(mml: string) {
        await Tone.start();

        if (!this.synth) {
            this.synth = instrumentPresets[this.currentInstrument].createSynth();
        }

        this.stopAudio(); // Ensure clean state without resetting UI

        const events = parseMML(mml);

        // Reset Transport
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;
        Tone.Transport.bpm.value = 120; // Default

        let accumulatedTime = 0; // in seconds

        events.forEach(event => {
            if (event.type === 'tempo' && event.duration) {
                // In parseMML, duration holds the BPM value for 'tempo' type
                // But Tone.Transport.bpm is global, changing it mid-song is tricky with simple scheduling
                // For simplicity, we'll just set it if it's at start, or we'd need automation.
                // Let's just set it.
                Tone.Transport.bpm.value = event.duration;
            }
            else if (event.type === 'note' && event.pitch && event.durationSec) {
                const fullNote = event.pitch;
                const durationSec = event.durationSec;

                Tone.Transport.schedule((time) => {
                    this.synth?.triggerAttackRelease(fullNote, durationSec, time);
                }, accumulatedTime);

                accumulatedTime += durationSec;
            }
            else if (event.type === 'rest' && event.durationSec) {
                accumulatedTime += event.durationSec;
            }
        });

        // Schedule cleanup at the end
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => {
                this.onPlaybackComplete();
            }, time);
        }, accumulatedTime + 0.1);

        Tone.Transport.start();
        this.updatePauseButton(false);
    }

    pause() {
        if (Tone.Transport.state === 'started') {
            Tone.Transport.pause();
            updateStatus("statusPaused");
            document.body.classList.remove('playing');
            this.updatePauseButton(true);
        } else if (Tone.Transport.state === 'paused') {
            Tone.Transport.start();
            updateStatus("statusPlaying");
            document.body.classList.add('playing');
            this.updatePauseButton(false);
        }
    }

    stop() {
        this.stopAudio();
        this.onPlaybackComplete();
    }

    downloadMidi(mml: string) {
        const track = new MidiWriter.Track();
        const programChange = instrumentPresets[this.currentInstrument].programChange;
        track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: programChange }));

        const events = parseMML(mml);

        // Initial Tempo
        track.setTempo(120);

        events.forEach(event => {
            if (event.type === 'tempo' && event.duration) {
                track.setTempo(event.duration);
            }
            else if (event.type === 'note' && event.pitch && event.duration) {
                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [event.pitch],
                    duration: String(event.duration)
                }));
            }
            else if (event.type === 'rest' && event.duration) {
                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [],
                    duration: String(event.duration)
                }));
            }
        });

        const write = new MidiWriter.Writer(track);
        const blob = new Blob([write.buildFile() as any], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.mid';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private stopAudio() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.synth?.releaseAll();
    }

    private onPlaybackComplete() {
        updateStatus("statusReady");
        document.body.classList.remove('playing');
        const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
        if (stopBtn) stopBtn.disabled = true;
        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = translations[currentLang].pause;
        }
    }

    private updatePauseButton(isPaused: boolean) {
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
        const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

        if (pauseBtn) {
            pauseBtn.disabled = false;
            if (isPaused) {
                pauseBtn.innerHTML = translations[currentLang].resume;
            } else {
                pauseBtn.innerHTML = translations[currentLang].pause;
            }
        }
        if (stopBtn) stopBtn.disabled = false;
    }
}

// --- UI Logic ---

const player = new MMLPlayer();
const sheetMusicRenderer = new SheetMusicRenderer('sheet-music');

const textInput = document.getElementById('text-input') as HTMLTextAreaElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const mmlOutput = document.getElementById('mml-output') as HTMLPreElement;
const headerTitle = document.getElementById('header-title') as HTMLHeadingElement;
const headerDesc = document.getElementById('header-desc') as HTMLParagraphElement;
const mmlSummary = document.querySelector('summary') as HTMLElement;
const langToggle = document.getElementById('lang-toggle') as HTMLButtonElement;
const instrumentSelect = document.getElementById('instrument-select') as HTMLSelectElement;

// --- Localization ---

const translations = {
    ja: {
        title: "Text to MML Music Converter",
        desc: "テキストを音楽（MML）に変換して再生します",
        placeholder: "ここにテキストを入力してください（例：青空文庫の文章など）...",
        play: '<span class="icon">▶</span> 再生 / 変換',
        pause: '<span class="icon">⏸</span> 一時停止',
        resume: '<span class="icon">▶</span> 再開',
        stop: '<span class="icon">■</span> 停止',
        download: '<span class="icon">⬇</span> MIDI保存',
        statusReady: "Ready",
        statusConverting: "変換中...",
        statusPlaying: "再生中...",
        statusPaused: "一時停止中",
        mmlSummary: "生成されたMMLを見る",
        alertInput: "テキストを入力してください",
        alertPlayFirst: "まずは再生/変換を行ってください",
        toggleLabel: "🌐 English",
        instruments: {
            piano: "🎹 ピアノ",
            chiptune: "👾 チップチューン",
            strings: "🎻 ストリングス",
            flute: "🎷 フルート",
            guitar: "🎸 ギター",
            lead: "⚡ リード"
        }
    },
    en: {
        title: "Text to MML Music Converter",
        desc: "Convert text to music (MML) and play it back.",
        placeholder: "Enter text here (e.g., novels, articles)...",
        play: '<span class="icon">▶</span> Play / Convert',
        pause: '<span class="icon">⏸</span> Pause',
        resume: '<span class="icon">▶</span> Resume',
        stop: '<span class="icon">■</span> Stop',
        download: '<span class="icon">⬇</span> Save MIDI',
        statusReady: "Ready",
        statusConverting: "Converting...",
        statusPlaying: "Playing...",
        statusPaused: "Paused",
        mmlSummary: "View generated MML",
        alertInput: "Please enter some text.",
        alertPlayFirst: "Please play/convert first.",
        toggleLabel: "🌐 日本語",
        instruments: {
            piano: "🎹 Piano",
            chiptune: "👾 Chiptune",
            strings: "🎻 Strings",
            flute: "🎷 Flute",
            guitar: "🎸 Guitar",
            lead: "⚡ Lead"
        }
    }
};

let currentLang: 'ja' | 'en' = 'en';

function detectLanguage() {
    const lang = navigator.language;
    console.log(`Detected browser language: ${lang}`);
    if (lang.startsWith('ja')) {
        currentLang = 'ja';
    } else {
        currentLang = 'en';
    }
    applyTranslations();
}

function applyTranslations() {
    console.log(`Applying translations for: ${currentLang}`);
    const t = translations[currentLang];
    if (headerTitle) headerTitle.textContent = t.title;
    if (headerDesc) headerDesc.textContent = t.desc;
    if (textInput) textInput.placeholder = t.placeholder;
    if (playBtn) playBtn.innerHTML = t.play;
    if (pauseBtn) {
        if (pauseBtn.disabled) {
            pauseBtn.innerHTML = t.pause;
        }
    }
    if (stopBtn) stopBtn.innerHTML = t.stop;
    if (downloadBtn) downloadBtn.innerHTML = t.download;
    if (statusText && statusText.textContent === 'Ready') statusText.textContent = t.statusReady;
    if (mmlSummary) mmlSummary.textContent = t.mmlSummary;
    if (langToggle) langToggle.textContent = t.toggleLabel;

    // Update Instrument Select Options
    if (instrumentSelect) {
        const currentVal = instrumentSelect.value;
        instrumentSelect.innerHTML = ''; // Clear existing
        (Object.keys(instrumentPresets) as InstrumentType[]).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = t.instruments[key];
            instrumentSelect.appendChild(option);
        });
        if (currentVal) {
            instrumentSelect.value = currentVal;
        } else {
            instrumentSelect.value = 'piano';
        }
    }
}

// Initial detection
detectLanguage();

// Listen for browser language changes
window.addEventListener("languagechange", () => {
    console.log("Language change event detected");
    detectLanguage();
});

// Manual Toggle
if (langToggle) {
    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'ja' ? 'en' : 'ja';
        applyTranslations();
    });
}

// Instrument Change
if (instrumentSelect) {
    instrumentSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value as InstrumentType;
        player.setInstrument(val);
    });
}

function updateStatus(msgKey: keyof typeof translations['ja'] | string) {
    if (!statusText) return;
    const t = translations[currentLang];
    // Check if msgKey is a key in translations
    if (msgKey in t) {
        // @ts-ignore
        statusText.textContent = t[msgKey];
    } else {
        statusText.textContent = msgKey;
    }
}

if (playBtn) {
    playBtn.addEventListener('click', async () => {
        const text = textInput.value;
        if (!text) {
            alert(translations[currentLang].alertInput);
            return;
        }

        // Ensure AudioContext is resumed on user gesture
        await Tone.start();

        updateStatus("statusConverting");

        // Use setTimeout to allow the UI to update "Converting..." before heavy work
        setTimeout(async () => {
            try {
                const mml = convertTextToMML(text);
                mmlOutput.textContent = mml;

                // Render Sheet Music
                const events = parseMML(mml);
                sheetMusicRenderer.render(events);

                updateStatus("statusPlaying");
                document.body.classList.add('playing');
                stopBtn.disabled = false;
                if (downloadBtn) downloadBtn.disabled = false;

                await player.play(mml);
            } catch (e) {
                console.error("Conversion or Playback Error:", e);
                alert(`Error: ${e}`);
                updateStatus("statusReady");
                document.body.classList.remove('playing');
            }
        }, 50);
    });
}

if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
        player.pause();
    });
}

if (stopBtn) {
    stopBtn.addEventListener('click', () => {
        player.stop();
    });
}

if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        const mml = mmlOutput.textContent;
        if (!mml) {
            alert(translations[currentLang].alertPlayFirst);
            return;
        }
        player.downloadMidi(mml);
    });
}
