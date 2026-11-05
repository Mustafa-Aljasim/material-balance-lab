# Engineering methods and numerical contract

All engine values use consistent field units. Pressure is psia (absolute), temperature °F (converted to °R for gas equations), stock-tank liquids STB, gas scf, reservoir volumes rb. N/G are stored as individual STB/scf, not millions/billions. Internal arithmetic uses JavaScript IEEE-754 double precision. This document records the implemented model, not a claim of field validation.

## 1. Oil material balance

```text
F = Np Bo + (Gp − Np Rs) Bg + Wp Bw − Wi Bw,inj − Gi Bg,inj
Eo = (Bo − Boi) + (Rsi − Rs) Bg
Eg = m Boi (Bg/Bgi − 1)
Efw = (1 + m) Boi [(cf + Swi cw)/(1 − Swi)] (pi − p)
Et = Eo + Eg + Efw
support = N Et + We
closure = support − F
```

F and We are rb. Eo/Eg/Efw/Et are rb/STB. Bo/Bw are rb/STB; Bg is rb/scf. m is initial gas-cap reservoir volume / initial oil reservoir volume; it is already included in Eg and Efw, and is not multiplied a second time. Rsi is **selected-source Rs at pi**, including when a table is used. The expanded withdrawal avoids division by Np at zero oil production. Rp = Gp/Np is reported only when defined in the full black-oil formulation. Above-Pb Bo-only tables use F = Np Bo + Wp Bw − Wi Bwi and Eo = Bo − Boi, with m=0, no gas injection/free-gas withdrawal and constant associated Rs cancelling algebraically. Rs/Bg/Z and cumulative associated gas remain unknown, not inferred zero; the internal unused Gp sentinel is zero and Rp is not reported. Predictions below Pb are blocked. Bg,inj defaults to the current reservoir Bg or an explicitly entered positive FVF; Bw,inj is separately entered. Turning injection off sets both injection contributions to zero without altering cumulative data.

This is the classical constant-composition, equilibrium black-oil tank formulation (Havlena–Odeh). It excludes changing gas composition, volatile oil, relative-permeability production prediction and spatial pressure gradients. Compressibility terms are first-order approximations in pressure depletion.

## 2. Dry-gas reservoir-volume balance

```text
F = Gp Bg + Wp Bw − Wi Bw,inj − Gi Bg,inj
Eg = Bg − Bgi
Efw = Bgi [(cf + Swi cw)/(1 − Swi)] (pi − p)
Et = Eg + Efw
support = G Et + We
```

Gas expansion units are rb/scf. The pore term follows initial total pore volume `G Bgi/(1−Swi)` multiplied by `cf + Swi cw`. Water production enlarges the hydrocarbon space and has a positive withdrawal sign; injection reduces withdrawal. Oil production is not supported by the dry-gas model.

With no support/pore/water/injection terms, `Gp Bg = G(Bg−Bgi)`. Since `Bg ∝ Z/p` at constant T:

```text
p/Z = (pi/Zi)(1 − Gp/G)
```

The classical straight line is suppressed whenever any cf or Swi*cw contribution is nonzero, effective Pot storage is positive, water production/injection or gas injection is present, or sampled selected-source `Bg/Bgi` differs from `(Z/p)/(Zi/pi)` by more than 0.5%. This intentionally conservative rule does not silently treat a small nonvolumetric case as exactly volumetric. The general volume solver still runs. Temperature is constant for a scenario; there is no temperature history.

## 3. Selected PVT source

Both diagnostics and the pressure solver receive the same `PVTProvider`. No pressure-matching code uses a separate approximation.

### 3.1 Sutton pseudo-critical properties

```text
Tpc = 169.2 + 349.5 γg − 74.0 γg²   [°R]
Ppc = 756.8 − 131.0 γg − 3.6 γg²    [psia]
Tpr = (TF + 459.67)/Tpc
Ppr = p/Ppc
```

Sweet hydrocarbon gas only; accepted gravity 0.57–1.68. No Wichert–Aziz acid-gas correction is applied. For the oil correlation, γgc is assumed already corrected to 100 psig separator conditions, and also supplies the gas-gravity estimate for DAK; use laboratory PVT where this assumption is inadequate.

### 3.2 Dranchuk–Abou-Kassem Z

For reduced density ρr:

