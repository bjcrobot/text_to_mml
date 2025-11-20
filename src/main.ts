import * as Tone from 'tone';
import { convertTextToMML } from './converter';
// @ts-ignore
import MidiWriter from 'midi-writer-js';

// --- Tone.js MML Parser Helper ---

class MMLPlayer {
    private synth: Tone.PolySynth | null = null;

    constructor() {
        // Lazy initialization to avoid AudioContext warning
    }

    async play(mml: string) {
        await Tone.start();

        if (!this.synth) {
            this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        }

        this.stopAudio(); // Ensure clean state without resetting UI

        const tokens = mml.split(/\s+/);

        // Reset Transport
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;
        Tone.Transport.bpm.value = 120; // Keep Transport BPM constant as we calculate seconds manually

        let currentOctave = 4;
        let currentDurationVal = 8; // default 8th note (denominator)
        let currentBpm = 120;
        let accumulatedTime = 0; // in seconds

        tokens.forEach(token => {
            if (!token) return;
            const cmd = token.charAt(0).toLowerCase();
            const valStr = token.slice(1);
            const val = parseInt(valStr);

            if (cmd === 't') {
                // Tempo change
                if (!isNaN(val) && val > 0) {
                    currentBpm = val;
                }
            }
            else if (cmd === 'o') {
                if (!isNaN(val)) currentOctave = val;
            }
            else if (cmd === 'l') {
                if (!isNaN(val)) currentDurationVal = val;
            }
            else if (cmd === 'v') {
                // Volume - ignore for now
            }
            else if (cmd === 'r') {
                // Rest
                const durVal = valStr ? parseInt(valStr) : currentDurationVal;
                const beatCount = 4 / durVal; // 4/4 = 1 beat, 4/8 = 0.5 beat
                const durationSec = beatCount * (60 / currentBpm);
                accumulatedTime += durationSec;
            }
            else if (['c', 'd', 'e', 'f', 'g', 'a', 'b'].includes(cmd)) {
                // Note
                let note = cmd.toUpperCase();
                let rest = valStr;

                // Handle sharp/flat
                if (rest.startsWith('+') || rest.startsWith('#')) {
                    note += '#';
                    rest = rest.slice(1);
                } else if (rest.startsWith('-')) {
                    note += 'b';
                    rest = rest.slice(1);
                }

                // Handle duration
                const durVal = rest ? parseInt(rest) : currentDurationVal;
                const beatCount = 4 / durVal;
                const durationSec = beatCount * (60 / currentBpm);

                // Full note name
                const fullNote = `${note}${currentOctave}`;

                // Schedule on Transport
                Tone.Transport.schedule((time) => {
                    this.synth?.triggerAttackRelease(fullNote, durationSec, time);
                }, accumulatedTime);

                accumulatedTime += durationSec;
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
        track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

        const tokens = mml.split(/\s+/);

        let currentOctave = 4;
        let currentDurationVal = 8;
        let currentBpm = 120;

        // Initial Tempo
        track.setTempo(currentBpm);

        tokens.forEach(token => {
            if (!token) return;
            const cmd = token.charAt(0).toLowerCase();
            const valStr = token.slice(1);
            const val = parseInt(valStr);

            if (cmd === 't') {
                if (!isNaN(val) && val > 0) {
                    currentBpm = val;
                    track.setTempo(val);
                }
            }
            else if (cmd === 'o') {
                if (!isNaN(val)) currentOctave = val;
            }
            else if (cmd === 'l') {
                if (!isNaN(val)) currentDurationVal = val;
            }
            else if (cmd === 'r') {
                // Rest
                // MidiWriter uses 'wait' events or just note durations. 
                // Ideally we use a wait event or a silent note.
                // MidiWriter doesn't have explicit Rest, but we can use wait on the next note.
                // Or we can add a NoteEvent with velocity 0 or empty pitch?
                // Actually, MidiWriter tracks accumulate time. We can just add a 'wait' to the track?
                // No, MidiWriter events have 'duration'.
                // Let's use a workaround: NoteEvent with wait property?
                // Or just skip adding an event? No, that would skip time.
                // MidiWriter has `track.addEvent(new MidiWriter.NoteEvent({pitch: [], duration: '4'}))`
                // If pitch is empty, is it a rest?
                // Documentation says: "To create a rest, pass an empty array for pitch."

                const durVal = valStr ? valStr : String(currentDurationVal);
                // midi-writer expects duration like '4', '8', '16'.
                // Our valStr might be '4', '8'.

                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [],
                    duration: durVal
                }));
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

                const durVal = rest ? rest : String(currentDurationVal);
                const fullNote = `${note}${currentOctave}`;

                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [fullNote],
                    duration: durVal
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
        toggleLabel: "🌐 English"
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
        toggleLabel: "🌐 日本語"
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

        updateStatus("statusConverting");
        const mml = convertTextToMML(text);
        mmlOutput.textContent = mml;

        updateStatus("statusPlaying");
        document.body.classList.add('playing');
        stopBtn.disabled = false;
        if (downloadBtn) downloadBtn.disabled = false;

        await player.play(mml);
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
