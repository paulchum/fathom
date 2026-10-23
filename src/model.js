/** FATHOM v1: constant-load screening equations. See docs/METHODOLOGY.md. */
export const MODEL_VERSION = "1.0";
export const DEFAULTS = Object.freeze({
  itMW: 8,
  pue: 1.2,
  baselinePue: 1.4,
  price: 0.1,
  hours: 8760,
  currency: "USD",
  capture: 80,
  deltaT: 10,
  cp: 4.18,
  density: 1000,
  pressure: 150,
  efficiency: 70,
});
export const LIMITS = Object.freeze({
  itMW: [0, 1000],
  pue: [1, 4],
  baselinePue: [1, 4],
  price: [0, 5],
  hours: [0, 8784],
  capture: [0, 100],
  deltaT: [1, 40],
  cp: [0.1, 10],
  density: [100, 2000],
  pressure: [0, 1000],
  efficiency: [1, 100],
});
export const LABELS = Object.freeze({
  itMW: "Average IT load",
  pue: "Scenario PUE",
  baselinePue: "Reference PUE",
  price: "Electricity price",
  hours: "Operating hours",
  capture: "Liquid capture",
  deltaT: "Coolant temperature rise",
  cp: "Specific heat capacity",
  density: "Fluid density",
  pressure: "Loop pressure drop",
  efficiency: "Pump efficiency",
});
export function validate(input) {
  const errors = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = input[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    ) {
      errors[key] = `${LABELS[key]} must be between ${min} and ${max}.`;
    }
  }
  if (!["USD", "CAD", "EUR", "GBP"].includes(input.currency))
    errors.currency = "Choose a supported currency.";
  return errors;
}
export function calculate(input) {
  const errors = validate(input);
  if (Object.keys(errors).length)
    throw new RangeError(Object.values(errors).join(" "));
  const {
    itMW,
    pue,
    baselinePue,
    hours,
    price,
    capture,
    deltaT,
    cp,
    density,
    pressure,
    efficiency,
  } = input;
  const facilityMW = itMW * pue;
  const overheadMW = facilityMW - itMW;
  const itMWh = itMW * hours;
  const energyMWh = facilityMW * hours;
  const annualCost = energyMWh * 1000 * price;
  const baselineMW = itMW * baselinePue;
  const baselineMWh = baselineMW * hours;
  const baselineCost = baselineMWh * 1000 * price;
  const savedMWh = baselineMWh - energyMWh;
  const savedCost = baselineCost - annualCost;
  const savedPercent = baselineMWh > 0 ? (savedMWh / baselineMWh) * 100 : 0;
  const liquidMW = (itMW * capture) / 100;
  const residualMW = itMW - liquidMW;
  // MW -> kJ/s. cp is kJ/(kg K); deltaT is K. Fluid properties are constant inputs.
  const massKgS = (liquidMW * 1000) / (cp * deltaT);
  const volumeM3S = massKgS / density;
  const flowLS = volumeM3S * 1000;
  const flowM3H = volumeM3S * 3600;
  // kPa * m3/s = kW. This is a separate estimate, not added to the PUE scenario.
  const hydraulicKW = pressure * volumeM3S;
  const pumpKW = hydraulicKW / (efficiency / 100);
  return {
    facilityMW,
    overheadMW,
    itMWh,
    energyMWh,
    annualCost,
    baselineMW,
    baselineMWh,
    baselineCost,
    savedMWh,
    savedCost,
    savedPercent,
    liquidMW,
    residualMW,
    massKgS,
    volumeM3S,
    flowLS,
    flowM3H,
    hydraulicKW,
    pumpKW,
  };
}
export function pickInputs(input) {
  return Object.fromEntries(
    Object.keys(DEFAULTS).map((key) => [key, input[key]]),
  );
}
export function encodeScenario(input) {
  calculate(input);
  return (
    "#scenario=" +
    encodeURIComponent(
      JSON.stringify({ v: MODEL_VERSION, ...pickInputs(input) }),
    )
  );
}
export function decodeScenario(hash) {
  if (!hash.startsWith("#scenario=") || hash.length > 4000) return null;
  try {
    const data = JSON.parse(decodeURIComponent(hash.slice(10)));
    if (!data || data.v !== MODEL_VERSION) return null;
    const input = pickInputs(data);
    return Object.keys(validate(input)).length ? null : input;
  } catch {
    return null;
  }
}
export const SOURCES = Object.freeze([
  {
    title:
      "DOE: Best Practices Guide for Energy-Efficient Data Center Design (2024)",
    url: "https://www.energy.gov/sites/default/files/2024-07/best-practice-guide-data-center-design.pdf",
    use: "PUE boundary and efficiency context; no performance benchmark adopted.",
  },
  {
    title: "DOE: Thermodynamics, Heat Transfer and Fluid Flow, Volume 1",
    url: "https://www.energy.gov/documents/doe-hdbk-1012-92vol1",
    use: "Sensible-heat energy balance.",
  },
  {
    title: "NIST Chemistry WebBook: Thermophysical Properties of Fluid Systems",
    url: "https://webbook.nist.gov/chemistry/fluid/",
    use: "Reference for choosing fluid properties; defaults are editable approximations, not a live property calculation.",
  },
]);
export function exportScenario(input) {
  return {
    application: "FATHOM",
    modelVersion: MODEL_VERSION,
    exportedAt: new Date().toISOString(),
    inputs: pickInputs(input),
    results: calculate(input),
    units: {
      itMW: "MW",
      pue: "ratio",
      baselinePue: "ratio",
      price: `${input.currency}/kWh`,
      hours: "h/year",
      capture: "%",
      deltaT: "K",
      cp: "kJ/(kg K)",
      density: "kg/m3",
      pressure: "kPa",
      efficiency: "%",
      facilityMW: "MW",
      overheadMW: "MW",
      itMWh: "MWh/year",
      energyMWh: "MWh/year",
      annualCost: `${input.currency}/year`,
      baselineMW: "MW",
      baselineMWh: "MWh/year",
      baselineCost: `${input.currency}/year`,
      savedMWh: "MWh/year",
      savedCost: `${input.currency}/year`,
      savedPercent: "%",
      liquidMW: "MW",
      residualMW: "MW",
      massKgS: "kg/s",
      volumeM3S: "m3/s",
      flowLS: "L/s",
      flowM3H: "m3/h",
      hydraulicKW: "kW",
      pumpKW: "kW",
    },
    assumptions: [
      "Average IT power and energy-weighted PUE are constant over selected operating hours.",
      "Energy-only cost: no demand charges, fixed charges, tax, capital cost or uptime estimate.",
      "Changing currency relabels values; it does not convert exchange rates or select a local tariff.",
      "Cooling covers the selected fraction of IT heat only; facility overhead is excluded.",
      "Single-phase sensible heat, constant fluid properties; pump heat feedback and heat-exchanger sizing excluded.",
      "Flow is recirculating loop flow, not water withdrawal or consumption.",
      "Pump electricity is a separate estimate and must not be added again to total PUE-based facility power.",
    ],
    sources: SOURCES,
  };
}
export function exportCSV(input) {
  const pack = exportScenario(input);
  const rows = [
    ["section", "metric", "value", "unit"],
    ...Object.entries(pack.inputs).map(([key, value]) => [
      "input",
      key,
      value,
      pack.units[key] || "",
    ]),
    ...Object.entries(pack.results).map(([key, value]) => [
      "result",
      key,
      value,
      pack.units[key] || "",
    ]),
  ];
  return (
    rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
