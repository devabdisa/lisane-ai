export function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

// Browser microphones deliver Float32 at the device rate (often 48kHz); Live wants 16kHz mono PCM16.
export function downsampleTo16kHz(input: Float32Array, inputSampleRate: number) {
  const targetSampleRate = 16000;

  if (inputSampleRate === targetSampleRate) {
    const direct = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
      direct[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return direct;
  }

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(newLength);

  let sourceIndex = 0;
  for (let outputIndex = 0; outputIndex < newLength; outputIndex += 1) {
    const nextSourceIndex = Math.round((outputIndex + 1) * ratio);
    let accumulator = 0;
    let count = 0;

    for (let i = sourceIndex; i < nextSourceIndex && i < input.length; i += 1) {
      accumulator += input[i] ?? 0;
      count += 1;
    }

    const average = count > 0 ? accumulator / count : 0;
    const sample = Math.max(-1, Math.min(1, average));
    output[outputIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    sourceIndex = nextSourceIndex;
  }

  return output;
}

export function int16ToLittleEndianBytes(samples: Int16Array) {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(i * 2, samples[i] ?? 0, true);
  }
  return new Uint8Array(buffer);
}

export function mergeChunks(chunks: Uint8Array[]) {
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function parseSampleRate(mimeType: string) {
  const rateMatch = mimeType.match(/rate=(\d+)/i);
  if (!rateMatch) return 24000;
  const parsed = Number(rateMatch[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24000;
}

export function createAudioBufferFromPcm16(audioContext: AudioContext, base64Data: string, mimeType: string) {
  const bytes = base64ToBytes(base64Data);
  const sampleCount = Math.floor(bytes.length / 2);
  if (!sampleCount) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    float32[i] = view.getInt16(i * 2, true) / 0x8000;
  }

  const audioBuffer = audioContext.createBuffer(1, sampleCount, parseSampleRate(mimeType));
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}
