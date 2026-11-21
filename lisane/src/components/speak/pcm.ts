const TARGET_RATE = 16_000;

export function downsampleToPcm16(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === TARGET_RATE) return floatToPcm16(input);
  const length = Math.floor((input.length * TARGET_RATE) / inputRate);
  const output = new Int16Array(length);
  const ratio = inputRate / TARGET_RATE;
  for (let index = 0; index < length; index += 1) {
    const sample = input[Math.floor(index * ratio)] ?? 0;
    output[index] = toInt16(sample);
  }
  return output;
}

function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) output[index] = toInt16(input[index] ?? 0);
  return output;
}

function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function playPcm16Base64(context: AudioContext, base64: string, cursor: { time: number }, sampleRate = 24_000) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const view = new Int16Array(bytes.buffer);
  const buffer = context.createBuffer(1, view.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < view.length; index += 1) channel[index] = (view[index] ?? 0) / 0x8000;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const start = Math.max(context.currentTime + 0.05, cursor.time);
  source.start(start);
  cursor.time = start + buffer.duration;
}
