# Petroleum Academia | Material Balance Lab

A standalone browser application for learning and manually interpreting oil and dry-gas material balance. React, TypeScript, Vite, Plotly and KaTeX. All calculations, file parsing and persistence run on the user's device. No backend, calculation service, account, analytics or database is required.

[Open the hosted lab](https://mustafa-aljasim.github.io/material-balance-lab/) · [Source repository](https://github.com/Mustafa-Aljasim/material-balance-lab) · [Deployment workflow](https://github.com/Mustafa-Aljasim/material-balance-lab/actions/workflows/deploy.yml)

## Run locally

Install Node.js 22.12+ (Node 22 LTS is used in CI), then from this project folder:

```sh
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://127.0.0.1:5175/material-balance-lab/`. The dev server is bound to loopback; stop it with Ctrl+C. To choose another port, edit `server.port` in `vite.config.ts` or run `node node_modules/vite/bin/vite.js --port 5176`.

```sh
npm test              # Vitest numerical and data-workflow checks
npm run test:watch    # interactive Vitest
npm run typecheck    # strict TypeScript checks
npm run build        # TypeScript checks, then static build in dist/
npm run preview      # inspect the production build; open the printed /material-balance-lab/ URL
```

Plotly is deliberately bundled locally; its dedicated chunk is about 1.1 MB before gzip. Vite may report an advisory chunk-size warning. The entire build, including math fonts, is self-contained and does not fetch calculation code or assets from a CDN. An internet connection is required to install npm packages and publish, not to calculate after the app has loaded. This release does not include a service worker/offline installer.

## Use the lab

1. Start with **Oil** (West Ridge, 85 MMSTB) or **Dry gas** (North Basin, 180 Bscf). Histories are synthetic, with independent known-answer calculations. **Aquifer None is the default.** Switching model preserves each model's current case in memory; automatic persistence stores the currently selected case.
2. Edit tank parameters; press Enter or leave a numeric field to commit it. Sliders update immediately. Direct numerical entry can exceed slider extents. FIELD and METRIC change display units without changing canonical field-unit calculations.
3. In **Production & Pressure**, edit cumulative history, add/delete rows, upload CSV or paste Excel cells. Follow the column-mapping and unit-selection step. Rates are integrated with actual elapsed UTC calendar days; the first date has zero cumulatives. Select interval-ending rates or optional trapezoidal integration explicitly. Supply pre-existing production as cumulatives.
4. A survey's **Use** checkbox only controls the pressure objective and diagnostic regressions. Its cumulative production remains in the pressure calculation. Missing pressure cells are allowed; missing mapped volume cells, invalid/duplicate dates and decreasing cumulatives are flagged.
5. In **PVT**, use the documented calibrated Vasquez–Beggs/Sutton–DAK correlations or import oil Bo/Rs/Bg tables (Z optional), or above-Pb Bo-only tables with explicit constant-Rs cancellation and no gas cap. Supply Bw or explicitly approve a constant. Dry-gas Bg/Z requirements are preserved. Review the source and initial-state PVT QC panel. Choose CSV units before upload. Initial pressure must be covered. Properties are interpolated piecewise-linearly. Extrapolation requires explicit opt-in and remains subject to physical-property checks.
6. View Havlena–Odeh/Campbell for oil, p/Z/Cole for gas, and pressure/time, pressure/production and residual charts. Adjust N/G, m or Pot storage for manual matching. Oil **Auto Match** optionally fits bounded N, N+m or N+Pot Caq using the same forward solver. Review the candidate, convergence, sensitivity and correlation before explicitly applying it.
7. Zoom, pan, control legends, reset axes and download PNGs. Click a history point for its **Equation Inspector**; choose audit at measured or calculated pressure. A clicked PVT sample shows its actual PVT values. Model-reference lines open the governing equations rather than pretending to represent a measured survey.
8. Open **Engineering QC & Case Studies** for Virginia Hills, Dake, Iraqi Tertiary and SABA. Source-linked raw tables, individual-term audits, regression sensitivity and discrepancy explanations identify exactly what is reproducible. Cases open as temporary scenarios and protect the saved reservoir; Return or reload restores it.
9. Study signed oil-drive indices and closure in **Drive Mechanisms**. Ratios are never forced to 100%. The methodology tab explains definitions, assumptions and ambiguous graph interpretations.

### Import conventions

Accepted headers may be mapped from arbitrary names. Built-in examples are in `public/examples/`.

```csv
Date,Np,Gp,Wp,Wi,Gi,Pressure,Use
2020-01-01,0,0,0,0,0,4200,true
2020-04-01,100000,65000000,12000,0,0,4100,true
```

```csv
Date,qo,qg,qw,qi,qgi,Pressure
2020-01-01,0,0,0,0,0,4200
2020-04-01,1200,780000,150,0,0,4100
```

In the dated cumulative/rate modes, required: Date and Np/qo for oil, Date and Gp/qg for gas. Unmapped volumes are explicitly zero. Pressure and Use are optional; Use defaults to true. CSV or TSV may contain at most 2,000 history/PVT rows and 5 MB. Dates accept ISO `YYYY-MM-DD` or US `M/D/YYYY`; date-only values are UTC calendar days. Volume magnitudes are chosen independently for liquids/gas; rates use those volumes per day. Pressure must be absolute (psia, kPa(a), MPa(a)); gauge pressures must be converted first. Injection gas Gi/qgi extends the requested formats.

### Reference Exercise import

Choose **Reference Exercise** in history import to map each column independently: pressure, cumulative Np/Gp/Wp/Wi/Gi, optional cumulative Rp, observation/date, and optional Bo/Rs/Bg/Bw/Z. Choose STB/MSTB/MMSTB and scf/Mscf/MMscf per column. Cumulative Rp derives Gp=Np×Rp; conflicts with supplied Gp are rejected. An undated textbook table retains row labels and has no fabricated dates or rate plots. Missing optional production streams are disclosed as zero; in Bo-only mode the associated gas cancellation assumption applies. Printed decreasing cumulatives are preserved with QC errors that block forward prediction and fitting. PVT columns use the same provider as all plots and pressure calculations. Original source units are preserved in the downloadable benchmark CSVs under `public/benchmarks/`.

### Save and export

- **Save** downloads the complete schema-v1 JSON scenario: canonical inputs, PVT source/table, cumulative history, Use flags, provenance, units and display configuration.
- **Open** validates a JSON file before replacing the current case. Invalid files leave the case intact.
- Automatic LocalStorage saves use a 500 ms debounce and flush on page exit/reload. Invalid edits preserve the previous valid saved case. Storage denial/quota errors are reported. Storage belongs to the browser origin, is not cross-device storage, and can be cleared by the browser. Keep JSON backups.
- **Export results** downloads CSV in explicitly labelled canonical field units, including measured and predicted pressure, signed residuals, balance/PVT terms, drive indices and warning messages. Blank predictions indicate a failed root, not a calculated zero.
- History CSV and PVT CSV use current display units. Reimport with the same units. Exports include unit labels; CSV parsing never evaluates formulas.
- PNG exports are created by Plotly in the browser.

The gas initial Bg input calibrates Zi using `Bg = 0.005035 Z (TF+459.67)/pi`; it does not introduce an independent, inconsistent gas volume factor. PVT-table mode supplies its own initial Bg/Z values. Reusable synthetic JSON, cumulative-history CSV and PVT-table CSV files are in `public/examples/`; regenerate them with `npm run examples`.

## Engineering scope and validation

See [BENCHMARK_VALIDATION.md](BENCHMARK_VALIDATION.md) for all four published-source results, discrepancies and incomplete reconstructions, and [ENGINEERING_METHODS.md](ENGINEERING_METHODS.md) for equations, coefficient sets, references, known-answer fixtures and limitations. Tests cover oil identities, p/Z linearity, independent pressure recovery, aquifer/injection signs, integration, units, interpolation, survey selection, failed roots, signed drives and project/import integrity.

Passing tests establishes agreement with these numerical fixtures, not independent validation for a particular reservoir. Uniform equilibrated tank pressure, constant temperature/composition and representative PVT are required. The Pot aquifer is an equilibrium compressibility/storage approximation, not a transient flow model. Gas condensates, sour gases, volatile oils and spatial/multitank flow are outside scope. Coarse/noisy PVT can make the balance nonmonotone; root uniqueness is not guaranteed. Failed calculations show warnings and gaps. Transient aquifers and multi-tank communication are unsupported. Auto Match is a deterministic bounded search, not a guarantee of a global or unique solution.

## GitHub Pages deployment

This repository deploys `main` to [the hosted lab](https://mustafa-aljasim.github.io/material-balance-lab/) through the included Actions workflow. Each push runs locked dependency installation, tests and the production build before Pages deployment. Check the [workflow runs](https://github.com/Mustafa-Aljasim/material-balance-lab/actions/workflows/deploy.yml) for the status of a particular commit. The tracked base remains `/material-balance-lab/`.

### Deploy a separate copy

Create an **empty** GitHub repository named `material-balance-lab` under your account, without an initial README. Run these commands **inside this new project folder**, not its parent:

```sh
git init -b main
git add .
git commit -m "Create browser-based Material Balance Lab"
git remote add origin https://github.com/YOUR_USERNAME/material-balance-lab.git
git push -u origin main
```

In GitHub, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included `.github/workflows/deploy.yml` installs locked dependencies, runs tests, performs TypeScript checks/build, uploads `dist`, and deploys it. A test or build failure stops deployment. Pull requests run checks without deployment; main pushes and manual workflow runs deploy. Pages must be enabled and the repository/account must support Pages hosting. No secrets or calculation API credentials are needed.

The expected URL after a successful workflow is:

`https://YOUR_USERNAME.github.io/material-balance-lab/`

This folder is prepared for that standalone repository; no GitHub repository or public deployment is created automatically by the local build.

Workflow structure follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Action major versions were checked against their official repositories during implementation.

### Renamed repository or custom domain

The tracked Vite base is `/material-balance-lab/`. If the repository is renamed, set `base: '/NEW_REPOSITORY_NAME/'` in `vite.config.ts`. For a custom domain serving at its root, use `base: '/'`, configure the domain in GitHub Pages and DNS, and add the domain to `public/CNAME` when appropriate. The favicon path in `index.html` also uses the base; update it alongside the configuration. There is no client-side pathname routing and no server-fallback requirement.

## Code map

- `src/engineering/`: pure TypeScript calculation, integration, conversion and project-data modules; no UI imports. Browser download handling is isolated in `project.ts`.
- `src/data/demo.ts`: independent algebraic generation of synthetic history.
- `src/tests/fixtures.ts`: analytic numerical fixtures, separate from React.
- `src/charts/`: shared interactive Plotly rendering and inspection events.
- `src/components/`: reservoir controls, import mapping, math and equation audit.
- `src/pages/`: the analysis/teaching workspaces, including Engineering QC & Case Studies.
- `.github/workflows/deploy.yml`: gated static GitHub Pages deployment.

Functional references were studied for workflows only; branding, UI, synthetic cases and implementation are independently authored. No third-party simulator source or visual assets are incorporated.
