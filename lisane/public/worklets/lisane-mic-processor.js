class LisaneMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.sourceSampleRate = sampleRate;
    this.frameSize = Math.max(128, Math.round(this.sourceSampleRate * 0.04));
    this.frame = new Float32Array(this.frameSize);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel?.length) return true;

    let readOffset = 0;
    while (readOffset < channel.length) {
      const writable = Math.min(this.frameSize - this.offset, channel.length - readOffset);
      this.frame.set(channel.subarray(readOffset, readOffset + writable), this.offset);
      this.offset += writable;
      readOffset += writable;
      if (this.offset === this.frameSize) {
        this.flushFrame(this.frame);
        this.offset = 0;
      }
    }
    return true;
  }

  flushFrame(samples) {
    let sumSquares = 0;
    for (const sample of samples) sumSquares += sample * sample;
    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const pcm = this.downsampleToPcm16(samples);
    this.port.postMessage({ type: "audio", pcmBuffer: pcm.buffer, rms }, [pcm.buffer]);
  }

  downsampleToPcm16(input) {
    if (this.sourceSampleRate === this.targetSampleRate) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i += 1) output[i] = this.toInt16(input[i]);
      return output;
    }

    const ratio = this.sourceSampleRate / this.targetSampleRate;
    const output = new Int16Array(Math.max(1, Math.round(input.length / ratio)));
    let sourceIndex = 0;
    for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
      const nextSourceIndex = Math.round((outputIndex + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let i = sourceIndex; i < nextSourceIndex && i < input.length; i += 1) {
        sum += input[i] ?? 0;
        count += 1;
      }
      output[outputIndex] = this.toInt16(count ? sum / count : 0);
      sourceIndex = nextSourceIndex;
    }
    return output;
  }

  toInt16(value) {
    const sample = Math.max(-1, Math.min(1, value ?? 0));
    return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
}

registerProcessor("lisane-mic-processor", LisaneMicProcessor);
