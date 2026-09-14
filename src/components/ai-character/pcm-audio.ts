/** Gemini accepts mono signed PCM16 little-endian. Resample browser capture to 16 kHz. */
export function encodePcm(samples: Float32Array, sampleRate: number): string {
  const ratio = sampleRate / 16000;
  const bytes = new Uint8Array(Math.floor(samples.length / ratio) * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length / 2; i++) {
    const start = Math.floor(i * ratio), end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return btoa(String.fromCharCode(...bytes));
}
export function decodePcm(data: string): Float32Array<ArrayBuffer> {
  const binary = atob(data);
  if (binary.length % 2) throw new Error('Invalid PCM response');
  const samples = new Float32Array(binary.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const value = binary.charCodeAt(i * 2) | binary.charCodeAt(i * 2 + 1) << 8;
    samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
  }
  return samples;
}
