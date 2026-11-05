# Validation record

## Staged checks

- Stage 1: five foundation tests passed and Vite/TypeScript production build passed. Independent oil/gas synthetic fixtures recover prescribed pressure, including initial pressure at zero depletion. Numerical limitations: uniform equilibrated tank, constant temperature and representative PVT.
- Stage 2: all seven workspaces implemented, 39 numerical/data-workflow tests passed and the production build passed. History mapping/editing, table/correlation PVT, Pot storage, diagnostics, signed drives and worked equation inspection were exercised. At that stage Pot was equilibrium storage and matching was manual; the later QC upgrade below adds bounded oil matching without transient aquifers.
- Stage 3: final 39-test suite passed under Vitest 5.1.0; strict TypeScript and Vite production build passed. Patched KaTeX/Vitest dependencies were installed; npm reported zero known vulnerabilities. GitHub Pages configuration and instructions are included; remote deployment status is recorded separately in the repository's Actions and Pages environment.

## Browser checks performed

The live local app was tested through its visible controls in the in-app browser:

- Oil dashboard: entered 85 MMSTB, 17/17 solved surveys, final predicted pressure 1,720 psia and negligible synthetic residuals.
- Gas p/Z regression: extrapolated OGIP 180 Bscf, with Cole reference and optional volumetric extrapolation.
- Pot selection disables the gas straight-line p/Z interpretation and extrapolation control while retaining general volume-balance prediction.
- FIELD/METRIC switching updates pressure/volume units; internal canonical data is retained.
- A pasted three-row metric gas-rate history integrates over 10-day and 30-day intervals to 0.07 billion standard m³. Excluding the middle survey preserves that cumulative total.
- Immediate page reload after import/exclusion retains the case and selection. A debounce/reload loss found during QA was corrected by flushing on page exit.
- A history-match table entry and a Plotly survey marker both open the Equation Inspector with real substituted PVT/withdrawal/expansion values and closure.
- Saved demo JSON opens correctly. Generated oil PVT CSV switches the selected source to the uploaded table; all demo timesteps still solve.
- Save produces a complete JSON download; the chart PNG button produces an actual PNG file.
- Phone viewport 390 × 844: dashboard/control navigation stays usable with no document-wide horizontal overflow; workspace tabs scroll independently. Temporary viewport overrides were reset.

## Engineering QC upgrade — 5 November 2026

- **74 tests pass**: all 39 prior tests retained, plus 35 published-term, import, regression, root-domain and matching checks. `npm run typecheck` and `npm run build` pass. Test answers include separate static high-precision decimal calculations, exact analytic balances and the reproduced raw tables. See [BENCHMARK_VALIDATION.md](BENCHMARK_VALIDATION.md) for source-specific results and limits.
- Virginia Hills raw-history F/Eo/Efw/Et checkpoints and through-origin N=282.829065946 MMSTB agree with independent arithmetic. The printed 257 MMSTB remains REFERENCE_DISCREPANCY; the brief's rounded-column ≈283.82 result is not independently certified without its exact transcription.
- Dake all six history F/Eo/Eg⁰/support checkpoints pass. Fixed m=.5 gives N=114.560732378 MMSTB. General gas-cap linearization includes the m-dependent pore term. Joint regression reports strong correlation, leave-one-out and one-cell printed-digit sensitivity, including nonphysical stress results.
- Iraqi Tertiary tables were visually checked against the source PDF. Year 2000 F=23.015671927 MMrb passes; rowwise source arithmetic remains distinct from model reconstruction. Twelve decreasing derived-Gp intervals, questionable initial/history PVT transitions and missing calibration assumptions keep this case PARTIAL_VALIDATION and block forward fitting.
- SABA retains INSUFFICIENT_SOURCE_DATA and separate UNSUPPORTED_MODEL notices for transient/multiple tanks. An explicitly synthetic independent analytic Pot-versus-None test verifies a 476.190476 psi support gain at Caq=500 rb/psi; no field history or source RMSE match is invented.
- Additional tests cover optional/null oil PVT, explicit Bw approval, missing-key/nonfinite PVT rejection, independent column units, Rp conflicts, undated reference/JSON round trips, source metadata rejection, alternate roots, invalid-domain gaps, volume residuals, above/below-Pb recovery, fitting N/N+m/N+Caq, input immutability, one-sided sensitivity at table limits and the unchanged 1400 psia final gas prediction.

### Browser checks for the upgrade

The production build was served locally with Vite preview at `/material-balance-lab/` and exercised through visible browser controls:

- All four case selectors and status explanations render. Individual equations, source assumptions, PVT QC and numerical comparisons are accessible.
- An invalid edited benchmark CSV displays an error while keeping the editor/Restore control available and disabling Open; Restore recovers the published fixture.
- Dake's rounding panel shows 42 resolved stress trials and one nonphysical joint fit. Bounded N+m matching produces a reviewed candidate with lower pressure RMSE, followed by explicit Apply; the main N input changes only after Apply.
- Reference Exercise paste/mapping detects Np in MMSTB and cumulative Rp, refuses absent Bw until approval, imports Gp=3.45975 Bscf at the first Dake production observation and retains observation labels without dates/rate curves.
- Iraqi temporary baseline requires acknowledgement, pauses calculations on decreasing cumulative Gp and shows the initial PVT/source-continuity warnings.
- SABA's labelled independent support experiment displays None=1666.666667 and Pot=2142.857143 psia with the correct support gain and We.
- Opening/working in temporary cases, returning, and reloading preserve the original West Ridge reservoir; no learning case replaces its saved model. Missing Bo-only Rs/Bg/Z remain explicitly absent in PVT QC.
- Final Dake N+m browser trial reduced RMSE from 4.59398 to 4.42645 psia. Sensitivities were finite using explicitly disclosed one-sided differences at the table boundary; local correlation −0.999873 correctly warns that inventory and cap support are poorly separated.
- Phone viewport 390×844: a case-workspace grid overflow was found and fixed. Recheck reported document scroll width equal to viewport width (375 CSS px with scrollbar), with wrapped source links and scrollable tables. The viewport override was reset.
- No browser console errors were captured during those checks.

## Remaining verification boundaries

Published-source arithmetic is verified only to the scope above; no complete field calibration or independent reserves certification is claimed. Transient aquifers, multi-tank flow, volatile-oil/condensate and sour-gas calculations remain unsupported. Bounded oil Auto Match is conditional on fixed inputs and valid roots; convergence does not prove uniqueness or a global optimum. PVT-table interpolation is linear and can be inconsistent between coarse measurements; warnings/interpretation guards are part of the product. Extreme injection and nonmonotone tables may have no unique physical root. The bundled Plotly chunk produces Vite's advisory size warning; this is not a build failure.

GitHub Pages uses the existing standalone repository and `/material-balance-lab/` base. Each upgrade's deployment status is verified after its commit is pushed; workflow history is the authoritative per-commit deployment record. The workflow gates deployment on successful tests and build. Engineering references, equations, applicable ranges and fixture values are recorded in `ENGINEERING_METHODS.md`.
