import {
  DEFAULTS,
  LIMITS,
  LABELS,
  calculate,
  validate,
  pickInputs,
  encodeScenario,
  decodeScenario,
  exportScenario,
  exportCSV,
} from "./model.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = "fathom-comparisons-v1";
let state = { ...DEFAULTS };
let activeTab = "power";
let saved = [];
let toastTimer;
const money = (value, compact = false, currency = state.currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 0,
  }).format(value);
const number = (value, digits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
    value,
  );
const text = (id, value) => {
  $(id).textContent = value;
};
function toast(message) {
  text("#toast", message);
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3800);
}
function field(
  key,
  { unit = "", step = "any", help = "", range = null, suffix = "" } = {},
) {
  const [min, max] = LIMITS[key];
  const id = `input-${key}${suffix}`;
  const errorId = `error-${key}${suffix}`;
  return `<div class="field" data-field-wrapper="${key}"><div class="field-line"><label for="${id}">${LABELS[key]}</label><div class="input-box"><input id="${id}" data-field="${key}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${state[key]}" required aria-describedby="${id}-help ${errorId}"><span>${unit}</span></div></div><p class="field-help" id="${id}-help">${help}</p>${range ? `<input type="range" data-range="${key}" min="${range[0]}" max="${range[1]}" step="${range[2]}" value="${state[key]}" aria-label="${LABELS[key]} slider"><div class="range-labels"><span>${range[0]} ${unit}</span><span>${range[1]} ${unit}</span></div>` : ""}<p id="${errorId}" class="field-error" hidden></p></div>`;
}
$("#power-fields").innerHTML = [
  field("itMW", {
    unit: "MW",
    step: 0.01,
    range: [0, 100, 0.25],
    help: "Average draw of IT equipment, not nameplate capacity.",
  }),
  `<div class="field-grid">${field("pue", { unit: "PUE", step: 0.01, help: "Facility energy ÷ IT energy." })}${field("baselinePue", { unit: "PUE", step: 0.01, help: "Your comparison case." })}</div>`,
  `<div class="field-grid">${field("price", { unit: "/kWh", step: 0.001, help: "Enter an energy-only rate." })}${field("hours", { unit: "h/yr", step: 1, help: "8,760 for a full non-leap year." })}</div>`,
].join("");
$("#cooling-fields").innerHTML = [
  field("itMW", {
    unit: "MW",
    step: 0.01,
    suffix: "-cooling",
    help: "Shared with your power scenario.",
  }),
  field("capture", {
    unit: "%",
    step: 1,
    range: [0, 100, 1],
    help: "Fraction of IT heat entering this liquid loop.",
  }),
  field("deltaT", {
    unit: "K",
    step: 0.5,
    range: [1, 40, 0.5],
    help: "Temperature rise across the load; 1 K difference = 1 °C.",
  }),
].join("");
$("#advanced-fields").innerHTML = [
  field("cp", {
    unit: "kJ/kg·K",
    help: "Specific heat at the operating condition.",
  }),
  field("density", {
    unit: "kg/m³",
    help: "Fluid density at the operating condition.",
  }),
  field("pressure", {
    unit: "kPa",
    help: "Total pressure drop across this loop.",
  }),
  field("efficiency", {
    unit: "%",
    help: "Combined wire-to-water efficiency.",
  }),
].join("");

function setTab(tab, focus = false) {
  activeTab = tab;
  for (const candidate of ["power", "cooling"]) {
    const on = candidate === tab;
    const button = $(`#tab-${candidate}`);
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    $(`#panel-${candidate}`).hidden = !on;
    $(`#${candidate}-results`).hidden = !on;
  }
  text("#result-model", tab === "power" ? "CONSTANT LOAD" : "SENSIBLE HEAT");
  if (focus) $(`#tab-${tab}`).focus();
}