```text
Z = 1 + (A1 + A2/Tpr + A3/Tpr³ + A4/Tpr⁴ + A5/Tpr⁵)ρr
      + (A6 + A7/Tpr + A8/Tpr²)ρr²
      − A9(A7/Tpr + A8/Tpr²)ρr⁵
      + A10(1 + A11ρr²)ρr²/Tpr³ exp(−A11ρr²)
ρr Z = 0.27 Ppr/Tpr
A = [0.3265, −1.0700, −0.5339, 0.01569, −0.05165,
     0.5475, −0.7361, 0.1844, 0.1056, 0.6134, 0.7210]
```

The first positive gas-density sign change is bracketed with density increments 0.01 up to 8, then bisected for 70 iterations. Accepted range is deliberately restricted to `1.05 ≤ Tpr ≤ 3` and `0.2 ≤ Ppr ≤ 30`; a 10⁻¹² reduced-pressure boundary tolerance handles floating-point arithmetic. Near-critical phase ambiguity and two-phase mixtures are unsupported. The pressure solver respects the lower Ppr limit. Optional Zi calibration multiplies the DAK Z curve by entered Zi / DAK(pi). The UI calls this a calibrated model.

```text
Bg = 0.005035 Z (TF + 459.67)/p   [rb/scf]
```

The gas coefficient implies approximately 14.7 psia / 60 °F standard conditions. Changing the gas standard-state convention is outside this release; imported gas volumes must use a compatible standard basis.

### 3.3 Vasquez–Beggs black-oil properties

The published saturated Rs functional form is `Rs = C1 γgc p^C2 exp[C3 API/(TF+459.67)]`, with coefficients `(0.0362, 1.0937, 25.7240)` for API ≤ 30 and `(0.0178, 1.1870, 23.9310)` for API > 30. Because the user supplies Pb and Rsi, the lab explicitly **normalizes** this relation at Pb:

```text
Rs(p) = Rsi [min(p,Pb)/Pb]^C2
```

The normalization cancels C1, γgc and the exponential; it preserves the published pressure dependence while honoring entered Pb/Rsi. It is not a standalone VB bubble-point estimate. pi must be ≥ Pb. For initially saturated cases use pi = Pb; initially two-phase oils with pi < independently entered Pb require suitable table data.

```text
Bo,sat = 1 + a1 Rs + (TF−60)(API/γgc)(a2 + a3 Rs)
```

| Coefficient |  API ≤ 30 | API > 30 |
| ----------- | --------: | -------: |
| a1          |  4.677e−4 | 4.670e−4 |
| a2          |  1.751e−5 | 1.100e−5 |
| a3          | −1.811e−8 | 1.337e−9 |

Above Pb, Rs is constant and the published undersaturated compressibility is integrated analytically:

```text
A = 10⁻⁵ [5 Rsi + 17.2 TF − 1180 γgc + 12.61 API − 1433]
co(p) = A/p
Bo(p) = Bob (Pb/p)^A
```

This is continuous at Pb. Nonpositive A is rejected. Conservative implementation checks use 75–294 °F, 15.3–59.5 °API, γgc 0.57–1.351 and nonnegative Rsi. Applicability depends on representative black-oil chemistry and laboratory calibration, not just passing these bounds. Bw is a user-specified constant, clearly labelled as such, rather than an invented water-PVT correlation. Connate-water expansion is represented separately by cw.

### 3.4 User PVT table

Oil black-oil tables require Pressure, Bo, Rs and Bg. Oil Z is optional because it is absent from the oil balance. Above-Pb undersaturated tables require Pressure and Bo, m=0, and the explicit cancellation assumptions above; missing Rs/Bg/Z remain null. Bw is supplied or a positive constant explicitly approved by the user. Dry-gas tables still require Bg and Z. Optional properties must be consistently present or absent across the table.

Values are sorted by pressure; duplicate pressures, missing required cells, nonfinite values, nonpositive pressure/FVFs/Z and negative Rs are rejected. Each supplied property is piecewise-linearly interpolated; null properties remain null. Extrapolation is disabled by default. Explicit extrapolation uses the nearest two boundary rows and still rejects nonphysical properties. No thermodynamic correction is imposed on source data. PVT QC shows Pi/Pb, selected initial properties, source and units, missing values, initial interpolation/extrapolation and suspect Rs/Bg/Bo trends. Warnings identify data to investigate and do not certify thermodynamic consistency.

## 4. Aquifer

