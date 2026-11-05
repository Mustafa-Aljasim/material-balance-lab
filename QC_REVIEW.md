# Internal engineering QC review (before upgrade)

Verified existing mathematics: oil net withdrawal has correct production/injection signs; Eo is correct; stored Eg already includes m once; Efw correctly contains (1+m). Dry-gas volume balance and volumetric p/Z fixtures pass. Survey exclusion preserves production; selected PVT is shared by diagnostics and forward solving. These are retained.

Confirmed robustness defect: direct PVT-table validation can miss absent keys because Object.values never visits a missing field, and relational checks do not reject undefined/NaN. This must be fixed while adding explicitly nullable, unused oil properties.

Numerical limitations: root scanning assumes closure orientation and stops at the first directional bracket; it does not report alternate roots. Pressure-width convergence has no reported volume-closure acceptance criterion. Rounded PVT makes intercept extrapolation ill-conditioned. Pot is equilibrium storage, not transient flow. Missing source data cannot establish a unique calibrated model.

Missing capabilities (not mathematical errors): Bo-only oil PVT; optional oil Z; cumulative Rp conversion; per-column units; observations without dates; two-parameter gas-cap linearization; bounded matching and sensitivity; independent published fixtures; temporary learning cases that do not overwrite persisted user cases.

Workflow issues: six mandatory PVT columns encourage invented unused properties; dates are mandatory even for textbook observations; no explicit initial-state/trend QC screen exists. Current LocalStorage automatically saves every edited scenario, so case studies need an isolated session with explicit adoption.

Source review: Virginia Hills raw data gives 282.829065946 MMSTB by through-origin regression, inconsistent with the reported 257. Dake fixed m=.5 gives 114.560732378 MMSTB; joint F/Eo regression gives N=108.702727372 MMSTB, m=.541202003 and requires an identifiability warning. Iraqi Table 2 yields decreasing derived Gp for the published Rp interpretation and large PVT changes over a narrow pressure range. SABA includes single-tank and multi-tank analyses; the reported small-pot result cannot be reconstructed from the printed aggregate inputs and graphical histories alone.
