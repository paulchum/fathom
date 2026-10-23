# Release verification

Checked October 23, 2026, for v0.1.0 / model 1.0.

## Automated checks

`npm run check` checks JavaScript syntax, runs 16 Node tests and builds the static site without installing dependencies. The tests use independent reference numbers, conservation identities and sensitivity relationships, as well as invalid-input, URL and export boundaries.

## Browser checks

Manually exercised in the Codex in-app browser on macOS. Desktop viewport: 1280 × 900. Narrow viewports: 390 × 844 and 320 × 740. These are responsive viewport checks, not physical-device or comprehensive cross-browser certification.

| Check                              | Observed result                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 MW, PUE 1.2, 8,760 h, price 0.10 | 1.2 MW facility power; 10,512 MWh/year; 1,051,200 annual cost                                                          |
| Reference PUE 1.4                  | 175,200 annual cost reduction in the 1 MW case                                                                         |
| Scenario PUE above the reference   | Result changes to “more” cost, with a distinct visual treatment                                                        |
| Empty load input                   | Inline validation; stale results identified; save/share/export disabled                                                |
| Three saved comparisons            | All three remain after reloading; loading restores the chosen input values                                             |
| Currency                           | CAD changes the label without changing the numerical cost; saved USD cases retain USD                                  |
| Share link                         | Loading the copied link restores the 1 MW CAD scenario after a reset                                                   |
| JSON / CSV downloads               | Downloaded files contain the same 10,512 MWh and 1,051,200 CAD result; JSON includes units, assumptions and references |
| Cooling reference                  | 4.18 MW, 100% capture, 10 K, cp 4.18, density 1,000 gives 100 L/s and 360 m³/h                                         |
| Pump reference                     | 100 L/s, 100 kPa and 50% efficiency gives 20 kW                                                                        |
| Temperature sensitivity            | Changing 10 K to 20 K halves reference flow to 50 L/s and pump input to 10 kW                                          |
| Keyboard                           | Arrow keys switch the two calculator tabs and move focus                                                               |
| Large typed load                   | A 1,000 MW load expands the slider maximum and its visible label to 1,000 MW                                           |
| Narrow layout                      | Inputs and results stack; no document-level horizontal overflow at tested widths                                       |
| Console                            | No warnings or errors observed during these checks                                                                     |

Test comparisons were cleared after verification. [Desktop preview](preview.png) and [mobile preview](mobile-preview.png) show the release interface. Reduced-motion and print styles are included, but were not separately exercised in this browser check.

## Limits

These checks verify the implemented screening equations and observed interactions. They do not validate a facility design, an achievable PUE, an operating temperature or real-world costs. Dedicated assistive-technology and additional browser/device testing remain useful follow-up work.