Only None and Pot are implemented through an explicit model dispatch. Both demos default to None. Pot is:

```text
We = Caq (pi − p)   [rb], Caq [rb/psi]
```

This is signed equilibrium storage, including backflow above pi; it is **not a transient aquifer-flow calculation**. Caq = 0 gives We = 0. Do not infer aquifer size, permeability or time response from Caq alone. Future transient models can extend the aquifer dispatch and scenario discriminant with new state/integration modules and their own tests; Fetkovich/VEH are not exposed as functional selectors.

## 5. Forward pressure solution

At each row `closure(p) = support(p) − F(p)` is solved without reading the measured pressure or Use flag. The unchanged bisection method is used inside detected brackets. A 100-interval scan covers both sides of pi, with pi, Pb and all table knots included. Exact zero endpoints are retained, invalid sampled properties break a bracket, and repeated roots are deduplicated. Bisection pressure tolerance is 10⁻¹⁰ psi, at most 100 iterations. A final volume-closure check requires `|R| ≤ max(10⁻⁴ rb, 10⁻⁸ max(|F|, |support|))`. The zero-depletion pi shortcut uses 10⁻⁸ rb.

- Correlation domain: lower max(14.7 psia, 0.2 Ppc); upper min(max(1.6pi, pi+1000 psi), 30 Ppc).
- Table without extrapolation: minimum and maximum table pressures; Bo-only lower bound also respects Pb.
- Explicit extrapolation: broad pressure domain with property-validity checks.
- No bracket, invalid properties, exhausted iterations or failed volume closure produces a missing prediction and warning.
- When multiple roots are detected, nearest pi is displayed with an ambiguity warning. Auto Match rejects that candidate. Selection is not proof of the physical branch.

Finite scanning cannot prove uniqueness: tangent roots and tightly spaced roots within one interval may be missed. Piecewise-linear PVT also introduces derivative discontinuities. Nonmonotone source tables, inconsistent fluid totals and extreme injection require engineering review. Predictions are independent solves per cumulative row, not a transient time-stepping flow solution.

## 6. Diagnostics and survey selection

- Havlena–Odeh: x = Et; y = F or F−We. Model reference = N Et. Fitted slope is least squares through the origin, `Σxy/Σx²`, active surveys only, omitting |Et| ≤ 10⁻¹⁰ rb/STB. A valid N interpretation requires correct expansion/PVT and negligible or explicitly removed influx.
- Gas-cap two-parameter fit: define unweighted `Eg0 = Boi(Bg/Bgi−1)` and `K = Boi(cf+Swi cw)(pi−p)/(1−Swi)`. Then `F−We = N(Eo+K) + Nm(Eg0+K)`. Plot `Y=(F−We)/(Eo+K)` versus `X=(Eg0+K)/(Eo+K)`; intercept N, slope Nm. In the zero-compressibility exercise this reduces to F/Eo versus Eg0/Eo. Do not put the already m-weighted stored Eg on this X-axis. Unweighted linear least squares, active nonzero-denominator observations, coefficient correlation and leave-one-out ranges are shown. Assumed fixed We must be justified.
- Campbell: x = F; y = F/Et or (F−We)/Et, with entered N reference. Plateau, rise and scatter are conditional consistency clues, not unique drive proofs.
- Gas p/Z: x = Gp; y = measured p/Z from selected PVT. Valid volumetric cases show entered-G reference plus an unconstrained intercept/slope regression. Optional extension reaches p/Z = 0. No extrapolated OGIP claim is shown for invalid volumetric assumptions.
- Cole: x = Gp; y = F/Et or (F−We)/Et; entered G reference. Et includes declared pore effects. |Et| ≤ 10⁻¹² rb/scf points are suppressed.
- Pressure residual = calculated − measured. RMSE and MAE use only active, solved surveys; active and solved counts both appear. Production and prediction retain every history row regardless of survey-use selection.
- All history-data points carry a row ID for inspection. PVT points carry their pressure. Model reference lines are theoretical and open model equations.

## 7. Drive indices and closure

At the explicitly selected measured or calculated pressure, signed contributions are NEo, NEg, NEfw and We. Each is divided by signed F. If |F| < 1 rb indices are undefined. Values are not clamped, made positive or renormalized; the sum represents support/F. “Closes” means `|support−F| ≤ max(1 rb, 0.001|F|)` for the educational display. Zero depletion has zero volumes and undefined indices. Drive analysis includes every measured survey (excluded rows are labelled); Use affects match/regression only.

