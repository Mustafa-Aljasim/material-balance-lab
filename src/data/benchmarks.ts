import virginiaRaw from "../../public/benchmarks/virginia-hills.csv?raw";
import dakeRaw from "../../public/benchmarks/dake.csv?raw";
import iraqRaw from "../../public/benchmarks/iraqi-tertiary-table2.csv?raw";
import type { Scenario, SolvedRow } from "../types";
import { demo } from "./demo";
import { parseTable, historyIssues } from "../engineering/history";
import { makePVT } from "../engineering/pvt";
import { balanceAt } from "../engineering/pressureSolver";
import { originSlope } from "../engineering/diagnostics";
import { gasCapRegression } from "../engineering/gasCapRegression";
export type ValidationStatus =
  | "PASS"
  | "FAIL"
  | "REFERENCE_DISCREPANCY"
  | "PARTIAL_VALIDATION"
  | "INSUFFICIENT_SOURCE_DATA"
  | "UNSUPPORTED_MODEL";
export interface LearningCase {
  id: string;
  name: string;
  source: string;
  url: string;
  status: ValidationStatus;
  objective: string;
  assumptions: string[];
  missing: string[];
  published: string;
  raw: string | null;
  filename: string | null;
}
export const learningCases: LearningCase[] = [
  {
    id: "virginia",
    name: "Virginia Hills — Undersaturated Oil",
    source:
      "Ahmed & McKinney, Advanced Reservoir Engineering, Ch. 4, Example 4.3, pp. 309–310. Same raw table in Ahmed’s Handbook, Example 11-3.",
    url: "https://www.sciencedirect.com/topics/engineering/material-balance-equation",
    status: "REFERENCE_DISCREPANCY",
    objective:
      "Verify individual withdrawal/expansion terms and investigate the printed OOIP discrepancy.",
    assumptions: [
      "Above Pb = 1500 psia throughout; m = 0 and aquifer None.",
      "Bo-only balance: constant associated solution gas cancels. Rsi, Bg and Z are not invented.",
      "Bw = 1.0 and stated rock/water properties. Observation order has no actual production dates.",
    ],
    missing: [
      "Temperature, Rsi and gas PVT are unnecessary for this reduced exercise.",
    ],
    published:
      "Textbook N ≈ 257 MMSTB; brief reports ≈283.82 MMSTB from rounded solution columns.",
    raw: virginiaRaw,
    filename: "virginia-hills.csv",
  },
  {
    id: "dake",
    name: "Dake — Gas-Cap Drive",
    source:
      "L.P. Dake, Fundamentals of Reservoir Engineering, Ch. 3, Exercise 3.4, pp. 87–90. Raw table corroborated by the TAMU thesis Table 3.1.",
    url: "https://oaktrust.library.tamu.edu/server/api/core/bitstreams/94c5a927-f3c0-407c-8f73-7020add8963b/content",
    status: "PASS",
    objective:
      "Recover the tabulated terms and study the tradeoff between N and gas-cap ratio.",
    assumptions: [
      "Pi = Pb = 3330 psia; initial Bo/Rs/Bg are explicitly supplied.",
      "No water/injection/aquifer; cf = cw = 0 for this exercise.",
      "Start N = 115 MMSTB, m = 0.5. Z and actual production dates are not supplied or required.",
    ],
    missing: ["Rounded inputs do not uniquely constrain both N and m."],
    published:
      "N ≈115 MMSTB at m≈0.5; first F≈5.807 MMrb, Eo≈0.01456, Eg⁰≈0.07190.",
    raw: dakeRaw,
    filename: "dake.csv",
  },
  {
    id: "iraq",
    name: "Iraqi Tertiary Reservoir — Published Field Case",
    source:
      "Abed, Tawfeeq & Awad (2026), Petroleum and Coal 68, pp. 448–454; Tables 1–2, printed p.451.",
    url: "https://vurup.sk/download/3145/3417",
    status: "PARTIAL_VALIDATION",
    objective:
      "Audit the printed production/PVT arithmetic without pretending to reproduce an undisclosed calibration.",
    assumptions: [
      "Rowwise F uses the brief’s explicit Bw = 1.0 check.",
      "Initial Bo = 1.56, Rs = 1051 and Bg = 0.000866 are taken from Table 1.",
      "Year labels remain year labels; no survey dates are invented. Any no-cap/no-aquifer/zero-compressibility slope is an explicitly exploratory baseline.",
    ],
    missing: [
      "Initial gas-cap ratio, calibrated aquifer/storage parameters, cf, cw, Swi and Pb are not established.",
      "Published Rp interpreted as cumulative GOR gives decreasing Gp; interpretation must be resolved before history simulation or fitting.",
      "Pressure/production were fine-tuned in the paper; calibrated input history is not published.",
    ],
    published:
      "Excel/RUN 1237.3; MBAL 1245.66; earlier volumetric 1226 MMSTB. Year 2000 F = 23.01567 MMrb for Bw=1.",
    raw: iraqRaw,
    filename: "iraqi-tertiary-table2.csv",
  },
  {
    id: "saba",
    name: "SABA — Aquifer Support",
    source:
      "Bawahab & Hazim (2023), Geosciences and Engineering 11(1), 117–132; Tables 1–4 and Figures 5–7.",
    url: "https://ojs.uni-miskolc.hu/index.php/geosciences/article/download/2221/1870/10575",
    status: "INSUFFICIENT_SOURCE_DATA",
    objective:
      "Separate an independent equilibrium-storage support test from reconstruction of the published MBAL models.",
    assumptions: [
      "Published small-pot result concerns the single-tank analysis; the paper also investigates multi-tank communication.",
      "Reported RMSE measurement basis is not assumed to be psi.",
      "Synthetic None/Pot verification is labelled as such and is not SABA production history.",
    ],
    missing: [
      "Complete dated production/injection/pressure history and pressure-dependent PVT.",
      "Calibrated aquifer/storage parameters, compressibilities, reference fluid states and RMSE measurement basis.",
      "Transient aquifers and multi-tank transmissibility are unsupported.",
    ],
    published:
      "Small Pot: OOIP 23.371 million m³; RMSE 2.306568 on the study’s measurement basis.",
    raw: null,
    filename: null,
  },
];
const records = (raw: string) => {
  const t = parseTable(raw);
  return t.rows.map((r) =>
    Object.fromEntries(t.headers.map((h, i) => [h, r[i]])),
  );
};
export function benchmarkScenario(
  id: string,
  rawOverride?: string,
): Scenario | null {
  if (id === "saba") return null;
  const c = learningCases.find((c) => c.id === id)!,
    s = demo("oil");
  s.name = c.name;
  s.source = "imported";
  s.assumptions = [...c.assumptions];
  s.pvt = {
    mode: "table",
    table: [],
    extrapolate: false,
    source: c.source,
    oilMode: id === "virginia" ? "undersaturated" : "black-oil",
    constantBw: 1,
  };
  s.params = {
    ...s.params,
    pi: id === "virginia" ? 3685 : id === "dake" ? 3330 : 3319,
    pb: id === "virginia" ? 1500 : id === "dake" ? 3330 : 3319,
    N: id === "virginia" ? 300e6 : id === "dake" ? 115e6 : 1237.3e6,
    m: id === "dake" ? 0.5 : 0,
    cf: id === "virginia" ? 4.95e-6 : 0,
    cw: id === "virginia" ? 3.62e-6 : 0,
    swi: id === "virginia" ? 0.24 : 0,
    bw: 1,
    bwi: 1,
    rsi: id === "dake" ? 510 : id === "iraq" ? 1051 : 0,
    injection: false,
  };
  s.aquifer = "none";
  if (id === "virginia")
    s.assumptions!.push(
      "Entered trial inventory N = 300 MMSTB is a working value, not the published answer. The raw-data graphical slope is calculated independently.",
    );
  if (id === "iraq") {
    s.params.temperature = 170;
    s.params.api = 36;
    s.params.gasGravity = 0.768;
  }
  s.history = records(rawOverride ?? c.raw!).map((r, i) => {
    const p = Number(r.Pressure_psia ?? r.P_psia),
      np = Number(r.Np_MSTB ?? r.Np_MMSTB) * (id === "virginia" ? 1e3 : 1e6),
      wp =
        Number(r.Wp_MSTB ?? r.Wp_MMSTB ?? 0) * (id === "virginia" ? 1e3 : 1e6),
      gp = np * Number(r.Rp_scf_STB ?? 0);
    s.pvt.table.push({
      pressure: p,
      bo: Number(r.Bo_rb_STB ?? r.Bo),
      rs: id === "virginia" ? null : Number(r.Rs_scf_STB ?? r.Rs),
      bg: id === "virginia" ? null : Number(r.Bg_rb_scf ?? r.Bg),
      bw: 1,
      z: null,
    });
    return {
      id: `${id}-${i}`,
      date: "",
      observation: r.Year ? `Year ${r.Year}` : `Observation ${i + 1}`,
      np,
      gp,
      wp,
      wi: 0,
      gi: 0,
      pressure: p,
      use: true,
    };
  });
  if (id === "iraq")
    s.pvt.table.push({
      pressure: 3319,
      bo: 1.56,
      rs: 1051,
      bg: 0.000866,
      bw: 1,
      z: null,
    });
  s.pvt.table.sort((a, b) => a.pressure - b.pressure);
  if (id === "iraq")
    s.assumptions!.push(
      "Exploratory baseline only: m=0, cf=cw=0, Swi=0, aquifer None, Pb set to pi as an upper bound; these are not calibrated field properties.",
    );
  s.display.tab = "Engineering QC & Case Studies";
  return s;
}
export function benchmarkAudit(s: Scenario) {
  const pvt = makePVT(s.pvt, s.params, "oil"),
    rows: SolvedRow[] = s.history.map((row) => {
      try {
        return {
          row,
          measured:
            row.pressure === null ? null : balanceAt(s, row, row.pressure, pvt),
          predicted: null,
          predictedBalance: null,
          residual: null,
        };
      } catch (e) {
        return {
          row,
          measured: null,
          predicted: null,
          predictedBalance: null,
          residual: null,
          error: (e as Error).message,
        };
      }
    });
  const b = rows
    .filter((r) => r.measured && Math.abs(r.measured.Et) > 1e-10)
    .map((r) => r.measured!);
  return {
    rows,
    issues: historyIssues(s.history, s.params.pi),
    N: originSlope(b.map((b) => [b.Et, b.F - b.We])),
    gasCap: gasCapRegression(s, rows),
  };
}
