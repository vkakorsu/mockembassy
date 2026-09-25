// Captures mic audio, downsamples to 16 kHz mono PCM16 (what Gemini Live expects),
// and posts ~100 ms chunks plus an RMS level for the UI meter.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.buffer = [];
    this.acc = 0;
    this.accCount = 0;
    this.pos = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
      const s = input[i];
      sum += s * s;
      this.acc += s;
      this.accCount++;
      this.pos++;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.acc / this.accCount));
        this.buffer.push(v < 0 ? v * 0x8000 : v * 0x7fff);
        this.acc = 0;
        this.accCount = 0;
      }
    }
    if (this.buffer.length >= 1600) {
      const out = Int16Array.from(this.buffer);
      this.buffer = [];
      this.port.postMessage({ pcm: out.buffer, level: Math.sqrt(sum / input.length) }, [out.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
