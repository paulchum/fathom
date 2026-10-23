import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  LIMITS,
  MODEL_VERSION,
  calculate,
  validate,
  encodeScenario,
  decodeScenario,
  exportScenario,
  exportCSV,
} from "../src/model.js";

const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} != ${expected}`,
  );
test("one MW at PUE 1.2 reproduces the independent annual-energy reference", () => {
  const r = calculate({ ...DEFAULTS, itMW: 1 });
  near(r.facilityMW, 1.2);
  near(r.energyMWh, 10512);
  near(r.annualCost, 1051200);
  near(r.savedMWh, 1752);
  near(r.savedCost, 175200);
});
test("all electric energy is accounted for by IT plus overhead", () => {
  for (const itMW of [0, 0.25, 8, 40, 1000])
    for (const pue of [1, 1.2, 2, 4]) {
      const r = calculate({ ...DEFAULTS, itMW, pue });
      near(r.itMWh + r.overheadMW * DEFAULTS.hours, r.energyMWh);
      near(itMW + r.overheadMW, r.facilityMW);
    }
});
test("doubling hours doubles energy and cost without changing instantaneous flow", () => {
  const a = calculate({ ...DEFAULTS, hours: 4000 });
  const b = calculate({ ...DEFAULTS, hours: 8000 });
  near(b.annualCost, a.annualCost * 2);
  near(b.energyMWh, a.energyMWh * 2);
  near(a.flowLS, b.flowLS);
});
test("higher scenario PUE correctly reports negative savings", () => {
  const r = calculate({ ...DEFAULTS, pue: 1.8, baselinePue: 1.2 });
  assert.ok(r.savedCost < 0);
  near(r.savedPercent, -50);
});
test("zero load produces finite zero outputs", () => {
  const r = calculate({ ...DEFAULTS, itMW: 0 });
  for (const value of Object.values(r)) {
    assert.ok(Number.isFinite(value));
    near(value, 0);
  }
});
test("zero hours and free energy do not pretend to change physical demand", () => {
  const zeroHours = calculate({ ...DEFAULTS, hours: 0 });
  near(zeroHours.annualCost, 0);
  near(zeroHours.savedPercent, 0);
  near(zeroHours.facilityMW, 9.6);
  const freeEnergy = calculate({ ...DEFAULTS, price: 0 });
  near(freeEnergy.savedCost, 0);
  assert.ok(freeEnergy.savedMWh > 0);
});
test("heat-transport reference: 4.18 MW and 10 K require 100 kg/s water", () => {
  const r = calculate({
    ...DEFAULTS,
    itMW: 4.18,
    capture: 100,
    deltaT: 10,
    pressure: 100,
    efficiency: 50,
  });
  near(r.massKgS, 100);
  near(r.flowLS, 100);
  near(r.flowM3H, 360);
  near(r.hydraulicKW, 10);
  near(r.pumpKW, 20);
});
test("captured plus residual heat conserves IT heat; overhead is not included", () => {
  for (const capture of [0, 10, 80, 100]) {
    const r = calculate({ ...DEFAULTS, capture });
    near(r.liquidMW + r.residualMW, 8);
    near((r.massKgS * DEFAULTS.cp * DEFAULTS.deltaT) / 1000, r.liquidMW);
  }
});
test("temperature rise, fluid properties and pump efficiency have correct sensitivities", () => {
  const base = calculate(DEFAULTS);
  near(calculate({ ...DEFAULTS, deltaT: 20 }).flowLS, base.flowLS / 2);
  near(calculate({ ...DEFAULTS, density: 2000 }).flowLS, base.flowLS / 2);
  near(calculate({ ...DEFAULTS, cp: 8.36 }).massKgS, base.massKgS / 2);
  near(calculate({ ...DEFAULTS, efficiency: 35 }).pumpKW, base.pumpKW * 2);
  near(calculate({ ...DEFAULTS, pressure: 0 }).pumpKW, 0);
});
test("pump estimate is not double-counted in PUE power", () => {
  near(
    calculate({ ...DEFAULTS, pressure: 1000 }).facilityMW,
    calculate({ ...DEFAULTS, pressure: 0 }).facilityMW,
  );
});
test("every numerical input rejects NaN, strings, infinity and out-of-range values", () => {
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    for (const bad of [
      NaN,
      Infinity,
      -Infinity,
      "8",
      null,
      undefined,
      min - 1,
      max + 1,
    ]) {
      assert.ok(validate({ ...DEFAULTS, [key]: bad })[key]);
      assert.throws(() => calculate({ ...DEFAULTS, [key]: bad }), RangeError);
    }
  }
});
test("currency is an allowlisted label, not an exchange-rate conversion", () => {
  near(
    calculate({ ...DEFAULTS, currency: "CAD" }).annualCost,
    calculate(DEFAULTS).annualCost,
  );
  assert.throws(
    () => calculate({ ...DEFAULTS, currency: "<script>" }),
    RangeError,
  );
});
test("share links round-trip every input without including arbitrary fields", () => {
  const input = { ...DEFAULTS, cp: 3.7, itMW: 0.25, currency: "GBP" };
  assert.deepEqual(decodeScenario(encodeScenario(input)), input);
  assert.ok(
    !encodeScenario({ ...input, privateNote: "excluded" }).includes("excluded"),
  );
});
test("malformed, partial, oversized or incompatible shared states are rejected", () => {
  for (const hash of [
    "",
    "#methodology",
    "#scenario=%",
    "#scenario=null",
    "#scenario={}",
    "#scenario=" + "a".repeat(4001),
    "#scenario=" + encodeURIComponent(JSON.stringify({ v: "99", ...DEFAULTS })),
    "#scenario=" +
      encodeURIComponent(
        JSON.stringify({ v: MODEL_VERSION, ...DEFAULTS, deltaT: 0 }),
      ),
  ])
    assert.equal(decodeScenario(hash), null);
});
test("JSON export is reproducible from its inputs and includes units and limits", () => {
  const exported = exportScenario(DEFAULTS);
  assert.deepEqual(exported.results, calculate(exported.inputs));
  for (const key of Object.keys(exported.results))
    assert.ok(exported.units[key], `missing unit for ${key}`);
  assert.equal(exported.modelVersion, MODEL_VERSION);
  assert.ok(exported.assumptions.length >= 7);
  assert.equal(exported.sources.length, 3);
});
test("CSV contains an independent, numeric energy-and-cost reference", () => {
  const csv = exportCSV({ ...DEFAULTS, itMW: 1 });
  assert.ok(csv.includes('"result","energyMWh","10512","MWh/year"'));
  assert.ok(csv.includes('"result","annualCost","1051200","USD/year"'));
  assert.equal(
    csv.trim().split("\r\n").length,
    1 + Object.keys(DEFAULTS).length + Object.keys(calculate(DEFAULTS)).length,
  );
});
