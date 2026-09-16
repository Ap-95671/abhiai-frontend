import { smoothMouth } from "./assistant-state";
/** Meter an actual media stream. Playback stays on the audio element (no double output). */
export class AudioMeter {
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;
  private value = 0;
  constructor(private context: AudioContext, private onLevel: (level: number) => void) {}
  attach(stream: MediaStream) {
    this.stop();
    this.source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.source.connect(this.analyser);
    const values = new Uint8Array(this.analyser.fftSize);
    let previous = 0;
    const sample = (now: number) => {
      if (!this.analyser) return;
      if (now - previous >= 33) { // Cap UI updates at 30 fps.
        const elapsed = previous ? now - previous : 33;
        previous = now;
        this.analyser.getByteTimeDomainData(values);
        const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length);
        this.value = smoothMouth(this.value, rms, elapsed);
        this.onLevel(this.value < 0.015 ? 0 : this.value);
      }
      this.frame = requestAnimationFrame(sample);
    };
    this.frame = requestAnimationFrame(sample);
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.source?.disconnect(); this.analyser?.disconnect();
    this.source = null; this.analyser = null; this.value = 0;
    this.onLevel(0);
  }
}
