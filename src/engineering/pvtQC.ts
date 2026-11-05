import type { Scenario } from "../types";
import { makePVT } from "./pvt";
export function pvtQC(s: Scenario) {
  const messages: { level: "info" | "warning" | "error"; text: string }[] = [];
  let initial = null;
  try {
    initial = makePVT(s.pvt, s.params, s.model)(s.params.pi);
  } catch (e) {
    messages.push({ level: "error", text: (e as Error).message });
  }
  if (s.pvt.mode === "table") {
    const t = [...s.pvt.table].sort((a, b) => a.pressure - b.pressure);
    if (!t.some((r) => r.pressure === s.params.pi))
      messages.push({
        level: "warning",
        text: "No exact initial-state row: initial PVT is interpolated (or explicitly extrapolated). Verify against measured Boi/Rsi/Bgi.",
      });
    if (s.pvt.extrapolate)
      messages.push({
        level: "warning",
        text: "PVT extrapolation is enabled. Values outside laboratory coverage are estimates.",
      });
    if (t.some((r) => r.z === null))
      messages.push({
        level: s.model === "oil" ? "info" : "error",
        text: "Z is not supplied. Oil volume balance does not need it; no Z curve or p/Z diagnostic can be inferred.",
      });
    if (s.pvt.constantBw !== undefined)
      messages.push({
        level: "info",
        text: `User-approved constant Bw = ${s.pvt.constantBw}; not a laboratory water-PVT measurement.`,
      });
    if (s.pvt.oilMode === "undersaturated")
      messages.push({
        level: "info",
        text: "Bo-only formulation: p ≥ Pb, no initial cap and no free-gas withdrawal/injection. Constant associated solution gas cancels algebraically; missing Rs/Bg remain missing.",
      });
    for (let i = 1; i < t.length; i++) {
      const a = t[i - 1],
        b = t[i],
        delta = (b.pressure - a.pressure) / b.pressure;
      if (a.rs !== null && b.rs !== null && a.rs > b.rs + 1e-9)
        messages.push({
          level: "warning",
          text: `Rs decreases with increasing pressure between ${a.pressure} and ${b.pressure} psia.`,
        });
      if (a.bg !== null && b.bg !== null && a.bg < b.bg)
        messages.push({
          level: "warning",
          text: `Bg increases with increasing pressure between ${a.pressure} and ${b.pressure} psia; verify source and units.`,
        });
      if (
        a.bg !== null &&
        b.bg !== null &&
        delta < 0.1 &&
        Math.abs(a.bg / b.bg - 1) > 0.5
      )
        messages.push({
          level: "warning",
          text: `Bg changes by over 50% across a pressure interval below 10% (${a.pressure}–${b.pressure} psia). This is a source-consistency flag, not an automatic correction.`,
        });
      if (
        a.rs !== null &&
        b.rs !== null &&
        delta < 0.05 &&
        Math.abs(a.rs - b.rs) > Math.max(1, b.rs * 0.3)
      )
        messages.push({
          level: "warning",
          text: `Large Rs jump over a narrow pressure interval (${a.pressure}–${b.pressure} psia); check initial-state and PVT continuity.`,
        });
      if (a.pressure >= s.params.pb && a.bo < b.bo - 1e-8)
        messages.push({
          level: "warning",
          text: `Above-Pb Bo increases with pressure (${a.pressure}–${b.pressure} psia); verify the bubble point and oil compressibility.`,
        });
    }
  }
  return { initial, messages };
}
