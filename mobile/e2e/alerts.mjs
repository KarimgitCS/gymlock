// Rest alerts in the browser: when a rest ends an alarm keeps sounding and vibrating until the user
// acknowledges it, the screen is kept awake during a workout, the tab title shows the countdown,
// and the Settings test buttons work.
// Run: SITE=http://localhost:8082 node e2e/alerts.mjs   (see e2e/README.md)
import fs from "node:fs";
import { chromium } from "playwright";

const SITE = process.env.SITE ?? "http://localhost:8082";
const SHOTS = process.env.SHOTS ?? "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 500, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Spy on the browser APIs a phone would use.
await page.addInitScript(() => {
  window.__plays = [];
  window.__vibrations = [];
  window.__wake = { requested: [], released: 0 };
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__plays.push({ muted: this.muted, at: Date.now() });
    return originalPlay.call(this).catch(() => undefined);
  };
  navigator.vibrate = (pattern) => (window.__vibrations.push(pattern), true);
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async (type) => {
        window.__wake.requested.push(type);
        return { release: async () => { window.__wake.released++; }, addEventListener() {}, removeEventListener() {} };
      },
    },
  });
});

const step = async (name, fn) => {
  try { await fn(); console.log("ok   ", name); }
  catch (e) { console.log("FAIL ", name, "-", e.message.split("\n")[0]); await page.screenshot({ path: `${SHOTS}/fail-alerts-${name.replace(/\W+/g, "_")}.png` }); throw e; }
};
const spy = () => page.evaluate(() => ({ plays: window.__plays.slice(), vibrations: window.__vibrations.length, wake: window.__wake }));
const tid = (id) => page.getByTestId(id).last();

await step("Settings explains web alerts and Test alert plays a sound and vibrates", async () => {
  await page.goto(SITE + "/settings");
  await tid("alerts-card").waitFor({ timeout: 30000 });
  const before = await spy();
  await tid("test-alert").getByText("Test notification").click();
  await tid("test-alert-result").waitFor();
  const after = await spy();
  if (after.plays.length <= before.plays.length) throw new Error("no sound was played");
  if (!after.plays.some((p) => p.muted === false)) throw new Error("only a muted play happened");
  if (after.vibrations <= before.vibrations) throw new Error("no vibration");
});

await step("during a workout: screen kept awake, countdown in the tab title, page-open hint shown", async () => {
  await page.goto(SITE + "/start");
  await page.getByText("Push Day", { exact: true }).first().click();
  await tid("setup-rest").click(); await page.getByTestId("setup-rest-option-15").last().click();
  await page.getByText("Begin workout").click();
  await page.getByText("Set done", { exact: true }).waitFor();
  const wake = (await spy()).wake;
  if (!wake.requested.includes("screen")) throw new Error("screen wake lock was not requested");
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  await page.waitForFunction(() => /rest · /.test(document.title), null, { timeout: 5000 });
  await tid("web-hint").waitFor();
  await page.screenshot({ path: `${SHOTS}/alerts-resting.png` });
});

const audible = async () => (await spy()).plays.filter((p) => p.muted === false).length;

await step("when the rest ends an alarm sounds and keeps repeating until stopped", async () => {
  const before = await spy();
  await tid("stop-alarm").waitFor({ timeout: 40000 });
  const start = await audible();
  await page.waitForTimeout(4500);
  const during = await audible();
  if (during - start < 2) throw new Error(`alarm did not repeat: ${during - start} more plays in 4.5s`);
  if ((await spy()).vibrations <= before.vibrations + 1) throw new Error("vibration did not repeat");
  await page.screenshot({ path: `${SHOTS}/alerts-alarm.png` });
});

await step("Stop alarm silences it", async () => {
  await tid("stop-alarm").click();
  await tid("rest-over").waitFor();
  const stopped = await audible();
  await page.waitForTimeout(3500);
  if ((await audible()) !== stopped) throw new Error("the alarm kept playing after Stop alarm");
});

await step("pressing Set done also silences a sounding alarm", async () => {
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  await tid("stop-alarm").waitFor({ timeout: 40000 });
  await page.getByText("Set done", { exact: true }).click();
  await page.waitForTimeout(400);
  const stopped = await audible();
  await page.waitForTimeout(3500);
  if ((await audible()) !== stopped) throw new Error("the alarm kept playing after Set done");
  if (await page.getByTestId("stop-alarm").count()) throw new Error("stop banner still showing");
});

await step("Settings Test alarm plays for a few seconds and then stops by itself", async () => {
  await page.goto(SITE + "/settings");
  await tid("alerts-card").waitFor();
  const before = await audible();
  await tid("test-alarm").getByText("Test alarm").click();
  await page.waitForTimeout(3500);
  const during = await audible();
  if (during - before < 1) throw new Error("test alarm made no sound");
  await page.waitForTimeout(4500);
  const after = await audible();
  await page.waitForTimeout(3000);
  if ((await audible()) !== after) throw new Error("test alarm never stopped");
});

await step("the screen lock is released when the workout ends", async () => {
  await page.goto(SITE);
  await tid("resume-workout").click();
  await page.getByText("Now").waitFor();
  const releasedBefore = (await spy()).wake.released;
  await tid("end-workout").click();
  await page.getByText("Tap again to end the workout").waitFor();
  await tid("end-workout").click();
  await page.getByText("Workout ended early").waitFor();
  await page.waitForTimeout(300);
  if ((await spy()).wake.released <= releasedBefore) throw new Error("wake lock never released");
});

console.log("browser errors:", errors.length ? errors : "none");
await browser.close();
