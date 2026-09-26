// Workout log: dates, ended-early marking, deleting a workout, and that deleted or unfinished workouts stay out of the progress chart. Needs no API.
// Run: SITE=http://localhost:8082 node e2e/history.mjs   (see e2e/README.md)
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
const items = () => page.locator('[data-testid^="history-item-"]');
const has = async (id) => (await page.getByTestId(id).count()) > 0;

// Blank workout with one Bench Press: plan `planned` sets at `weight`, log `done` of them.
async function logBench({ weight, planned, done, finish }) {
  await page.goto(SITE + "/start");
  await tid("start-blank").click();
  await page.getByText("+ Add exercise").click();
  await tid("ex-0-name").fill("Bench Press");
  await pick("ex-0-sets", planned); await pick("ex-0-reps", 5); await pick("ex-0-weight", weight);
  await pick("setup-rest", 30);
  await page.getByText("Begin workout").click();
  await page.getByText(`Set 1 of ${planned}`).first().waitFor();
  for (let i = 0; i < done; i++) {
    await page.getByText("Set done", { exact: true }).click();
    if (i < planned - 1) { await tid("rest-panel").waitFor(); await page.getByText("Skip rest").click(); }
  }
  if (finish === "early") {
    await tid("end-workout").click();
    await page.getByText("Tap again to end the workout").waitFor();
    await tid("end-workout").click();
  }
}
const latestOnChart = async () => {
  await page.goto(SITE + "/progress");
  await page.getByText("Bench Press", { exact: true }).last().click();
  return (await page.getByText(/Latest:/).last().innerText()).trim();
};
const today = () => page.evaluate(() => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));

await step("history starts empty", async () => {
  await page.goto(SITE + "/history");
  await page.getByText("No workouts logged yet").waitFor({ timeout: 30000 });
  await shot("1-empty");
});
await step("a finished workout appears in the log with today's date", async () => {
  await logBench({ weight: 100, planned: 2, done: 2 });
  await page.getByText("Workout complete").waitFor();
  const when = await tid("summary-when").innerText();
  if (!when.includes(await today())) throw new Error("summary date missing: " + when);
  await page.goto(SITE + "/history");
  await items().first().waitFor();
  const text = await items().first().innerText();
  for (const want of [await today(), "2 sets", "1,000 lb"]) if (!text.includes(want)) throw new Error(`log entry missing "${want}": ${text}`);
  if (text.includes("Ended early")) throw new Error("complete workout marked as ended early");
  await shot("2-one-workout");
});
await step("a half-done workout ended early is marked and shows on the chart", async () => {
  await logBench({ weight: 200, planned: 3, done: 1, finish: "early" });
  await page.getByText("Workout ended early").waitFor();
  await page.goto(SITE + "/history");
  await page.getByText("Ended early · 1/3").waitFor();
  if ((await items().count()) !== 2) throw new Error("expected 2 entries, got " + (await items().count()));
  const first = await items().first().innerText();
  if (!first.includes("Ended early")) throw new Error("newest workout should be listed first: " + first);
  await shot("3-ended-early");
  const latest = await latestOnChart();
  if (!latest.includes("Latest: 200 lb")) throw new Error("chart should include the early workout: " + latest);
});
await step("deleting needs a second tap, and the workout leaves the log and the chart", async () => {
  await page.goto(SITE + "/history");
  const del = page.locator('[data-testid^="history-delete-"]').first();
  await del.click();
  await page.getByText("Tap again to delete").waitFor();
  if ((await items().count()) !== 2) throw new Error("first tap must not delete");
  await del.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="history-item-"]').length === 1);
  const remaining = await items().first().innerText();
  if (remaining.includes("Ended early")) throw new Error("the wrong workout was deleted");
  await shot("4-after-delete");
  const latest = await latestOnChart();
  if (!latest.includes("Latest: 100 lb")) throw new Error("chart still includes the deleted workout: " + latest);
});
await step("the deletion survives a reload", async () => {
  await page.goto(SITE + "/history");
  await items().first().waitFor();
  await page.reload();
  await items().first().waitFor({ timeout: 30000 });
  if ((await items().count()) !== 1) throw new Error("deleted workout came back");
});
await step("a workout still in progress is not in the log and does not move the chart", async () => {
  await logBench({ weight: 250, planned: 3, done: 1 });
  await page.goto(SITE + "/history");
  await items().first().waitFor();
  if ((await items().count()) !== 1) throw new Error("open workout listed in the log");
  const latest = await latestOnChart();
  if (!latest.includes("Latest: 100 lb")) throw new Error("in-progress sets reached the chart: " + latest);
});
await step("ending it early logs it; deleting from its summary removes it everywhere", async () => {
  await page.goto(SITE);
  await tid("resume-workout").click();
  await tid("end-workout").click();
  await page.getByText("Tap again to end the workout").waitFor();
  await tid("end-workout").click();
  await page.getByText("Workout ended early").waitFor();
  await page.getByText("Deleting it also removes it from your progress charts", { exact: false }).waitFor();
  await tid("delete-workout").click();
  await page.getByText("Tap again to delete").waitFor();
  if (!(await has("delete-workout"))) throw new Error("first tap must not delete");
  await tid("delete-workout").click();
  await items().first().waitFor({ timeout: 30000 });
  if ((await items().count()) !== 1) throw new Error("expected only the first workout to remain");
  const latest = await latestOnChart();
  if (!latest.includes("Latest: 100 lb")) throw new Error("chart still includes the deleted workout: " + latest);
});
await step("deleting the last workout empties the log and the chart", async () => {
  await page.goto(SITE + "/history");
  const del = page.locator('[data-testid^="history-delete-"]').first();
  await del.click(); await del.click();
  await page.getByText("No workouts logged yet").waitFor();
  await page.goto(SITE + "/progress");
  await page.getByText("No progress yet").waitFor({ timeout: 30000 });
  await shot("5-empty-again");
});
console.log("network calls to the API:", apiCalls.length ? apiCalls : "none");
console.log("browser errors:", errors.length ? errors : "none");
await b.close();
if (errors.length || apiCalls.length) process.exit(1);