## 8. Time integration, data QC and units

Reference Exercise imports accept pressure-indexed observations with empty dates and distinct observation labels; no dates are fabricated and rate/time integration is unavailable for these records. Cumulative Rp means Gp/Np, never instantaneous well-test GOR, and Gp = Np × Rp after per-column unit conversion. Printed decreasing derived Gp is preserved and flagged; forward simulation and fitting pause until resolved. Optional combined PVT follows the same approval rules as dedicated PVT import.

Dated histories are validated as real ISO dates (or normalized from M/D/YYYY); elapsed days use UTC dates. Interval-ending convention uses `ΔC_i = q_i(t_i−t_{i−1})` over `(t_{i−1},t_i]`; optional trapezoidal integration uses `(q_i+q_{i−1})/2 × Δt`. The first sample establishes t0 with zero volumes. Prehistory must be supplied as cumulatives. Cumulative inputs are retained exactly, never averaged. Duplicates, unsorted/invalid dates, decreasing/nonfinite/negative cumulatives, nonpositive survey pressures and pressures > 3pi are flagged. Missing pressure is allowed; missing mapped volume is rejected. Maximum 2,000 rows / 5 MB.

```text
1 MSTB = 10³ STB; 1 MMSTB = 10⁶ STB
1 Mscf = 10³ scf; 1 MMscf = 10⁶ scf
1 STB = 0.158987294928 sm³
1 scf = 0.028316846592 sm³
1 psi = 0.006894757293168 MPa
TC = (TF−32) × 5/9
co[MPa⁻¹] = co[psi⁻¹]/0.006894757293168
Rs[sm³/sm³] = Rs[scf/STB] × 0.028316846592/0.158987294928
Bg[rm³/sm³] = Bg[rb/scf] × 0.158987294928/0.028316846592
Caq[rm³/MPa] = Caq[rb/psi] × 0.158987294928/0.006894757293168
```

Liquid FVF Bo/Bw is dimensionless as a ratio of matching volume units; gas Bg uses different reservoir/surface bases and requires the explicit conversion above. The Equation Inspector and results CSV intentionally audit canonical field values; their unit labels state this even in METRIC display mode.

## 9. Independent synthetic known answers

West Ridge oil: pi=4200 psia, T=190 °F, N=85e6 STB, m=0.18, Pb=2800 psia, Rsi=650 scf/STB, API=35, γg=0.7, Swi=0.22, cf=cw=3e−6 psi⁻¹, Bw=1.03, no aquifer/injection.

For i=0…16 prescribe p(i)=4200−155i psia; Rp(i)=650+55i scf/STB; Wp=0.12Np. Compute the selected PVT/expansion, then obtain `Np = N Et / [Bo + (Rp−Rs)Bg + 0.12Bw]`, Gp=Rp Np. This uses an algebraic inversion rather than the pressure solver. Known initial/final pressures are exactly 4200/1720 psia. Forward recovery tolerance is 10⁻⁴ psi.

North Basin gas: G=180e9 scf, pi=4200 psia, T=190 °F, γg=0.7, cf=cw=0; aquifer None, no water/injection. Prescribe p(i)=4200−175i psia; Gp=G(1−Bgi/Bg). Final pressure=1400 psia; p/Z extrapolated OGIP=180 Bscf. Again history generation does not call the root solver.

Separate artificial algebra fixtures (`src/tests/fixtures.ts`) use pi=3000 psia, Boi=1.2, Rsi=600, Bgi=0.001, m=0.2, Swi=0.2, cf=cw=3e−6. At p=2000, Bo=1.3, Rs=400, Bg=0.002, Bw=1:

```text
Eo = 0.5; Eg = 0.24; Efw = 0.00648; Et = 0.74648 rb/STB
N = 10e6 STB => support = 7,464,800 rb
Np = 2e6 STB, Gp = 2e9 scf, Wp = 1e6 STB => F = 6e6 rb
closure = +1,464,800 rb (deliberately inconsistent; indices do not sum to 100%)
```

There are also exact ideal-gas pressure tests, pot-supported oil/gas tests, injection-above-pi tests and a DAK chart check (Ppr=Tpr=1.5 gives Z≈0.8593). Tests establish numerical behavior for these conditions; published-source arithmetic checks and their separate reconstruction limits are recorded in BENCHMARK_VALIDATION.md. These do not certify reserves or a complete field model.

