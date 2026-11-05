import type { Model, PVT, PVTConfig, Units } from "../types";
import { parseTable } from "./history";
import { toField } from "./units";
import { validateTable } from "./pvt";
export function importPVT(
  text: string,
  model: Model,
  units: Units,
  options: {
    oilMode: "black-oil" | "undersaturated";
    constantBw: number | null;
    source: string;
  },
): PVTConfig {
  const table = parseTable(text),
    keys = ["Pressure", "Bo", "Rs", "Bg", "Bw", "Z"];
  const indexes = Object.fromEntries(
    keys.map((k) => [
      k,
      table.headers.findIndex((h) => h.toLowerCase() === k.toLowerCase()),
    ]),
  );
  const need =
    model === "gas"
      ? ["Pressure", "Bo", "Bg", "Z"]
      : options.oilMode === "undersaturated"
        ? ["Pressure", "Bo"]
        : ["Pressure", "Bo", "Rs", "Bg"];
  for (const key of need)
    if (indexes[key] < 0)
      throw new Error(`PVT requires ${key} for the selected formulation.`);
  if (
    indexes.Bw < 0 &&
    !(options.constantBw !== null && options.constantBw > 0)
  )
    throw new Error(
      "Bw is absent. Explicitly approve a positive constant water FVF or supply laboratory Bw.",
    );
  const rows = table.rows.map((r, i): PVT => {
    const value = (key: string): number | null => {
      const index = indexes[key];
      if (index < 0) return null;
      if (!r[index].trim() || !Number.isFinite(Number(r[index])))
        throw new Error(`PVT row ${i + 1}: ${key} missing or invalid.`);
      return Number(r[index]);
    };
    const converted = (key: string, q: "pressure" | "rs" | "bg") => {
      const v = value(key);
      return v === null ? null : toField(v, q, units);
    };
    return {
      pressure: converted("Pressure", "pressure")!,
      bo: value("Bo")!,
      rs: converted("Rs", "rs"),
      bg: converted("Bg", "bg"),
      bw: value("Bw") ?? options.constantBw!,
      z: value("Z"),
    };
  });
  return {
    mode: "table",
    table: validateTable(rows),
    extrapolate: false,
    oilMode: options.oilMode,
    source: options.source,
    suppliedColumns: keys.filter((k) => indexes[k] >= 0),
    ...(indexes.Bw < 0 ? { constantBw: options.constantBw! } : {}),
  };
}
