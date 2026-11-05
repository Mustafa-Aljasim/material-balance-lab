import type { HistoryRow, Parameters, Scenario, SolvedRow } from "../types";
import { fromField } from "./units";
import { historyIssues, serializeCSV } from "./history";
import { validateTable } from "./pvt";
export const PROJECT_KEY = "petroleum-academia.material-balance.v1";
export const TABS = [
  "Dashboard",
  "Production & Pressure History",
  "PVT",
  "Material Balance",
  "History Match",
  "Drive Mechanisms",
  "Methodology & Equations",
  "Engineering QC & Case Studies",
];
export function download(
  content: string,
  filename: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${mime};charset=utf-8` }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function parseProject(text: string): Scenario {
  if (text.length > 5e6) throw new Error("Project file limit is 5 MB.");
  const v: unknown = JSON.parse(text);
  if (
    !object(v) ||
    v.version !== 1 ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 200 ||
    !["oil", "gas"].includes(String(v.model)) ||
    !["FIELD", "METRIC"].includes(String(v.units)) ||
    !["none", "pot"].includes(String(v.aquifer))
  )
    throw new Error(
      "Invalid project identity, model, units or version. Expected Material Balance Lab schema v1.",
    );
  if (!["synthetic", "imported", "edited"].includes(String(v.source)))
    throw new Error("Invalid history provenance.");
  const a = v.params;
  if (!object(a)) throw new Error("Project parameters are missing.");
  const keys = [
    "pi",
    "temperature",
    "N",
    "G",
    "m",
    "swi",
    "cf",
    "cw",
    "bw",
    "pb",
    "rsi",
    "api",
    "gasGravity",
    "caq",
    "bwi",
  ] as const;
  for (const key of keys)
    if (typeof a[key] !== "number" || !Number.isFinite(a[key]))
      throw new Error(`Invalid numeric parameter ${key}.`);
  for (const key of ["zi", "bgi"])
    if (
      a[key] !== null &&
      (typeof a[key] !== "number" || !Number.isFinite(a[key]))
    )
      throw new Error(`Invalid ${key}.`);
  if (typeof a.injection !== "boolean")
    throw new Error("Injection flag must be boolean.");
  const params = a as unknown as Parameters;
  if (!(
    params.pi > 14.7 &&
    params.temperature > -459.67 &&
    params.N > 0 &&
    params.G > 0 &&
    params.m >= 0 &&
    params.swi >= 0 &&
    params.swi < 1 &&
    params.cf >= 0 &&
    params.cw >= 0 &&
    params.caq >= 0 &&
    params.bw > 0 &&
    params.bwi > 0 &&
    params.pb > 0 &&
    params.rsi >= 0 &&
    (params.zi === null || params.zi > 0) &&
    (params.bgi === null || params.bgi > 0)
  ))
    throw new Error("Project contains nonphysical tank parameters.");
  if (
    !object(v.pvt) ||
    !["correlation", "table"].includes(String(v.pvt.mode)) ||
    !Array.isArray(v.pvt.table) ||
    typeof v.pvt.extrapolate !== "boolean"
  )
    throw new Error("Invalid PVT configuration.");
  if (v.pvt.table.length) {
    if (
      v.pvt.table.length > 2000 ||
      !v.pvt.table.every(
        (r) =>
          object(r) &&
          ["pressure", "bo", "bw"].every((k) => typeof r[k] === "number") &&
          ["rs", "bg", "z"].every(
            (k) => typeof r[k] === "number" || r[k] === null,
          ),
      )
    )
      throw new Error("Invalid PVT table.");
    v.pvt.table = validateTable(v.pvt.table as Scenario["pvt"]["table"]);
  } else if (v.pvt.mode === "table")
    throw new Error("Table PVT mode has no data.");
  if (
    v.pvt.oilMode !== undefined &&
    !["black-oil", "undersaturated"].includes(String(v.pvt.oilMode))
  )
    throw new Error("Invalid oil PVT formulation.");
  if (
    (v.pvt.source !== undefined && typeof v.pvt.source !== "string") ||
    (v.pvt.constantBw !== undefined &&
      (typeof v.pvt.constantBw !== "number" ||
        !Number.isFinite(v.pvt.constantBw) ||
        v.pvt.constantBw <= 0)) ||
    (v.pvt.suppliedColumns !== undefined &&
      (!Array.isArray(v.pvt.suppliedColumns) ||
        !v.pvt.suppliedColumns.every((x) => typeof x === "string")))
  )
    throw new Error("Invalid PVT source metadata or constant Bw.");
  if (
    v.assumptions !== undefined &&
    (!Array.isArray(v.assumptions) ||
      !v.assumptions.every((x) => typeof x === "string"))
  )
    throw new Error("Invalid assumptions.");
  if (
    !Array.isArray(v.history) ||
    v.history.length > 2000 ||
    !v.history.every(
      (r) =>
        object(r) &&
        typeof r.id === "string" &&
        typeof r.date === "string" &&
        (r.observation === undefined || typeof r.observation === "string") &&
        ["np", "gp", "wp", "wi", "gi"].every((k) => typeof r[k] === "number") &&
        (r.pressure === null || typeof r.pressure === "number") &&
        typeof r.use === "boolean",
    )
  )
    throw new Error("Invalid project history.");
  const issues = historyIssues(v.history as HistoryRow[], params.pi);
  if (issues.length) throw new Error(issues.slice(0, 4).join(" "));
  if (
    !object(v.display) ||
    !TABS.includes(String(v.display.tab)) ||
    typeof v.display.corrected !== "boolean" ||
    typeof v.display.extrapolatePz !== "boolean"
  )
    throw new Error("Invalid display configuration.");
  return v as unknown as Scenario;
}
export function historyExport(s: Scenario) {
  return s.history.map((r) => ({
    Date: r.date,
    ...(r.observation ? { Observation: r.observation } : {}),
    Np: fromField(r.np, "liquid", s.units),
    Gp: fromField(r.gp, "gas", s.units),
    Wp: fromField(r.wp, "liquid", s.units),
    Wi: fromField(r.wi, "liquid", s.units),
    Gi: fromField(r.gi, "gas", s.units),
    Pressure:
      r.pressure === null ? "" : fromField(r.pressure, "pressure", s.units),
    Use: r.use,
    LiquidUnit: s.units === "FIELD" ? "STB" : "sm³",
    GasUnit: s.units === "FIELD" ? "scf" : "sm³",
    PressureUnit: s.units === "FIELD" ? "psia" : "MPa(a)",
  }));
}
export function resultsCSV(s: Scenario, rows: SolvedRow[]): string {
  // Explicit field units preserve dimensional clarity for every exported intermediate.
  return serializeCSV(
    rows.map((r) => {
      const b = r.measured;
      return {
        Date: r.row.date,
        Observation: r.row.observation,
        Use: r.row.use,
        Np_STB: r.row.np,
        Gp_scf: r.row.gp,
        Wp_STB: r.row.wp,
        Wi_STB: r.row.wi,
        Gi_scf: r.row.gi,
        Measured_psia: r.row.pressure,
        Calculated_psia: r.predicted,
        Residual_calc_minus_meas_psia: r.residual,
        F_rb: b?.F,
        Eo: b?.Eo,
        Eg: b?.Eg,
        Efw: b?.Efw,
        Et: b?.Et,
        ExpansionUnit: s.model === "oil" ? "rb/STB" : "rb/scf",
        We_rb: b?.We,
        ModelSupport_rb: b?.support,
        Closure_support_minus_F_rb: b?.closure,
        Bo_rb_STB: b?.pvt.bo,
        Rs_scf_STB: b?.pvt.rs,
        Bg_rb_scf: b?.pvt.bg,
        Bw_rb_STB: b?.pvt.bw,
        Z: b?.pvt.z,
        OilIndex: b?.indices?.[0],
        GasCapIndex: b?.indices?.[1],
        RockWaterIndex: b?.indices?.[2],
        InfluxIndex: b?.indices?.[3],
        Warning: r.error ?? "",
      };
    }),
  );
}