## 10. References and provenance

1. Havlena, D. and Odeh, A.S. (1963). _The Material Balance as an Equation of a Straight Line_. SPE 559-PA. https://doi.org/10.2118/559-PA
2. Vasquez, M. and Beggs, H.D. (1980). _Correlations for Fluid Physical Property Prediction_. JPT 32(6), 968–970, SPE 6719-PA. https://doi.org/10.2118/6719-PA
3. Dranchuk, P.M. and Abou-Kassem, J.H. (1975). _Calculation of Z Factors for Natural Gases Using Equations of State_. JCPT 14(3). https://doi.org/10.2118/75-03-03
4. Sutton, R.P. (1985). _Compressibility Factors for High-Molecular-Weight Reservoir Gases_. SPE 14265-MS. https://doi.org/10.2118/14265-MS
5. Blasingame, T.A., Texas A&M, _PVT Appendix / course notes_: https://blasingame.engr.tamu.edu/z_zCourse_Archive/P613_24A/P613_Reference/%5B1988%5D_PVT_Appendix_%28Blasingame%29_%28pdf%29.pdf (published Sutton equations and units).
6. Montanuniversität Leoben, _Reservoir Fluids_, §5.2.3.2, equations 5.42–5.45 (VB co=A/p and integrated Bo): https://pure.unileoben.ac.at/portal/files/561575/Reservoir_Fluids.pdf
7. DAK coefficient/equation technical note hosted by INGEMMET: https://app.ingemmet.gob.pe/biblioteca/pdf/CLG12-73.pdf

The user-specified ResvEngine material-balance workflow was publicly reviewed for input organization, tank/diagnostic interactions, survey use and export ideas. The supplied Black-Oil-PVT-Generator `/pvt/` page was attempted but could not be retrieved by the web reader in this environment; no source was copied. Correlations were independently implemented from documented equations. All visual design and tank artwork are original vector/CSS elements; no third-party branding or proprietary simulator code/assets are used.

## 11. Bounded Auto Match

Oil supports N, N+m or N+Pot Caq. The objective is unweighted pressure RMSE over all active measured surveys. Every objective evaluation runs the same selected-source forward solver; any failed/ambiguous root rejects the entire candidate rather than dropping a survey. PVT, compressibilities, history, injection and all unselected parameters remain fixed. Dry gas stays manual. Bo-only data cannot fit m; Caq fitting requires Pot.

Bounds are finite and explicit (N>0; m,Caq≥0), normalized to [0,1]. N alone uses golden-section search with endpoint/current-value comparison. Two parameters use a deterministic 5×5 seed grid plus bounded Nelder–Mead (reflection 1, expansion 2, contraction/shrink 0.5), at most 180 iterations. Convergence is based on normalized parameter spread <10⁻⁶ and objective spread <10⁻⁵ psi (one-parameter interval <10⁻⁷). Bounds and seed grid limit the search; it is not a global-optimum guarantee. A finite valid starting model is required for the before comparison.

The candidate is reviewed before Apply: before/after parameters, RMSE/MAE, measured/calculated overlay, signed residuals, evaluations/convergence and warnings. Sensitivity uses finite differences (1% parameter magnitude or 0.1% bound width, whichever larger, clipped to bounds; one-sided differences at valid PVT boundaries, with up to eight step halvings if both sides initially fail). For two parameters, `−(Ja·Jb)/sqrt((Ja·Ja)(Jb·Jb))` approximates local coefficient correlation under equal independent pressure errors. |correlation|>0.98 or negligible sensitivity warns of weak identification. This is a local diagnostic, not a confidence interval. Boundary fits, rejected trials, nonconvergence or worse fit are disclosed. A small pressure error never proves unique N, m or aquifer strength.

## 12. Learning-case isolation

Engineering QC & Case Studies provides source-linked raw fixtures and rowwise audits. PASS applies only to the stated numerical checks. REFERENCE_DISCREPANCY, PARTIAL_VALIDATION, INSUFFICIENT_SOURCE_DATA and UNSUPPORTED_MODEL are distinct outcomes. Editing a fixture creates a labelled temporary copy. Opening one suspends automatic persistence of that scenario; the saved reservoir remains protected. Return restores the original model, and reload restores it from storage. Saving the temporary case downloads JSON for an explicit separate record.
