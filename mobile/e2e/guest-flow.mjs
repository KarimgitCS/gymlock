// Guest workout flow: plan a session, then lift with a rest timer that only starts when a set is marked done. Needs no API.
// Run: SITE=http://localhost:8082 node e2e/guest-flow.mjs   (see e2e/README.md)
import fs from "node:fs";
import { chromium } from "playwright";
const SITE = process.env.SITE ?? "http://localhost:8082";
const SHOTS = process.env.SHOTS ?? "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
const errors = [], apiCalls = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => m.type() === "error" && !m.text().includes("404") && errors.push("console: " + m.text()));
page.on("request", r => /gymlock-api|supabase|:8000/.test(r.url()) && apiCalls.push(r.url()));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const step = async (name, fn) => { try { await fn(); console.log("ok   ", name); } catch (e) { console.log("FAIL ", name, "-", e.message.split("\n")[0]); await shot("fail-" + name.replace(/\W+/g, "_")); throw e; } };
const tid = (id) => page.getByTestId(id).last();
const pick = async (id, v) => { await tid(id).click(); await page.getByTestId(`${id}-option-${v}`).last().click(); };
const has = async (id) => (await page.getByTestId(id).count()) > 0;
const clockSecs = async () => { const t = await tid("rest-clock").innerText(); const [m, s] = t.split(":").map(Number); return m * 60 + s; };

await step("choosing a session opens SETUP, nothing is running", async () => {
  await page.goto(SITE);
  await page.getByText("Start workout").click();
  await page.getByText("Push Day", { exact: true }).first().click();
  await page.getByText("Set everything up first.", { exact: false }).waitFor();
  await page.getByText("Begin workout").waitFor();
  if (await has("rest-panel") || (await page.getByText("Set done", { exact: true }).count())) throw new Error("workout/timer visible during setup");
  await shot("1-setup");
});
await step("edit the plan before starting (sets, weight, add, remove, rest)", async () => {
  await pick("ex-0-sets", 2); await pick("ex-0-weight", 140);
  await page.getByTestId("ex-3-remove").click();                       // drop Tricep Pushdown
  await page.getByText("+ Add exercise").click();
  await page.getByTestId("ex-3-name").fill("Dips");
  await pick("ex-3-sets", 2); await pick("ex-3-reps", 12); await pick("ex-3-weight", 5);
  await pick("setup-rest", 30);
  await page.getByText("10 sets", { exact: false }).waitFor();
  await shot("2-setup-edited");
});
await step("Begin workout -> ACTIVE, and NO timer is running", async () => {
  await page.getByText("Begin workout").click();
  await page.getByText("Set 1 of 2").first().waitFor();
  await page.getByText("Bench Press", { exact: true }).first().waitFor();
  await page.waitForTimeout(3000);
  if (await has("rest-panel")) throw new Error("a timer started by itself");
  await shot("3-active");
});
await step("pressing Set done starts the rest (and only then)", async () => {
  await page.getByTestId("set-done").count();
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  const s = await clockSecs();
  if (s > 30 || s < 24) throw new Error("clock not ~30s: " + s);
  await page.getByText("Up next").waitFor();
  if ((await tid("overall-count").innerText()) !== "1/10 sets") throw new Error("overall count wrong");
  await shot("4-resting");
});
await step("rest survives a reload (kept on the device by timestamp)", async () => {
  await page.waitForTimeout(4000);
  const before = await clockSecs();
  await page.reload();
  await tid("rest-panel").waitFor({ timeout: 30000 });
  const after = await clockSecs();
  console.log("       clock before reload:", before, "-> after reload:", after);
  if (after > before || after < before - 4) throw new Error("clock reset or jumped: " + before + " -> " + after);
});
await step("when rest ends nothing auto-starts; waits for Set done", async () => {
  await tid("rest-over").waitFor({ timeout: 60000 });
  if (await has("rest-panel")) throw new Error("rest panel still shown");
  await page.getByText("Set 2 of 2").first().waitFor();
  await page.waitForTimeout(2500);
  if (await has("rest-panel")) throw new Error("a new timer started by itself");
  await shot("5-rest-over");
});
await step("Skip rest clears the timer, no new one starts", async () => {
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  await page.getByText("Skip rest").click();
  await page.waitForTimeout(1500);
  if (await has("rest-panel")) throw new Error("timer still running after skip");
  await page.getByText("Overhead Press", { exact: true }).first().waitFor();
  await page.getByText("Set 1 of 3").first().waitFor();
});
await step("+30 s extends the rest", async () => {
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  await page.getByText("+30 s").click();
  await page.waitForTimeout(600);
  const s = await clockSecs();
  if (s < 50) throw new Error("not extended: " + s);
  await page.getByText("Skip rest").click();
});
await step("adjust weight/reps for a set with the dropdowns", async () => {
  await pick("active-weight", 95); await pick("active-reps", 9);
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor();
  await page.getByText("Skip rest").click();
});
await step("home shows a resume card; resume returns to the workout", async () => {
  await page.goto(SITE);
  await tid("resume-workout").waitFor();
  await page.getByText("Workout in progress").waitFor();
  await tid("resume-workout").click();
  await page.getByText("Now").waitFor();
});
await step("finish every remaining set -> summary", async () => {
  for (let i = 0; i < 20; i++) {
    if (await page.getByText("Workout complete").count()) break;
    await page.getByText("Set done", { exact: true }).click();
    if (await has("rest-panel")) await page.getByText("Skip rest").click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.getByText("Workout complete").waitFor();
  await page.getByText("95 lb × 9").waitFor();
  await shot("6-summary");
});
await step("no resume card after finishing; progress has the data", async () => {
  await page.getByText("Back to home").click();
  await page.getByText("Ready to lift?").last().waitFor();
  if (await has("resume-workout")) throw new Error("resume card still shown");
  await page.goto(SITE + "/progress");
  await page.getByText("Bench Press", { exact: true }).last().click();
  await page.getByText(/Latest: 140 lb/).waitFor({ timeout: 30000 });
});
await step("End workout early (two-step) keeps what was logged", async () => {
  await page.goto(SITE + "/start");
  await page.getByText("Leg Day", { exact: true }).first().click();
  await page.getByText("Begin workout").click();
  await page.getByText("Set done", { exact: true }).click();
  await tid("rest-panel").waitFor(); await page.getByText("Skip rest").click();
  await tid("end-workout").click();
  await page.getByText("Tap again to end the workout").waitFor();
  await tid("end-workout").click();
  await page.getByText("Workout complete").waitFor();
  await page.getByText("155 lb × 8").waitFor();
});
console.log("network calls to the API:", apiCalls.length ? apiCalls : "none");
console.log("browser errors:", errors.length ? errors : "none");
await b.close();
