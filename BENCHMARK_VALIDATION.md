# Published benchmark validation and QC upgrade

The lab uses canonical field units internally. Numerical acceptance, reference-data quality, and full field-model reproduction are distinct claims. A passing arithmetic checkpoint does not establish that undocumented aquifer, gas-cap or PVT calibration assumptions have been reproduced.

## Comparison

| Benchmark                          | Expected / published                           | Calculated from reproduced data              | Difference                                                   | Status                                                    |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Virginia Hills                     | Printed OOIP ≈257 MMSTB                        | Through-origin slope **282.829065946 MMSTB** | +25.829065946 MMSTB; +10.0502202%                            | REFERENCE_DISCREPANCY                                     |
| Dake gas cap, fixed m=.5           | ≈115 MMSTB                                     | **114.560732378 MMSTB**                      | −0.439267622 MMSTB; −0.381972%                               | PASS for term arithmetic and approximate fixed-m exercise |
| Iraqi Tertiary, year-2000 F (Bw=1) | ≈23.01567 MMrb                                 | **23.01567192722482 MMrb**                   | +0.00000192722482 MMrb from rounded expected value           | PARTIAL_VALIDATION overall; withdrawal checkpoint passes  |
| SABA small-pot field model         | OOIP 23.371 million m³; reported RMSE 2.306568 | Exact field model not calculated             | Not comparable without complete inputs and measurement basis | INSUFFICIENT_SOURCE_DATA                                  |

The raw CSV/JSON sources are under `public/benchmarks/`. Static independent arithmetic answers are in `src/tests/benchmarks/term-answers.json`. The latter were calculated using 40-digit Python Decimal arithmetic outside the TypeScript engine; the test does not generate expected terms using the helper under test. Source PDFs are not redistributed.

## Virginia Hills: discrepancy investigation

Source: Ahmed & McKinney, _Advanced Reservoir Engineering_, Chapter 4, Example 4.3, printed pp.309–310, as transcribed in the task. The same raw table is corroborated by the publisher's [Ahmed Handbook Example 11-3 material](https://www.sciencedirect.com/topics/engineering/material-balance-equation).

Pi=3685 psia, Pb=1500 psia, Boi=1.3102 rb/STB, Swi=.24, cf=4.95e−6 psi⁻¹, cw=3.62e−6 psi⁻¹, Bw=1, m=0, aquifer None. Every observation is above Pb. The exercise needs no invented Rs, Bg, Z or production dates: constant associated solution gas cancels in the reduced withdrawal formulation.

```text
F = Np Bo + Wp Bw
Eo = Bo − Boi
Efw = Boi (cf + Swi cw)/(1−Swi) (Pi−p)
Et = Eo + Efw
N_origin = Σ(Et F) / Σ(Et²)
```

| p, psia |        F, rb | Eo, rb/STB |          Efw, rb/STB |           Et, rb/STB |
| ------: | -----------: | ---------: | -------------------: | -------------------: |
|    3680 |  26,838.3024 |      .0002 | .0000501565247368421 | .0002501565247368421 |
|    3448 | 1,674,723.89 |      .0028 |  .002377419272526316 |  .005177419272526316 |
|    3188 | 3,399,709.61 |      .0068 |  .004985558558842105 |  .011785558558842106 |

MSTB is converted to STB by ×1000; plots divide F by 10⁶ to obtain MMrb. Pressure differences use consistent psi. There is no gas-cap multiplier or influx term. The rock/water coefficient calculated without intermediate rounding is 1.0031304947368421e−5 rb/STB/psi; the source's displayed 10.0e−6 coefficient is rounded.

All nonzero-expansion raw observations give 282.829065946 MMSTB by ordinary least squares constrained through the origin. Initial zero/zero contributes nothing. A different, unconstrained regression including the initial row gives slope 290.074322875 MMSTB and intercept −55,808.596 rb; a simple mean of individual F/Et ratios gives 237.892619817 MMSTB. These are different statistical estimators, not interchangeable material-balance answers. Early observations are especially sensitive to small pressure/FVF changes. No investigated convention is silently selected merely because it approaches 257.

