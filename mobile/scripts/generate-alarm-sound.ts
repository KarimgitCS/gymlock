// Regenerates assets/rest-over.wav (three beeps plus a pause, meant to be looped by the app).
// Run: npx tsx scripts/generate-alarm-sound.ts
import { writeFileSync } from "node:fs";

import { buildBeepWav } from "../src/timers/beep";

writeFileSync("assets/rest-over.wav", buildBeepWav(0.6));
console.log("wrote assets/rest-over.wav");
