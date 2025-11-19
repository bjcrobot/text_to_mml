import * as Tone from 'tone';
import { convertTextToMML } from './converter';

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
            updateStatus("Paused");
            document.body.classList.remove('playing');
            this.updatePauseButton(true);
        } else if (Tone.Transport.state === 'paused') {
            Tone.Transport.start();
            updateStatus("Playing...");
            document.body.classList.add('playing');
            this.updatePauseButton(false);
        }
    }

    stop() {
        this.stopAudio();
        this.onPlaybackComplete();
    }

    private stopAudio() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.synth?.releaseAll();
    }

    private onPlaybackComplete() {
        updateStatus("Ready");
        document.body.classList.remove('playing');
        const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
        if (stopBtn) stopBtn.disabled = true;
        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = '<span class="icon">⏸</span> 一時停止';
        }
    }

    private updatePauseButton(isPaused: boolean) {
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
        const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

        if (pauseBtn) {
            pauseBtn.disabled = false;
            if (isPaused) {
                pauseBtn.innerHTML = '<span class="icon">▶</span> 再開';
            } else {
                pauseBtn.innerHTML = '<span class="icon">⏸</span> 一時停止';
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
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const mmlOutput = document.getElementById('mml-output') as HTMLPreElement;

function updateStatus(msg: string) {
    if (statusText) statusText.textContent = msg;
}

if (playBtn) {
    playBtn.addEventListener('click', async () => {
        const text = textInput.value;
        if (!text) {
            alert("テキストを入力してください");
            return;
        }

        updateStatus("Converting...");
        const mml = convertTextToMML(text);
        mmlOutput.textContent = mml;

        updateStatus("Playing...");
        document.body.classList.add('playing');

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
