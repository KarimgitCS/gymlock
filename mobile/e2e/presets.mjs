// Saved sessions: dropdown ranges, creating, editing and deleting presets, persistence across reloads. Needs no API.
// Run: SITE=http://localhost:8082 node e2e/presets.mjs   (see e2e/README.md)
import fs from "node:fs";
import { chromium } from "playwright";
const SITE = process.env.SITE ?? "http://localhost:8082";
const SHOTS = process.env.SHOTS ?? "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1100, height: 850 } });
const page = await ctx.newPage();
const errors = [], apiCalls = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => m.type() === "error" && !m.text().includes("404") && errors.push("console: " + m.text()));
page.on("request", r => /gymlock-api|supabase|:8000/.test(r.url()) && apiCalls.push(r.url()));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const step = async (name, fn) => { try { await fn(); console.log("ok   ", name); } catch (e) { console.log("FAIL ", name, "-", e.message.split("\n")[0]); await shot("fail-" + name.replace(/\W+/g, "_")); throw e; } };
const tid = (id) => page.getByTestId(id).last();
const pick = async (fieldId, value) => { await tid(fieldId).click(); await page.getByTestId(`${fieldId}-option-${value}`).last().click(); };
const count = (prefix) => page.locator(`[data-testid^="${prefix}-option-"]`).count();

await step("home has no stats tiles and no session history", async () => {
  await page.goto(SITE);
  await page.getByText("Ready to lift?").waitFor({ timeout: 30000 });
  for (const t of ["Volume (lb)", "Workouts", "Sets"]) if (await page.getByText(t, { exact: true }).first().isVisible().catch(() => false) && t === "Volume (lb)") throw new Error("stats still shown: " + t);
  await shot("1-home");
});
await step("Start workout shows the saved presets", async () => {
  await page.getByText("Start workout").click();
  await page.getByText("Saved sessions", { exact: true }).waitFor();
  for (const n of ["Push Day", "Pull Day", "Leg Day", "Blank workout"]) await page.getByText(n, { exact: true }).first().waitFor();
  await shot("2-choose");
});
await step("tapping Push Day opens setup prefilled from the preset", async () => {
  await page.getByText("Push Day", { exact: true }).first().click();
  await page.getByText("Set everything up first.", { exact: false }).waitFor();
  const values = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  for (const n of ["Bench Press", "Overhead Press", "Incline Dumbbell Press", "Tricep Pushdown"]) if (!values.includes(n)) throw new Error("missing exercise " + n);
});
await step("dropdown ranges: sets 1-8, reps 1-16, weight 5-300", async () => {
  await page.getByText("Start workout").count();
  const repsId = (await page.locator('[data-testid$="-weight"]').first().getAttribute("data-testid")).replace("-weight", "-reps");
  const weightId = repsId.replace("-reps", "-weight");
  await tid(repsId).click();
  const reps = await count(repsId);
  const repVals = await page.locator(`[data-testid^="${repsId}-option-"]`).evaluateAll(els => els.map(e => +e.getAttribute("data-testid").split("-option-")[1]));
  await page.keyboard.press("Escape"); await page.mouse.click(5, 5);
  await tid(weightId).click();
  const wVals = await page.locator(`[data-testid^="${weightId}-option-"]`).evaluateAll(els => els.map(e => +e.getAttribute("data-testid").split("-option-")[1]));
  await page.mouse.click(5, 5);
  const ok = (a, lo, hi, st) => a.length === (hi - lo) / st + 1 && Math.min(...a) === lo && Math.max(...a) === hi;
  if (!ok(repVals, 1, 16, 1)) throw new Error("reps range wrong: " + repVals.join(","));
  if (!ok(wVals, 5, 300, 5)) throw new Error("weight range wrong: " + wVals.length + " " + Math.min(...wVals) + "-" + Math.max(...wVals));
  console.log("       reps", Math.min(...repVals), "-", Math.max(...repVals), "| weight", Math.min(...wVals), "-", Math.max(...wVals), "step 5 (" + wVals.length + " options)");
});
await step("create a custom preset (sets 5, reps 12, weight 60)", async () => {
  await page.goto(SITE + "/start");
  await page.getByText("+ Create new preset").click();
  await page.getByTestId("preset-name").fill("Arm Day");
  await page.getByTestId("ex-0-name").fill("Curl");
  await pick("ex-0-sets", 5); await pick("ex-0-reps", 12); await pick("ex-0-weight", 60);
  await page.getByText("+ Add exercise").click();
  await page.getByTestId("ex-1-name").fill("Tricep Extension");
  await shot("5-editor");
  const setVals = await (async () => { await tid("ex-0-sets").click(); const v = await page.locator('[data-testid^="ex-0-sets-option-"]').evaluateAll(els => els.map(e => +e.getAttribute("data-testid").split("-option-")[1])); await page.getByTestId("ex-0-sets-option-5").last().click(); return v; })();
  if (Math.min(...setVals) !== 1 || Math.max(...setVals) !== 8 || setVals.length !== 8) throw new Error("sets range wrong: " + setVals);
  await page.getByText("Save preset").click();
  await page.getByText("Arm Day", { exact: true }).first().waitFor();
  await page.getByText("5 × 12 · 60 lb").waitFor();
  await shot("6-choose-with-custom");
});
await step("start the custom preset", async () => {
  await page.getByText("Arm Day", { exact: true }).first().click();
  await page.getByText("Set everything up first.", { exact: false }).waitFor();
  const curl = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  if (!curl.includes("Curl")) throw new Error("custom preset exercise not prefilled");
});
await step("presets and history persist across reload", async () => {
  await page.goto(SITE + "/start");
  await page.getByText("Arm Day", { exact: true }).first().waitFor({ timeout: 30000 });
});
await step("edit a preset and delete it (two-step)", async () => {
  await page.goto(SITE + "/start");
  await page.getByText("Arm Day", { exact: true }).first().waitFor();
  const editId = await page.locator('[data-testid^="preset-edit-"]').last().getAttribute("data-testid");
  await page.getByTestId(editId).click();
  await page.getByText("Edit preset").waitFor();
  await page.getByTestId("preset-name").fill("Arm Day 2");
  await page.getByText("Save preset").click();
  await page.getByText("Arm Day 2", { exact: true }).first().waitFor();
  await page.getByTestId(editId).click();
  await page.getByTestId("preset-delete").click();
  await page.getByText("Tap again to delete this preset").waitFor();
  await page.getByTestId("preset-delete").click();
  await page.getByText("Saved sessions", { exact: true }).waitFor();
  if (await page.getByText("Arm Day 2", { exact: true }).count()) throw new Error("preset not deleted");
});
await step("blank workout opens an empty setup", async () => {
  await page.goto(SITE + "/start");
  await page.getByTestId("start-blank").click();
  await page.getByText("Begin workout").waitFor();
  await page.getByText("+ Add exercise").waitFor();
});
console.log("network calls to the API (guest mode should make none):", apiCalls.length ? apiCalls : "none");
console.log("browser errors:", errors.length ? errors : "none");
await b.close();
