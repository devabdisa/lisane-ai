const SAMPLES_PER_WINDOW = 160; // 10 ms of 16 kHz PCM
const MIN_WINDOW_RMS = 0.005 * 32768;
export const MIN_AUDIBLE_WINDOWS = 8;

export function countAudiblePcm16Windows(pcm: Uint8Array): number {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const windowBytes = SAMPLES_PER_WINDOW * 2;
  let audible = 0;

  for (let offset = 0; offset + windowBytes <= view.byteLength; offset += windowBytes) {
    let sum = 0;
    let squares = 0;
    for (let index = offset; index < offset + windowBytes; index += 2) {
      const sample = view.getInt16(index, true);
      sum += sample;
      squares += sample * sample;
    }
    const mean = sum / SAMPLES_PER_WINDOW;
    const variance = squares / SAMPLES_PER_WINDOW - mean * mean;
    if (variance >= MIN_WINDOW_RMS ** 2) audible += 1;
  }

  return audible;
}
