# FATHOM methodology

Model version **1.0**, published October 23, 2026. These are screening equations with user-supplied assumptions. A model-version change is required when interpretation or equations change incompatibly.

## 1. Energy boundary

`itMW` is average electrical power consumed by IT equipment over the chosen operating hours, not installed/nameplate capacity and not a GPU utilization percentage. PUE is entered by the user and held constant, representing an energy-weighted ratio over those hours.

```text
facilityMW = itMW × pue
overheadMW = facilityMW − itMW
energyMWh = facilityMW × hours
annualCost = energyMWh × 1,000 × pricePerKWh
```

PUE includes the chosen whole-facility boundary: cooling, lighting and electrical losses are part of overhead. The app does not derive PUE from cooling performance. Baseline calculations use the same IT load, hours, currency and energy price, changing only PUE. Savings equal baseline minus scenario; a worse PUE produces negative savings. Zero load or zero hours yields zero energy and cost. At zero baseline energy, the displayed relative energy difference is zero by convention.

`hours` can be 0–8,784, including a leap year. When fewer hours are selected, no energy is included outside those hours. A site with persistent idle draw needs that draw represented in its average IT load and annual operating hours. Zero IT power with fixed facility overhead cannot be represented by this proportional model.

Costs are energy-only. Demand/connection charges, fixed charges, tax, capacity payments, capital expenditure and time-varying tariffs are excluded. Currency choices relabel the scenario; they perform no exchange-rate conversion and select no geographic tariff.

**Reference:** [US DOE, Best Practices Guide for Energy-Efficient Data Center Design, revised July 2024, section 8.1](https://www.energy.gov/sites/default/files/2024-07/best-practice-guide-data-center-design.pdf). This supports the PUE definition and boundary, not a claimed achievable performance level.

## 2. Heat and circulation

The selected fraction of IT electrical power is treated as sensible heat in one liquid loop. IT heat outside the loop is displayed separately. Facility overhead is excluded from this heat calculation because the app does not know which overhead components transfer heat into this particular loop.

```text
liquidHeatMW = itMW × capturePercent / 100
residualITHeatMW = itMW − liquidHeatMW
massFlowKgS = liquidHeatMW × 1,000 / (cpKJPerKgK × deltaTK)
volumeFlowM3S = massFlowKgS / densityKgM3
volumeFlowLS = volumeFlowM3S × 1,000
volumeFlowM3H = volumeFlowM3S × 3,600
```

The first factor of 1,000 converts MW to kJ/s. The fluid is single phase with constant specific heat and density over the selected interval. A Kelvin temperature _difference_ has the same magnitude as a Celsius temperature difference. This does not equate the absolute temperature scales.

Defaults of 4.18 kJ/(kg K) and 1,000 kg/m³ are approximate water properties for screening. They are not a live NIST lookup, seawater properties, or a glycol-mixture specification. Enter properties for the actual fluid, temperature and pressure. Changing a property changes circulation, not the heat supplied.

For a fixed heat load and specific heat, doubling temperature rise halves mass flow. This does not prove that equipment permits the higher temperature. Heat-exchanger effectiveness/UA, approach temperatures, pressure-dependent properties, phase change, environmental discharge limits and component temperature limits are outside the model.

**References:** [DOE Fundamentals Handbook, Thermodynamics, Heat Transfer and Fluid Flow, Volume 1](https://www.energy.gov/documents/doe-hdbk-1012-92vol1), sensible-heat balance; [NIST Chemistry WebBook, SRD 69](https://webbook.nist.gov/chemistry/fluid/), a source for selecting thermophysical properties.

## 3. Pump electricity

```text
hydraulicKW = loopPressureDropKPa × volumeFlowM3S
pumpKW = hydraulicKW / (wireToWaterEfficiencyPercent / 100)
```

1 kPa × 1 m³/s equals 1 kW. Pressure drop and combined wire-to-water efficiency are independent assumptions, not pump-curve predictions. The model does not solve pipe hydraulics, redundancy, variable-speed control or a coupled pump-heat balance.

**No double counting:** PUE already encompasses facility overhead. The pump result is a separate educational estimate; it is not added to the PUE-based total. It is also not fed back into the selected IT heat load. For a complete design model, heat routing and coupled power/thermal iteration must be explicit.

## 4. Numerical boundaries and exports

The interface validates finite numbers and bounded inputs before calculating, saving, sharing or exporting. Bounds are screening/UI limits, not equipment ratings. Invalid inputs preserve the last valid result visibly marked as stale and disable result actions. Calculations use JavaScript double precision; rounding is only for display.

JSON contains the version, timestamp, inputs, unrounded results, units, assumptions and source references. CSV contains inputs and unrounded results with units. A share link holds the version and validated input allowlist in the URL fragment. Unsupported versions and malformed values are rejected. Saved comparisons retain their own currency; the app does not compare currencies as though they were equivalent.

## 5. Verification

The automated suite covers an independent annual-energy reference, energy/heat conservation, pump-unit conversion, zero cases, worsening PUE, sensitivity relationships, invalid input boundaries, share encoding/validation and export reproducibility. See [QA.md](QA.md) for the release's browser checks.

Passing software tests establishes consistency with these equations. It does not establish accuracy for an operating facility or validate the earlier FATHOM research estate.
