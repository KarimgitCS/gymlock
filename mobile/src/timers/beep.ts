// Builds a short "rest over" sound (three beeps) as a WAV file in memory. The web build plays it
// through an <audio> element: unlike Web Audio, phones play those even with the silent switch on.

const SAMPLE_RATE = 22050;

export function buildBeepWav(): Uint8Array {
  const beepSeconds = 0.18;
  const gapSeconds = 0.1;
  const frequency = 880;
  const beeps = 3;

  const beepSamples = Math.round(beepSeconds * SAMPLE_RATE);
  const gapSamples = Math.round(gapSeconds * SAMPLE_RATE);
  const total = beeps * beepSamples + (beeps - 1) * gapSamples;
  const dataBytes = total * 2;

  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);

  let sample = 0;
  for (let beep = 0; beep < beeps; beep++) {
    for (let i = 0; i < beepSamples; i++, sample++) {
      // Short fade in and out so the beeps do not click.
      const envelope = Math.min(1, i / 400, (beepSamples - i) / 400);
      const value = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE) * envelope * 0.6;
      view.setInt16(44 + sample * 2, Math.round(value * 32767), true);
    }
    sample += beep < beeps - 1 ? gapSamples : 0;
  }
  return new Uint8Array(buffer);
}