The task reports approximately 283.82 MMSTB from the book's rounded, already-calculated F/Et columns. The exact rounded-column transcription was not independently recovered here, so that figure is identified as task-reported rather than independently certified. Its difference from the raw-data fit is about 0.991 MMSTB (0.35%); both are far from 257. Units, use of the origin constraint, gas-cap double counting and injection signs do not explain the printed answer in this reconstruction. A corrected solution table, exact plotted point selection or an author clarification is required to resolve 257. The engine is not adjusted to force it.

The temporary scenario starts with an explicitly labelled trial N=300 MMSTB, so predictions can stay inside the finite supplied Bo range. The graphical fitted N is calculated independently of that entered value. A pressure fit requiring properties below the last table pressure must fail or require explicit extrapolation; a textbook straight-line estimate is not automatically a validated forward pressure model.

## Dake: gas-cap terms, rounding and identifiability

Source: Dake, _Fundamentals of Reservoir Engineering_, Ch.3 Exercise 3.4, pp.87–90. Raw table values are independently corroborated by the primary [Texas A&M thesis, Table 3.1, printed p.14](https://oaktrust.library.tamu.edu/server/api/core/bitstreams/94c5a927-f3c0-407c-8f73-7020add8963b/content), which identifies the table as reprinted from Dake with publisher permission.

Pi=Pb=3330 psia; Boi=1.2511; Rsi=510 scf/STB; Bgi=.00087 rb/scf. No aquifer, water/injection or pore-compressibility contribution is included for the exercise. N starts at 115 MMSTB and m=.5. The initial PVT row is explicit; Np=0 implies Gp=0, while initial Rp remains undefined in the source CSV.

At 3150 psia, Np=3.295e6 STB and cumulative Rp=1050 scf/STB give Gp=3,459,750,000 scf:

```text
F = 5,807,305.7 rb
Eo = .01456 rb/STB
Eg⁰ = Boi(Bg/Bgi−1) = .07190229885057471 rb/STB
stored Eg = m Eg⁰ = .03595114942528736 rb/STB
N(Eo + m Eg⁰) = 5,808,782.183908046 rb
```

Every history F, Eo and Eg⁰ is checked against independent numbers. Fixed m=.4/.5/.6 yields N=132.263769220 / 114.560732378 / 101.036643825 MMSTB. The unconstrained F/Eo–Eg⁰/Eo regression yields N=108.702727372 MMSTB and m=.541202003. The coefficient correlation corr(N,Nm)=−.996961988 warns that extrapolating the intercept to x=0 is poorly constrained. Leaving one survey out gives N=103.499822–118.435235 MMSTB and m=.479123–.580567. These are leverage ranges, not confidence intervals. A separate 42-trial printed-digit stress test varies one Bo, Rs or Bg cell at a time (including initial PVT) by ±0.00005 rb/STB, ±0.5 scf/STB or ±0.000005 rb/scf. Fixed-m N spans 112.488626–116.670145 MMSTB. The unconstrained joint N spans −51.638409–196.046522 MMSTB, and inferred m spans −1.955128–24.626601. One joint fit is nonphysical and retained for diagnosis. These are one-cell stress ranges, not simultaneous uncertainty envelopes or confidence intervals. The PASS classification is not a uniqueness claim.

For nonzero rock/water expansion, define:

```text
K = Boi [(cf + Swi cw)/(1−Swi)] (Pi−p)
F−We = N(Eo+K) + Nm(Eg⁰+K)
Y = (F−We)/(Eo+K), X = (Eg⁰+K)/(Eo+K)
```

The intercept is N, slope Nm. Reusing F/Eo versus Eg⁰/Eo when K is nonzero would omit the m-dependence of Efw; the new module uses the general expression and has a separate exact-closure fixture test. The existing stored Eg convention is retained and never multiplied by m twice.

## Iraqi Tertiary: arithmetic accepted, model incomplete

Primary source: [Abed, Tawfeeq & Awad (2026), Tables 1–2, printed p.451](https://vurup.sk/download/3145/3417). The two tables were visually checked against rendered PDF pages; CSV preserves values/units. The 2000–2015 years remain observation labels rather than invented month/day dates.

For the explicit Bw=1 check, the first row gives F=23.01567192722482 MMrb, Eo=.4165271853 rb/STB and Eg⁰=.9205080831408776 rb/STB. All 16 rowwise withdrawals/expansions are reconstructed and exportable in the case workspace.

Important unresolved source issues:

- Gp=Np×reported Rp decreases in 12 year-to-year intervals. It cannot be a physically monotone cumulative gas series under that interpretation. The values are preserved, flagged, and blocked from forward fitting; no smoothing, averaging or invented replacement history is used.
- Initial Rsi=1051 at 3319 psi differs sharply from the first history Rs=567.9011 at 3186.77 psi. Bg rises from .000866 to .001377 over that interval, and later reaches .01274 at 3027.1 psi. The QC screen flags those trends without asserting their cause.
- m, calibrated water influx, cf/cw/Swi, Pb and the fine-tuned calibration inputs are not established by the supplied tables.

For an explicitly declared exploratory m=0, cf=cw=0, We=0 baseline only, the origin slope is 8.650981157 MMSTB; an unconstrained two-parameter graphical fit gives a negative N and is physically invalid. Neither reproduces 1237.3 MMSTB (Excel/RUN), 1245.66 (MBAL) or 1226 (volumetric). This does not diagnose an engine defect: both data interpretation and missing calibration assumptions remain unresolved. Opening this temporary baseline requires acknowledgement; it is not a published calibrated reservoir model.

## SABA: controlled support test, no fabricated field reconstruction

Primary source: [Bawahab & Hazim (2023), Tables 1–4 and Figures 5–7](https://ojs.uni-miskolc.hu/index.php/geosciences/article/download/2221/1870/10575). The printed small-pot result is from the single-tank analysis. A later multi-tank/transmissibility study is distinct. Table 1/2 aggregates are recorded in `saba-published-summary.json`; they do not supply complete dated histories or pressure-dependent fluid properties.

The reported small-pot OOIP is 23.371 million m³, equivalent to approximately 147.0 MMSTB, and RMSE=2.306568 on the source's measurement basis. This RMSE is not relabelled as psi. The water-inflow constant 228.4 m³/bar is not silently adopted as a calibrated equilibrium storage coefficient.

The case instead offers a clearly labelled independent artificial support experiment: Pi=3000, N=10e6 STB, Np=1e6 STB, Bo=1.2+.0001(Pi−p), no cap/rock/water/injection. For Caq=500 rb/psi:

```text
Δp = 1,200,000 / (900 + Caq)
None pressure = 1666.666666667 psia
Pot pressure = 2142.857142857 psia
Pressure support = 476.190476190 psi
We = 428,571.428571429 rb
```

These values independently verify the sign and magnitude of equilibrium support. They are not SABA observations or SABA RMSE. Exact field reproduction needs complete dated withdrawals/injections/surveys, pressure-dependent PVT, initial gas reference states, compressibilities and calibrated aquifer parameters. Transient aquifers and multiple communicating tanks remain unsupported.

## Code changes and verification boundaries

- Retained correct oil/gas balance algebra, signed contributions and canonical field-unit conversions.
- Fixed direct PVT validation of missing/nonfinite keys; explicit nulls now distinguish missing unused oil properties from numbers. Bo-only mode is restricted to above Pb, m=0 and no free-gas withdrawal/injection.
- Added PVT initial-state/source/trend QC, per-column reference units, cumulative Rp conversion and undated observation handling. Gas table Bg/Z requirements and existing gas regressions remain checked.
- Kept bracketed bisection. The solver now scans both sides of pi, includes PVT knots/Pb, reports detected alternate roots, and checks reservoir-volume closure. Finite scanning is not a proof that every root exists; tangencies and narrow roots can be missed.
- Added the general gas-cap linearization, correlation/leverage diagnostics and pressure-basis selection for signed drive indices.
- Added bounded Auto Match for N, N/m or N/Pot storage, with deterministic methods, fixed PVT, full-survey root requirements, reviewed application and local sensitivities. No optimizer uniqueness/global-optimum guarantee is made.
- Added temporary learning scenarios with automatic persistence suspended, explicit restoration of the user's model, editable source copies, source/status explanations and audit exports.

Run `npm test`, `npm run typecheck`, `npm run build`. At the final upgrade check, 74 tests passed (39 prior tests retained plus 35 benchmark/workflow checks). TypeScript and the production build also passed. Browser verification is recorded in `VALIDATION.md`. The Vite base remains `/material-balance-lab/`. Deployment is reported only after its actual GitHub workflow succeeds.
