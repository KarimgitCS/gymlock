// Two-device sync against a running API: sign-up uploads guest data, sign-in downloads it, deletes, last-write-wins, offline queueing, sign-out isolation and expired sessions.
// Run: SITE=http://localhost:8082 node e2e/sync.mjs   (see e2e/README.md)
import fs from "node:fs";
import { chromium } from "playwright";

const SITE = process.env.SITE ?? "http://localhost:8082";
const API = process.env.API ?? "http://localhost:8000";
const SHOTS = process.env.SHOTS ?? "e2e-screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = String(Date.now() % 1000000);
const USER = `sync${stamp}`, OTHER = `other${stamp}`, PASS = "password123";

const browser = await chromium.launch();
const devices = {};
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  devices[name] = { ctx, page };
  return { ctx, page };
}
const step = async (name, fn) => {
  try { await fn(); console.log("ok   ", name); }
  catch (e) { console.log("FAIL ", name, "-", e.message.split("\n")[0]); for (const [d, { page }] of Object.entries(devices)) await page.screenshot({ path: `${SHOTS}/fail-${d}-${name.replace(/\W+/g, "_")}.png` }).catch(() => {}); throw e; }
};
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const tid = (p, id) => p.getByTestId(id).last();
const badgeText = (p) => tid(p, "sync-badge").innerText();
async function badgeIs(p, re, timeout = 20000) {
  await p.waitForFunction(([id, src]) => { const els = [...document.querySelectorAll(`[data-testid="${id}"]`)]; const el = els[els.length - 1]; return !!el && new RegExp(src).test(el.innerText); }, ["sync-badge", re.source], { timeout });
}
const synced = (p) => badgeIs(p, /Synced/);
async function apiLogin(username, password = PASS) {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
  return (await r.json()).access_token;
}
const apiGet = async (path, token) => (await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json();
async function openStart(p) { await p.goto(SITE + "/start"); await p.getByText("Saved sessions", { exact: true }).waitFor({ timeout: 30000 }); }
async function presetNames(p) { await openStart(p); return p.locator('[data-testid^="preset-start-"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace(/^Start /, "")).sort()); }
async function signInOn(p, username, password = PASS, mode = "signin", expectLeave = true) {
  await p.goto(SITE + "/account");
  await tid(p, `mode-${mode}`).click();
  await tid(p, "account-username").fill(username);
  await tid(p, "account-password").fill(password);
  await tid(p, "account-submit").getByText(mode === "signin" ? "Sign in" : "Create account", { exact: true }).click();
  // Wait until the request finished and the screen closed, or the next navigation would abort it.
  if (expectLeave) await p.waitForFunction(() => !location.pathname.startsWith("/account"), null, { timeout: 45000 });
}
async function createPreset(p, name, exercise, sets, reps, weight) {
  await p.goto(SITE + "/preset/new");
  await tid(p, "preset-name").fill(name);
  await tid(p, "ex-0-name").fill(exercise);
  for (const [k, v] of [["sets", sets], ["reps", reps], ["weight", weight]]) { await tid(p, `ex-0-${k}`).click(); await p.getByTestId(`ex-0-${k}-option-${v}`).last().click(); }
  await p.getByText("Save preset").click();
  await p.getByText("Saved sessions", { exact: true }).waitFor();
}
async function finishWorkout(p, presetName) {
  await openStart(p);
  await p.getByText(presetName, { exact: true }).first().click();
  await p.getByText("Begin workout").click();
  for (let i = 0; i < 40; i++) {
    if (await p.getByText("Workout complete").count()) break;
    await p.getByText("Set done", { exact: true }).click();
    if (await p.getByTestId("rest-panel").count()) await p.getByText("Skip rest").click().catch(() => {});
    await p.waitForTimeout(120);
  }
  await p.getByText("Workout complete").waitFor();
}

const A = (await device("A")).page;
let token;

await step("A (guest): badge says Sign in, and Settings offers sync", async () => {
  await A.goto(SITE);
  await A.getByText("Ready to lift?").last().waitFor({ timeout: 30000 });
  eq((await badgeText(A)).trim().replace(/^●\s*/, ""), "Sign in", "badge");
  await A.goto(SITE + "/settings");
  await A.getByText("Sync across devices").waitFor();
});
await step("A (guest): builds local data: custom preset, a finished workout, rest setting 45", async () => {
  await createPreset(A, "Arm Day", "Curl", 5, 12, 60);
  await finishWorkout(A, "Push Day");
  await A.goto(SITE + "/settings");
  await A.locator("input").first().fill("45");
  await A.getByText("Save", { exact: true }).click();
  await A.getByText("Saved", { exact: true }).waitFor();
});
await step("A: creating an account syncs the guest data up", async () => {
  await signInOn(A, USER, PASS, "signup");
  await A.getByText("Signed in as", { exact: false }).or(A.getByText("Settings", { exact: true }).last()).first().waitFor({ timeout: 30000 });
  await A.goto(SITE + "/settings");
  await A.getByText(`Signed in as @${USER}`).waitFor({ timeout: 30000 });
  await synced(A);
  token = await apiLogin(USER);
  const workouts = await apiGet("/workouts", token);
  const presets = await apiGet("/presets", token);
  const me = await apiGet("/auth/me", token);
  eq(workouts.length, 1, "server workouts");
  eq(workouts[0].name, "Push Day", "workout name");
  eq(workouts[0].exercises.reduce((n, e) => n + e.sets.length, 0), 13, "server sets");
  eq(presets.map((p) => p.name).sort(), ["Arm Day", "Leg Day", "Pull Day", "Push Day"], "server presets");
  eq(me.rest_timer_seconds, 45, "server rest setting");
});

const B = (await device("B")).page;
await step("B (fresh device) signs in and receives everything, with no duplicate starters", async () => {
  await B.goto(SITE);
  await B.getByText("Ready to lift?").last().waitFor({ timeout: 30000 });
  await signInOn(B, USER);
  await B.goto(SITE + "/settings");
  await B.getByText(`Signed in as @${USER}`).waitFor({ timeout: 30000 });
  await synced(B);
  eq(await presetNames(B), ["Arm Day", "Leg Day", "Pull Day", "Push Day"], "B presets (each exactly once)");
  await B.goto(SITE + "/progress");
  await B.getByText("Bench Press", { exact: true }).last().click();
  await B.getByText(/Latest: 135 lb/).waitFor({ timeout: 20000 });
  await B.goto(SITE + "/settings");
  await B.waitForFunction(() => document.querySelector("input")?.value === "45", null, { timeout: 10000 }).catch(() => {});
  eq(await B.locator("input").first().inputValue(), "45", "B rest setting");
});
await step("a new preset made on B appears on A after a sync", async () => {
  await createPreset(B, "Core Day", "Plank", 3, 16, 5);
  await B.goto(SITE + "/settings"); await synced(B);
  await A.goto(SITE + "/settings");
  await A.getByText("Sync now").click();
  await synced(A);
  eq((await presetNames(A)).includes("Core Day"), true, "A sees Core Day");
});
await step("deleting a preset on A removes it from B", async () => {
  await openStart(A);
  await A.getByTestId((await A.locator('[data-testid^="preset-start-"]').evaluateAll((els) => els.find((e) => e.getAttribute("aria-label") === "Start Arm Day").getAttribute("data-testid"))).replace("start", "edit")).click();
  await A.getByTestId("preset-delete").click();
  await A.getByText("Tap again to delete this preset").waitFor();
  await A.getByTestId("preset-delete").click();
  await A.getByText("Saved sessions", { exact: true }).waitFor();
  await A.goto(SITE + "/settings"); await synced(A);
  await B.goto(SITE + "/settings");
  await B.getByText("Sync now").click(); await synced(B);
  eq((await presetNames(B)).includes("Arm Day"), false, "B no longer has Arm Day");
});
await step("a workout deleted on A leaves B's log and the server, and the other workout stays on the chart", async () => {
  const logCount = async (p) => { await p.goto(SITE + "/history"); await p.waitForTimeout(600); return p.locator('[data-testid^="history-item-"]').count(); };
  await finishWorkout(A, "Leg Day");
  await A.goto(SITE + "/settings"); await synced(A);
  await B.goto(SITE + "/settings");
  await B.getByText("Sync now").click(); await synced(B);
  eq(await logCount(B), 2, "B's log after A logged a second workout");
  eq((await apiGet("/workouts", token)).length, 2, "server workouts before the delete");

  await A.goto(SITE + "/history");
  const doomed = A.locator('[data-testid^="history-item-"]', { hasText: "Leg Day" }).first();
  await doomed.locator('[data-testid^="history-delete-"]').click();
  await doomed.getByText("Tap again to delete").waitFor();
  await doomed.locator('[data-testid^="history-delete-"]').click();
  await A.waitForFunction(() => document.querySelectorAll('[data-testid^="history-item-"]').length === 1);
  await A.goto(SITE + "/settings"); await synced(A);
  await B.goto(SITE + "/settings");
  await B.getByText("Sync now").click(); await synced(B);
  eq(await logCount(B), 1, "B's log after A deleted it");
  eq((await apiGet("/workouts", token)).map((w) => w.name), ["Push Day"], "server workouts after the delete");
  await B.goto(SITE + "/progress");
  await B.getByText("Bench Press", { exact: true }).last().click();
  await B.getByText(/Latest: 135 lb/).waitFor({ timeout: 20000 });
});
// In-app helpers: while a device is offline the browser cannot load a new URL, so these only
// use the app's own navigation, starting from the /start screen.
const renameInApp = async (p, from, to) => {
  await p.getByLabel(`Edit ${from}`).click();
  await tid(p, "preset-name").fill(to);
  await p.getByText("Save preset").click();
  await p.getByText("Saved sessions", { exact: true }).waitFor();
};

await step("conflict: the newer edit wins on both devices (last write wins)", async () => {
  await openStart(A); await openStart(B);
  await devices.A.ctx.setOffline(true);
  await renameInApp(A, "Core Day", "Core (edited on A)");      // older edit, made offline
  await B.waitForTimeout(50);
  await renameInApp(B, "Core Day", "Core (edited on B)");      // newer edit, made online
  await B.goto(SITE + "/settings"); await synced(B);
  await devices.A.ctx.setOffline(false);
  await A.goto(SITE + "/settings");
  await A.getByText("Sync now").click(); await synced(A);
  const names = await presetNames(A);
  eq(names.includes("Core (edited on B)") && !names.includes("Core (edited on A)"), true, `A converged to the newer edit: ${names}`);
});
await step("offline: changes queue, the header shows Offline, and they upload on reconnect", async () => {
  await A.goto(SITE);
  await A.getByText("Ready to lift?").last().waitFor();
  await devices.A.ctx.setOffline(true);
  await A.getByText("Start workout").click();
  await A.getByText("+ Create new preset").click();
  await tid(A, "preset-name").fill("Offline Day");
  await tid(A, "ex-0-name").fill("Row");
  await A.getByText("Save preset").click();
  await A.getByText("Saved sessions", { exact: true }).waitFor();
  await A.goBack();                                             // back to the home tab (still offline)
  await badgeIs(A, /Offline|Saving/, 20000);
  await devices.A.ctx.setOffline(false);
  await badgeIs(A, /Synced/, 30000);                            // reconnect triggers the retry on its own
  eq((await apiGet("/presets", token)).some((p) => p.name === "Offline Day"), true, "server has Offline Day");
});
await step("wrong password and duplicate usernames show clear errors", async () => {
  const C = (await device("C")).page;
  await signInOn(C, USER, "wrong-password-1", "signin", false);
  await tid(C, "account-error").waitFor();
  eq(await tid(C, "account-error").innerText(), "Invalid username or password", "login error");
  await signInOn(C, USER, PASS, "signup", false);
  await tid(C, "account-error").waitFor();
  eq(await tid(C, "account-error").innerText(), "Username already taken", "signup error");
  await tid(C, "mode-signup").click();
  await tid(C, "account-username").fill("ab"); await tid(C, "account-password").fill(PASS);
  await tid(C, "account-submit").getByText("Create account", { exact: true }).click();
  eq(await tid(C, "account-error").innerText(), "Username must be at least 3 characters.", "client validation");
  await devices.C.ctx.close(); delete devices.C;
});
await step("sign out warns, then removes this device's data; the account keeps it", async () => {
  await B.goto(SITE + "/settings"); await synced(B);
  await B.getByTestId("sign-out").getByText("Sign out", { exact: true }).click();
  await B.getByTestId("sign-out-warning").waitFor();
  await B.getByTestId("sign-out").getByText("Tap again to sign out").click();
  await B.getByText("Sync across devices").waitFor({ timeout: 20000 });
  eq((await presetNames(B)).sort(), ["Leg Day", "Pull Day", "Push Day"], "B is back to a clean guest with the starters");
  await B.goto(SITE + "/progress");
  await B.getByText("No progress yet").waitFor();
  eq((await apiGet("/workouts", token)).length, 1, "server still has the workout");
});
await step("a different account on the same device never sees the previous account's data", async () => {
  await signInOn(B, OTHER, PASS, "signup");
  await B.goto(SITE + "/settings");
  await B.getByText(`Signed in as @${OTHER}`).waitFor({ timeout: 30000 }); await synced(B);
  eq((await presetNames(B)), ["Leg Day", "Pull Day", "Push Day"], "other user's presets");
  eq((await apiGet("/workouts", await apiLogin(OTHER))).length, 0, "other user's server workouts");
  await B.goto(SITE + "/settings");
  await B.getByTestId("sign-out").getByText("Sign out", { exact: true }).click();
  await B.getByTestId("sign-out").getByText("Tap again to sign out").click();
  await B.getByText("Sync across devices").waitFor();
});
await step("signing back in restores everything from the account", async () => {
  await signInOn(B, USER);
  await B.goto(SITE + "/settings"); await B.getByText(`Signed in as @${USER}`).waitFor({ timeout: 30000 }); await synced(B);
  const names = await presetNames(B);
  eq(names.includes("Offline Day") && names.includes("Core (edited on B)"), true, `restored presets: ${names}`);
  await B.goto(SITE + "/progress");
  await B.getByText("Bench Press", { exact: true }).last().click();
  await B.getByText(/Latest: 135 lb/).waitFor();
});
await step("an expired session keeps local data and asks the user to sign in again", async () => {
  await A.goto(SITE + "/settings");
  await A.evaluate(() => localStorage.setItem("gymlock_token", "expired.or.invalid"));
  await A.reload();
  await A.getByText("Session expired").waitFor({ timeout: 30000 });
  await badgeIs(A, /Sign in again/);
  eq((await presetNames(A)).includes("Offline Day"), true, "local data is still there");
  await signInOn(A, USER);
  await A.goto(SITE + "/settings"); await A.getByText(`Signed in as @${USER}`).waitFor({ timeout: 30000 }); await synced(A);
});

console.log("browser errors:", errors.length ? errors : "none");
await browser.close();
