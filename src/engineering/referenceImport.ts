import type { HistoryRow, PVTConfig, Scenario } from "../types";
import type { RawTable } from "./history";
import {
  gasUnits,
  historyIssues,
  liquidUnits,
  normalizeDate,
  pressureUnits,
} from "./history";
import { validateTable } from "./pvt";
export interface ReferenceOptions {
  mapping: Record<string, string>;
  units: Record<string, string>;
  oilMode: "black-oil" | "undersaturated";
  constantBw: number | null;
  source: string;
}
export const referenceKeys = [
  "Date",
  "Observation",
  "Pressure",
  "Np",
  "Gp",
  "Rp",
  "Wp",
  "Wi",
  "Gi",
  "Bo",
  "Rs",
  "Bg",
  "Bw",
  "Z",
  "Use",
];
export const referenceUnitOptions = (key: string) =>
  ["Np", "Wp", "Wi"].includes(key)
    ? Object.keys(liquidUnits)
    : ["Gp", "Gi"].includes(key)
      ? Object.keys(gasUnits)
      : key === "Pressure"
        ? Object.keys(pressureUnits)
        : ["Rp", "Rs"].includes(key)
          ? ["scf/STB", "sm³/sm³"]
          : key === "Bg"
            ? ["rb/scf", "rm³/sm³"]
            : ["Bo", "Bw"].includes(key)
              ? ["rb/STB", "rm³/sm³"]
              : ["dimensionless"];
export function referenceFactor(key: string, u: string): number {
  if (!referenceUnitOptions(key).includes(u))
    throw new Error(`Invalid unit for ${key}: ${u}.`);
  if (["Np", "Wp", "Wi"].includes(key)) return liquidUnits[u];
  if (["Gp", "Gi"].includes(key)) return gasUnits[u];
  if (key === "Pressure") return pressureUnits[u];
  if (["Rp", "Rs"].includes(key))
    return u === "sm³/sm³" ? 0.158987294928 / 0.028316846592 : 1;
  if (key === "Bg")
    return u === "rm³/sm³" ? 0.028316846592 / 0.158987294928 : 1;
  return 1;
}
export function importReference(
  table: RawTable,
  s: Scenario,
  o: ReferenceOptions,
): { history: HistoryRow[]; pvt: PVTConfig; issues: string[] } {
  const index = (key: string) => table.headers.indexOf(o.mapping[key]),
    supplied = (key: string) => index(key) >= 0;
  if (!supplied("Pressure") || !supplied(s.model === "oil" ? "Np" : "Gp"))
    throw new Error(
      "Map pressure and the model’s cumulative hydrocarbon volume.",
    );
  const used = Object.values(o.mapping).filter(Boolean);
  if (new Set(used).size !== used.length)
    throw new Error("Each source column may be mapped only once.");
  const pvtSupplied = supplied("Bo");
  if (
    pvtSupplied &&
    o.oilMode === "black-oil" &&
    s.model === "oil" &&
    (!supplied("Rs") || !supplied("Bg"))
  )
    throw new Error("Black-oil reference PVT requires Bo, Rs and Bg.");
  if (
    pvtSupplied &&
    !supplied("Bw") &&
    !(o.constantBw !== null && o.constantBw > 0)
  )
    throw new Error("Explicitly approve constant Bw or map the supplied Bw.");
  const pvtRows: PVTConfig["table"] = [];
  const history = table.rows.map((r, i): HistoryRow => {
    const text = (key: string) => (supplied(key) ? r[index(key)].trim() : "");
    const number = (key: string, missing = 0) => {
      const raw = text(key);
      if (!supplied(key)) return missing;
      if (!raw || !Number.isFinite(Number(raw)))
        throw new Error(`Reference row ${i + 1}: ${key} missing or invalid.`);
      const factor = referenceFactor(
        key,
        o.units[key] ?? referenceUnitOptions(key)[0],
      );
      if (!Number.isFinite(factor)) throw new Error(`Invalid unit for ${key}.`);
      return Number(raw) * factor;
    };
    const np = number("Np"),
      p = number("Pressure"),
      rp = text("Rp") ? number("Rp") : null;
    if (supplied("Rp") && rp === null && np !== 0)
      throw new Error(`Reference row ${i + 1}: cumulative Rp is missing.`);
    const derived = rp === null ? 0 : np * rp,
      gp = supplied("Gp") ? number("Gp") : derived;
    if (
      supplied("Gp") &&
      rp !== null &&
      Math.abs(gp - derived) > Math.max(1, 0.0001 * Math.abs(gp))
    )
      throw new Error(
        `Reference row ${i + 1}: supplied Gp conflicts with Np × cumulative Rp.`,
      );
    if (pvtSupplied)
      pvtRows.push({
        pressure: p,
        bo: number("Bo"),
        rs: supplied("Rs") ? number("Rs") : null,
        bg: supplied("Bg") ? number("Bg") : null,
        bw: supplied("Bw") ? number("Bw") : o.constantBw!,
        z: supplied("Z") ? number("Z") : null,
      });
    return {
      id: `reference-${i}`,
      date: supplied("Date") ? normalizeDate(text("Date")) : "",
      ...(supplied("Date")
        ? {}
        : { observation: text("Observation") || `Observation ${i + 1}` }),
      np,
      gp,
      wp: number("Wp"),
      wi: number("Wi"),
      gi: number("Gi"),
      pressure: p,
      use: !["0", "false", "no"].includes(text("Use").toLowerCase()),
    };
  });
  const issues = historyIssues(history, s.params.pi);
  // Preserve printed values including questionable cumulative trends; never repair them by averaging.
  const invalid = issues.filter((i) => !i.includes("cumulative decreases"));
  if (invalid.length) throw new Error(invalid.slice(0, 4).join(" "));
  let pvt = s.pvt;
  if (pvtSupplied) {
    const unique = [...new Map(pvtRows.map((r) => [r.pressure, r])).values()];
    if (unique.length !== pvtRows.length)
      throw new Error(
        "Repeated PVT pressures require a separate validated PVT table.",
      );
    pvt = {
      mode: "table",
      table: validateTable(unique),
      extrapolate: false,
      oilMode: o.oilMode,
      source: o.source,
      suppliedColumns: ["Pressure", "Bo", "Rs", "Bg", "Bw", "Z"].filter(
        supplied,
      ),
      ...(supplied("Bw") ? {} : { constantBw: o.constantBw! }),
    };
  }
  return { history, pvt, issues };
}
