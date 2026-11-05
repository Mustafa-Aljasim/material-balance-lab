import Papa from "papaparse";
import type { HistoryRow } from "../types";
export interface RawTable {
  headers: string[];
  rows: string[][];
}
export type Mapping = Record<string, string>;
export interface ImportOptions {
  format: "cumulative" | "rates";
  mapping: Mapping;
  liquidUnit: string;
  gasUnit: string;
  pressureUnit: string;
  integration: "interval-end" | "trapezoidal";
  model: "oil" | "gas";
}
export const liquidUnits: Record<string, number> = {
  STB: 1,
  MSTB: 1e3,
  MMSTB: 1e6,
  "sm³": 1 / 0.158987294928,
  "MM sm³": 1e6 / 0.158987294928,
};
export const gasUnits: Record<string, number> = {
  scf: 1,
  Mscf: 1e3,
  MMscf: 1e6,
  Bscf: 1e9,
  "sm³": 1 / 0.028316846592,
  "MM sm³": 1e6 / 0.028316846592,
};
export const pressureUnits: Record<string, number> = {
  psia: 1,
  "kPa(a)": 1 / 6.894757293168,
  "MPa(a)": 1 / 0.006894757293168,
};
export function parseTable(text: string): RawTable {
  if (text.length > 5e6) throw new Error("File limit is 5 MB.");
  const parsed = Papa.parse<string[]>(text.trim().replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimiter: text.split("\n")[0].includes("\t") ? "\t" : "",
  });
  if (parsed.errors.some((e) => e.code !== "UndetectableDelimiter"))
    throw new Error(`CSV: ${parsed.errors[0].message}`);
  if (parsed.data.length < 2)
    throw new Error("Include a header and at least one data row.");
  const headers = parsed.data[0].map((s) => s.trim());
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw new Error("Column headers must be unique and nonempty.");
  if (parsed.data.length > 2001)
    throw new Error("Maximum 2,000 history rows per case.");
  if (parsed.data.slice(1).some((r) => r.length !== headers.length))
    throw new Error(
      "Some rows have a different number of columns than the header.",
    );
  return { headers, rows: parsed.data.slice(1) };
}
export function normalizeDate(raw: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : (() => {
        const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m
          ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
          : "";
      })();
  if (
    !iso ||
    !Number.isFinite(Date.parse(iso)) ||
    new Date(iso).toISOString().slice(0, 10) !== iso
  )
    throw new Error(`Invalid date “${raw}”. Use YYYY-MM-DD or M/D/YYYY.`);
  return iso;
}
export function historyIssues(rows: HistoryRow[], pi?: number): string[] {
  const issues: string[] = [],
    dates = new Set<string>(),
    ids = new Set<string>();
  if (!rows.length) issues.push("History is empty. Add rows or load a demo.");
  if (rows.length > 2000) issues.push("History exceeds 2,000 rows.");
  rows.forEach((r, i) => {
    const tag = `Row ${i + 1}`;
    const observation =
      r.date === "" &&
      typeof r.observation === "string" &&
      r.observation.trim().length > 0;
    if (!observation)
      try {
        normalizeDate(r.date);
      } catch {
        issues.push(`${tag}: date is missing or invalid.`);
      }
    const label = r.date || r.observation || "";
    if (dates.has(label))
      issues.push(`${tag}: duplicate date/observation ${label}.`);
    dates.add(label);
    if (!r.id || ids.has(r.id))
      issues.push(`${tag}: missing or duplicate row ID.`);
    ids.add(r.id);
    if (i && !observation && r.date <= rows[i - 1].date)
      issues.push(`${tag}: dates must be strictly increasing.`);
    if (i && !!r.date !== !!rows[0].date)
      issues.push(`${tag}: do not mix dated and undated observations.`);
    for (const k of ["np", "gp", "wp", "wi", "gi"] as const) {
      if (!Number.isFinite(r[k]) || r[k] < 0)
        issues.push(
          `${tag}: ${k.toUpperCase()} must be finite and nonnegative.`,
        );
      if (i && r[k] < rows[i - 1][k] - 1e-8)
        issues.push(`${tag}: ${k.toUpperCase()} cumulative decreases.`);
    }
    if (
      r.pressure !== null &&
      (!Number.isFinite(r.pressure) ||
        r.pressure <= 0 ||
        (pi && r.pressure > pi * 3))
    )
      issues.push(
        `${tag}: pressure must be positive and no greater than 3 × initial pressure; check absolute units.`,
      );
    if (typeof r.use !== "boolean")
      issues.push(`${tag}: Use must be a boolean.`);
  });
  return issues;
}
export interface RateRow {
  date: string;
  qo: number;
  qg: number;
  qw: number;
  qi: number;
  qgi: number;
  pressure: number | null;
  use: boolean;
}
export function integrateRates(
  rows: RateRow[],
  convention: ImportOptions["integration"],
): HistoryRow[] {
  let np = 0,
    gp = 0,
    wp = 0,
    wi = 0,
    gi = 0;
  return rows.map((r, i) => {
    if (i) {
      const prev = rows[i - 1],
        days = (Date.parse(r.date) - Date.parse(prev.date)) / 86400000;
      if (!(days > 0))
        throw new Error(
          "Rate dates must be strictly increasing without duplicates.",
        );
      const area = (key: "qo" | "qg" | "qw" | "qi" | "qgi") =>
        days *
        (convention === "trapezoidal" ? (r[key] + prev[key]) / 2 : r[key]);
      np += area("qo");
      gp += area("qg");
      wp += area("qw");
      wi += area("qi");
      gi += area("qgi");
    }
    return {
      id: `import-${i}`,
      date: r.date,
      np,
      gp,
      wp,
      wi,
      gi,
      pressure: r.pressure,
      use: r.use,
    };
  });
}
export function importHistory(table: RawTable, o: ImportOptions): HistoryRow[] {
  const index = (key: string) => table.headers.indexOf(o.mapping[key]);
  const required = [
    "Date",
    o.model === "oil"
      ? o.format === "rates"
        ? "qo"
        : "Np"
      : o.format === "rates"
        ? "qg"
        : "Gp",
  ];
  for (const key of required)
    if (index(key) < 0) throw new Error(`Map required column ${key}.`);
  if (
    ![
      o.liquidUnit in liquidUnits,
      o.gasUnit in gasUnits,
      o.pressureUnit in pressureUnits,
    ].every(Boolean)
  )
    throw new Error("Unrecognized import units.");
  const mappingValues = Object.values(o.mapping).filter(Boolean);
  if (new Set(mappingValues).size !== mappingValues.length)
    throw new Error("Each source column can only be mapped once.");
  const liq = liquidUnits[o.liquidUnit],
    gas = gasUnits[o.gasUnit];
  const parsed = table.rows.map((r, i) => {
    const get = (key: string) => (index(key) < 0 ? "" : r[index(key)].trim());
    const num = (key: string, factor: number) => {
      if (index(key) < 0) return 0;
      const raw = get(key),
        n = Number(raw.replaceAll(",", ""));
      if (!raw || !Number.isFinite(n) || n < 0)
        throw new Error(`Row ${i + 1}: ${key} is missing or invalid.`);
      return n * factor;
    };
    const rawP = get("Pressure"),
      pressure = rawP ? num("Pressure", pressureUnits[o.pressureUnit]) : null;
    const use = !["false", "0", "no"].includes(get("Use").toLowerCase());
    return {
      date: normalizeDate(get("Date")),
      qo: num(o.format === "rates" ? "qo" : "Np", liq),
      qg: num(o.format === "rates" ? "qg" : "Gp", gas),
      qw: num(o.format === "rates" ? "qw" : "Wp", liq),
      qi: num(o.format === "rates" ? "qi" : "Wi", liq),
      qgi: num(o.format === "rates" ? "qgi" : "Gi", gas),
      pressure,
      use,
    };
  });
  const rows: HistoryRow[] =
    o.format === "rates"
      ? integrateRates(parsed, o.integration)
      : parsed.map((r, i) => ({
          id: `import-${i}`,
          date: r.date,
          np: r.qo,
          gp: r.qg,
          wp: r.qw,
          wi: r.qi,
          gi: r.qgi,
          pressure: r.pressure,
          use: r.use,
        }));
  const issues = historyIssues(rows);
  if (issues.length) throw new Error(issues.slice(0, 5).join(" "));
  return rows;
}
export const serializeCSV = (rows: Record<string, unknown>[]) =>
  Papa.unparse(rows, { escapeFormulae: true });
