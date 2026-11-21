export function pcm16ToWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return new Uint8Array(buffer);
}

export function wavToPcm16(wav: Uint8Array): Int16Array {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let offset = 12;
  while (offset + 8 <= wav.byteLength) {
    const id = String.fromCharCode(wav[offset] ?? 0, wav[offset + 1] ?? 0, wav[offset + 2] ?? 0, wav[offset + 3] ?? 0);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "data") {
      const length = Math.floor(size / 2);
      const pcm = new Int16Array(length);
      for (let index = 0; index < length; index += 1) pcm[index] = view.getInt16(start + index * 2, true);
      return pcm;
    }
    offset = start + size + (size % 2);
  }
  throw new Error("WAV data chunk is missing.");
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}
