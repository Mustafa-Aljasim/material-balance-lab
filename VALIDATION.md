# Validation record

## Staged checks

- Stage 1: five foundation tests passed and Vite/TypeScript production build passed. Independent oil/gas synthetic fixtures recover prescribed pressure, including initial pressure at zero depletion. Numerical limitations: uniform equilibrated tank, constant temperature and representative PVT.
- Stage 2: all seven workspaces implemented, 39 numerical/data-workflow tests passed and the production build passed. History mapping/editing, table/correlation PVT, Pot storage, diagnostics, signed drives and worked equation inspection were exercised. Pot remains equilibrium storage; no transient aquifer model or automatic optimizer is exposed.
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

## Remaining verification boundaries

No real-field validation or independent reserves certification has been performed. No transient aquifer/flow model, volatile-oil/condensate/sour-gas calculation or optimizer is claimed. PVT-table interpolation is linear and can be inconsistent between coarse measurements; warnings/interpretation guards are part of the product. Extreme injection and nonmonotone tables may have no unique physical root. The bundled Plotly chunk produces Vite's advisory size warning; this is not a build failure.

GitHub Pages Actions and the final published URL must be verified after pushing this folder as the standalone `material-balance-lab` repository and enabling Pages. The workflow gates deployment on successful tests and build. Engineering references, equations, applicable ranges and fixture values are recorded in `ENGINEERING_METHODS.md`.
