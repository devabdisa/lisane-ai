const TARGET_RATE = 16_000;

export function downsampleToPcm16(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === TARGET_RATE) return floatToPcm16(input);
  const ratio = inputRate / TARGET_RATE;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(length);
  let sourceIndex = 0;
  for (let outputIndex = 0; outputIndex < length; outputIndex += 1) {
    const nextSourceIndex = Math.round((outputIndex + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let index = sourceIndex; index < nextSourceIndex && index < input.length; index += 1) {
      sum += input[index] ?? 0;
      count += 1;
    }
    output[outputIndex] = toInt16(count > 0 ? sum / count : 0);
    sourceIndex = nextSourceIndex;
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

const COACH_BUFFER_CHUNKS = 2;
const COACH_BUFFER_MS = 150;

type CoachChunk = { data: string; sampleRate: number };

export function createCoachPlayer(options?: { onSpeaking?: (speaking: boolean) => void }) {
  let context: AudioContext | null = null;
  let cursor = 0;
  let open = false;
  let speaking = false;
  let timer = 0;
  let armTimer = 0;
  let speakTimer = 0;
  const queue: CoachChunk[] = [];

  function markSpeaking() {
    if (!speaking) {
      speaking = true;
      options?.onSpeaking?.(true);
    }
    if (!context) return;
    if (speakTimer) window.clearTimeout(speakTimer);
    const remaining = Math.max(0, cursor - context.currentTime);
    speakTimer = window.setTimeout(() => {
      speakTimer = 0;
      speaking = false;
      options?.onSpeaking?.(false);
    }, remaining * 1000 + 900);
  }

  function play(chunk: CoachChunk) {
    if (!context || chunk.data.length === 0) return;
    const audio = audioBufferFromPcm16(context, chunk.data, chunk.sampleRate);
    if (!audio) return;
    const source = context.createBufferSource();
    source.buffer = audio;
    source.connect(context.destination);
    const start = Math.max(context.currentTime, cursor);
    source.start(start);
    cursor = start + audio.duration;
    markSpeaking();
  }

  function flush() {
    open = true;
    if (timer) window.clearTimeout(timer);
    timer = 0;
    const batch = queue.splice(0);
    for (const chunk of batch) play(chunk);
  }

  return {
    async prepare() {
      context ??= new AudioContext();
      if (context.state === "suspended") await context.resume();
    },
    push(data: string, sampleRate = 24_000) {
      if (!context) context = new AudioContext();
      if (open) {
        play({ data, sampleRate });
        return;
      }
      queue.push({ data, sampleRate });
      if (queue.length >= COACH_BUFFER_CHUNKS) {
        flush();
        return;
      }
      if (!timer) {
        timer = window.setTimeout(() => {
          timer = 0;
          flush();
        }, COACH_BUFFER_MS);
      }
    },
    finishTurn() {
      if (!open && queue.length === 0) return;
      flush();
      if (armTimer) window.clearTimeout(armTimer);
      const remaining = context ? Math.max(0, cursor - context.currentTime) : 0;
      armTimer = window.setTimeout(() => {
        armTimer = 0;
        open = false;
      }, remaining * 1000 + 80);
    },
  };
}

function audioBufferFromPcm16(context: AudioContext, base64: string, sampleRate: number): AudioBuffer | null {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const sampleCount = Math.floor(bytes.length / 2);
  if (sampleCount === 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const buffer = context.createBuffer(1, sampleCount, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) channel[index] = view.getInt16(index * 2, true) / 0x8000;
  return buffer;
}