function syncInputs() {
  for (const input of $$("[data-field]")) {
    if (document.activeElement !== input)
      input.value = Number.isFinite(state[input.dataset.field])
        ? state[input.dataset.field]
        : "";
  }
  for (const slider of $$("[data-range]")) {
    const value = state[slider.dataset.range];
    if (slider.dataset.range === "itMW") {
      // Keep the useful 0–100 MW default scale while representing larger typed loads honestly.
      slider.max = String(
        Number.isFinite(value)
          ? Math.max(
              100,
              Math.min(LIMITS.itMW[1], Math.ceil(value / 100) * 100),
            )
          : 100,
      );
      slider.nextElementSibling.lastElementChild.textContent = `${number(Number(slider.max), 0)} MW`;
    }
    const min = Number(slider.min),
      max = Number(slider.max);
    slider.value = Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : min;
    slider.style.setProperty(
      "--position",
      `${((Number(slider.value) - min) / (max - min)) * 100}%`,
    );
    slider.setAttribute(
      "aria-valuetext",
      Number.isFinite(value) ? String(value) : "Invalid input",
    );
  }
  $("#currency").value = state.currency;
  for (const button of $$("[data-preset]")) {
    const active = Number(button.dataset.preset) === state.itMW;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function render() {
  syncInputs();
  const errors = validate(state);
  const invalid = Object.keys(errors).length > 0;
  for (const wrapper of $$("[data-field-wrapper]")) {
    const message = errors[wrapper.dataset.fieldWrapper];
    wrapper.classList.toggle("invalid", Boolean(message));
    wrapper
      .querySelector("[data-field]")
      .setAttribute("aria-invalid", String(Boolean(message)));
    wrapper.querySelector(".field-error").hidden = !message;
    wrapper.querySelector(".field-error").textContent = message || "";
  }
  $(".results-column").dataset.invalid = String(invalid);
  $("#validation-summary").hidden = !invalid;
  text(
    "#validation-summary",
    invalid
      ? "Update the highlighted inputs to calculate, save or export. The values shown are from the last valid scenario."
      : "",
  );
  text("#result-status", invalid ? "CHECK INPUTS" : "LIVE SCENARIO");
  for (const id of ["#save-scenario", "#download", "#download-csv", "#share"])
    $(id).disabled = invalid;
  if (invalid) return;
  const r = calculate(state);
  text("#annual-cost", money(r.annualCost, true));
  $("#annual-cost").title = money(r.annualCost);
  text("#result-currency", `${state.currency} / YR`);
  text(
    "#energy-caption",
    `${number(state.hours, 0)} hours · ${number(state.price, 3)} ${state.currency}/kWh · ${money(r.annualCost)} per year`,
  );
  text("#facility", `${number(r.facilityMW)} MW`);
  text("#energy", `${number(r.energyMWh / 1000)} GWh`);
  text("#pue-badge", `PUE ${state.pue.toFixed(2)}`);
  const itPercent = r.facilityMW > 0 ? (state.itMW / r.facilityMW) * 100 : 0;
  $("#it-bar").style.width = `${itPercent}%`;
  $("#overhead-bar").style.width = `${r.facilityMW > 0 ? 100 - itPercent : 0}%`;
  text("#it-label", `${number(state.itMW)} MW`);
  text("#overhead-label", `${number(r.overheadMW)} MW`);
  $("#power-bar").setAttribute(
    "aria-label",
    `Facility demand: ${number(r.facilityMW)} MW. IT: ${number(state.itMW)} MW. Overhead: ${number(r.overheadMW)} MW.`,
  );
  const increased = r.savedCost < -1e-8;
  const noCostChange = Math.abs(r.savedCost) < 1e-8;
  $("#comparison-note").classList.toggle("negative", increased);
  text(
    "#saved-cost",
    noCostChange
      ? "No energy-cost difference"
      : `${money(Math.abs(r.savedCost), true)} / year ${increased ? "more" : "less"}`,
  );
  text(
    "#saved-caption",
    `${number(Math.abs(r.savedMWh) / 1000)} GWh ${r.savedMWh < 0 ? "more" : "less"} energy (${number(Math.abs(r.savedPercent), 1)}%) vs PUE ${state.baselinePue.toFixed(2)}. Same IT load, hours and rate.`,
  );
  text("#loop-flow", number(r.flowLS, 1));
  text(
    "#flow-caption",
    `${number(r.massKgS, 1)} kg/s · ${number(r.flowM3H, 1)} m³/hour · ${number(state.deltaT)} K rise`,
  );
  text("#heat-captured", `${number(r.liquidMW)} MW`);
  text("#pump-power", `${number(r.pumpKW, 1)} kW`);
  text("#loop-heat", `${number(r.liquidMW)} MW`);
  text("#residual-heat", `${number(r.residualMW)} MW to other cooling`);
  $("#thermal-diagram").setAttribute(
    "aria-label",
    `${number(r.liquidMW)} MW of IT heat carried to a heat exchanger. Required circulation ${number(r.flowLS, 1)} litres per second.`,
  );
}

document.addEventListener("input", (event) => {
  const input = event.target;
  const key = input.dataset.field || input.dataset.range;
  if (!key) return;
  state[key] = input.value.trim() === "" ? NaN : Number(input.value);
  render();
});
$("#currency").addEventListener("change", (event) => {
  state.currency = event.target.value;
  render();
});
for (const button of $$("[data-tab]"))
  button.addEventListener("click", () => setTab(button.dataset.tab));
$(".tabs").addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    setTab(
      event.key === "Home"
        ? "power"
        : event.key === "End"
          ? "cooling"
          : activeTab === "power"
            ? "cooling"
            : "power",
      true,
    );
  }
});
for (const button of $$("[data-preset]"))
  button.addEventListener("click", () => {
    state.itMW = Number(button.dataset.preset);
    render();
  });
