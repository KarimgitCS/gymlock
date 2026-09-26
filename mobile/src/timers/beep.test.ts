import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBeepWav } from "./beep";

const text = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

test("the beep is a valid mono 16-bit PCM WAV file", () => {
  const wav = buildBeepWav();
  const view = new DataView(wav.buffer);
  assert.equal(text(wav, 0, 4), "RIFF");
  assert.equal(text(wav, 8, 12), "WAVE");
  assert.equal(text(wav, 12, 16), "fmt ");
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 1); // mono
  assert.equal(view.getUint16(34, true), 16); // bits
  assert.equal(text(wav, 36, 40), "data");
  assert.equal(view.getUint32(4, true), wav.length - 8, "RIFF size matches the file");
  assert.equal(view.getUint32(40, true), wav.length - 44, "data size matches the file");
});

test("the beep is audible, not silence, and short", () => {
  const wav = buildBeepWav();
  const view = new DataView(wav.buffer);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
  assert.ok(peak > 10000, `peak amplitude ${peak}`);
  const seconds = (wav.length - 44) / 2 / 22050;
  assert.ok(seconds > 0.5 && seconds < 1.5, `duration ${seconds}s`);
});

test("there are gaps of silence between the three beeps", () => {
  const wav = buildBeepWav();
  const view = new DataView(wav.buffer);
  const sampleAt = (i: number) => Math.abs(view.getInt16(44 + i * 2, true));
  const beep = Math.round(0.18 * 22050);
  const gapMiddle = beep + Math.round(0.05 * 22050);
  assert.equal(sampleAt(gapMiddle), 0);
});
