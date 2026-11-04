# Example data

`history-rates.csv` is an illustrative import-format example in FIELD units (STB/day, scf/day, psia). Its pressure values are illustrative, not a known-answer solution.

The oil/gas demo JSON files and FIELD history CSVs are generated independently from prescribed pressure using the documented equations. Their paired PVT CSVs sample the same correlations, including the exact demo survey pressures and bubble point; values between samples use linear interpolation when uploaded. Consequently a table-mode pressure prediction can differ slightly from the continuous correlation model between samples. Use each JSON with Open, or choose FIELD import units for the CSVs. The gas demo has zero compressibility and no water/injection, so it supports volumetric p/Z interpretation.

Regenerate these static files with `npm run examples`. This is a development-time export, not a backend. Do not identify any example as real field measurements.