$("#reset").addEventListener("click", () => {
  state = { ...DEFAULTS };
  render();
  toast("Inputs reset. Saved comparisons are unchanged.");
});

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    toast(
      "Browser storage is unavailable. Comparisons will last for this visit only.",
    );
  }
}
function renderSaved() {
  const container = $("#scenario-list");
  container.replaceChildren();
  $("#clear-scenarios").hidden = saved.length === 0;
  if (!saved.length) {
    const blank = document.createElement("div");
    blank.className = "empty-scenarios";
    blank.innerHTML =
      '<span aria-hidden="true">⊞</span><p>Your comparisons live here.<br/><span>Saved only in this browser.</span></p>';
    container.append(blank);
    return;
  }
  saved.forEach((input, index) => {
    const r = calculate(input);
    const card = document.createElement("article");
    card.className = "saved-card";
    // Only validated numeric state and allowlisted currency codes enter these templates.
    card.innerHTML = `<div class="saved-card-heading"><span>SCENARIO / 0${index + 1}</span><button aria-label="Remove scenario ${index + 1}" title="Remove scenario">×</button></div><strong>${money(r.annualCost, true, input.currency)}</strong><span class="saved-currency">${input.currency} / YEAR</span><div class="saved-details"><span>${number(input.itMW)} MW IT</span><span>PUE ${input.pue.toFixed(2)}</span><span>${number(r.energyMWh / 1000)} GWh/year</span><span>${number(r.flowLS, 1)} L/s</span></div><button class="load-scenario">Load this scenario ↗</button>`;
    card
      .querySelector('[title="Remove scenario"]')
      .addEventListener("click", () => {
        saved.splice(index, 1);
        persist();
        renderSaved();
        toast("Comparison removed.");
      });
    card.querySelector(".load-scenario").addEventListener("click", () => {
      state = { ...input };
      render();
      toast(`Scenario ${index + 1} loaded.`);
    });
    container.append(card);
  });
}
$("#save-scenario").addEventListener("click", () => {
  if (Object.keys(validate(state)).length) return;
  if (saved.length >= 3) {
    toast("Three comparisons saved. Remove one to make room.");
    return;
  }
  const snapshot = pickInputs(state);
  if (saved.some((item) => JSON.stringify(item) === JSON.stringify(snapshot))) {
    toast("This scenario is already saved.");
    return;
  }
  saved.push(snapshot);
  persist();
  renderSaved();
  toast("Scenario saved in this browser.");
});
$("#clear-scenarios").addEventListener("click", () => {
  saved = [];
  persist();
  renderSaved();
  toast("Saved comparisons cleared.");
});

function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#download").addEventListener("click", () => {
  if (!Object.keys(validate(state)).length) {
    download(
      JSON.stringify(exportScenario(state), null, 2) + "\n",
      "application/json",
      "fathom-scenario.json",
    );
    toast("Scenario JSON downloaded, including assumptions and sources.");
  }
});
$("#download-csv").addEventListener("click", () => {
  if (!Object.keys(validate(state)).length) {
    download(exportCSV(state), "text/csv;charset=utf-8", "fathom-scenario.csv");
    toast("Scenario CSV downloaded.");
  }
});
$("#share").addEventListener("click", async () => {
  if (Object.keys(validate(state)).length) return;
  const url = new URL(location.href);
  url.search = "";
  url.hash = encodeScenario(state);
  try {
    await navigator.clipboard.writeText(url.href);
    toast("Scenario link copied. The link contains your input values.");
  } catch {
    $("#share-url").value = url.href;
    $("#share-dialog").showModal();
    $("#share-url").select();
  }
});
for (const button of $$("[data-example]"))
  button.addEventListener("click", () => {
    const example = button.dataset.example;
    state = {
      ...DEFAULTS,
      ...(example === "thermal"
        ? { deltaT: 20 }
        : example === "energy"
          ? { itMW: 1 }
          : {}),
    };
    setTab(example === "thermal" ? "cooling" : "power");
    render();
    $("#workbench").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    toast(
      example === "thermal"
        ? "Try 10 K and 20 K to compare circulation."
        : example === "energy"
          ? "Loaded a 1 MW IT scenario."
          : "Compare PUE 1.20 with the 1.40 reference.",
    );
  });

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(stored))
    saved = stored
      .filter((item) => item && !Object.keys(validate(item)).length)
      .slice(0, 3)
      .map(pickInputs);
} catch {
  /* Private browsing and malformed storage fall back to an empty tray. */
}
function loadShared() {
  if (!location.hash.startsWith("#scenario=")) return;
  const shared = decodeScenario(location.hash);
  if (shared) {
    state = shared;
    render();
    toast("Shared scenario loaded.");
  } else
    toast("This scenario link is invalid or uses a different model version.");
}
render();
renderSaved();
loadShared();
window.addEventListener("hashchange", loadShared);
