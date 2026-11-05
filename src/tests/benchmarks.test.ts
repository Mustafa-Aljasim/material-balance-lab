import { describe, expect, it } from "vitest";
import answers from "./benchmarks/term-answers.json";
import {
  benchmarkAudit,
  benchmarkScenario,
  learningCases,
} from "../data/benchmarks";
import {
  gasCapRegression,
  roundingSensitivity,
} from "../engineering/gasCapRegression";
import {
  balanceAt,
  scanRoots,
  solvePressure,
} from "../engineering/pressureSolver";
import { interpolatePVT, makePVT, validateTable } from "../engineering/pvt";
import { importPVT } from "../engineering/pvtImport";
import {
  importReference,
  referenceFactor,
} from "../engineering/referenceImport";
import {
  historyIssues,
  parseTable,
  serializeCSV,
} from "../engineering/history";
import { historyExport, parseProject } from "../engineering/project";
import { evaluate } from "../engineering/diagnostics";
import { autoMatch } from "../engineering/matching";
import { demo } from "../data/demo";
import { pvtQC } from "../engineering/pvtQC";
describe("published Virginia Hills raw-history arithmetic (independent Decimal answers)", () => {
  const s = benchmarkScenario("virginia")!,
    audit = benchmarkAudit(s);
  for (const expected of answers.virginia)
    it(`reproduces F/Eo/Efw/Et at ${expected.p} psia`, () => {
      const b = audit.rows.find(
        (r) => r.row.pressure === expected.p,
      )!.measured!;
      expect(b.F).toBeCloseTo(expected.F, 5);
      expect(b.Eo).toBeCloseTo(expected.Eo, 12);
      expect(b.Efw).toBeCloseTo(expected.Efw, 12);
      expect(b.Et).toBeCloseTo(expected.Et, 12);
      expect(b.Eg).toBe(0);
      expect(b.pvt.bg).toBeNull();
      expect(b.pvt.rs).toBeNull();
    });
  it("reports the actual through-origin slope rather than forcing the printed answer", () => {
    expect(audit.N! / 1e6).toBeCloseTo(282.829065946186, 8);
    expect(audit.N! / 1e6).not.toBeCloseTo(257, 0);
    expect(learningCases[0].status).toBe("REFERENCE_DISCREPANCY");
  });
  it("does not invent dates, gas PVT, or source Rs", () => {
    expect(s.history.every((r) => r.date === "" && r.observation)).toBe(true);
    expect(
      s.pvt.table.every((r) => r.bg === null && r.rs === null && r.z === null),
    ).toBe(true);
    expect(historyIssues(s.history)).toEqual([]);
  });
});
describe("published Dake gas-cap terms and parameter sensitivity", () => {
  for (const expected of answers.dake)
    it(`reproduces each term at ${expected.p} psia`, () => {
      const s = benchmarkScenario("dake")!,
        b = benchmarkAudit(s).rows.find(
          (r) => r.row.pressure === expected.p,
        )!.measured!;
      expect(b.F).toBeCloseTo(expected.F, 5);
      expect(b.Eo).toBeCloseTo(expected.Eo, 12);
      expect(b.EgBase).toBeCloseTo(expected.EgBase, 12);
      expect(b.Eg).toBeCloseTo(expected.EgBase * 0.5, 12);
      expect(b.support).toBeCloseTo(expected.support, 5);
      expect(b.Efw).toBe(0);
    });
  it("honors MMSTB × cumulative Rp conversion exactly", () => {
    const s = benchmarkScenario("dake")!;
    expect(s.history[1].np).toBe(3295000);
    expect(s.history[1].gp).toBe(3459750000);
  });
  it("matches the fixed-m slopes and quantifies the free-intercept result", () => {
    const s = benchmarkScenario("dake")!;
    for (const [m, N] of [
      [0.4, answers.slopes.dakeM04],
      [0.5, answers.slopes.dakeM05],
      [0.6, answers.slopes.dakeM06],
    ]) {
      s.params.m = m;
      expect(benchmarkAudit(s).N! / 1e6).toBeCloseTo(N / 1e6, 8);
    }
    const g = benchmarkAudit(s).gasCap;
    expect(g.fit!.N / 1e6).toBeCloseTo(answers.slopes.dakeJointN / 1e6, 7);
    expect(g.fit!.m).toBeCloseTo(answers.slopes.dakeJointM, 8);
    expect(g.warnings.join(" ")).toContain("strongly correlated");
    expect(g.fit!.leaveOneOutN!.length).toBe(2);
  });
  it("uses the correct m-dependent rock/water linearization in the general case", () => {
    const s = demo();
    s.params.cf = 1e-5;
    const pvt = makePVT(s.pvt, s.params, "oil");
    const rows = s.history.slice(1).map((row) => {
      const old = balanceAt(s, row, row.pressure!, pvt);
      const scale = old.support / old.F;
      const r = {
        ...row,
        np: row.np * scale,
        gp: row.gp * scale,
        wp: row.wp * scale,
      };
      return {
        row: r,
        measured: balanceAt(s, r, r.pressure!, pvt),
        predicted: null,
        predictedBalance: null,
        residual: null,
      };
    });
    const fit = gasCapRegression(s, rows).fit!;
    expect(fit.N / s.params.N).toBeCloseTo(1, 10);
    expect(fit.m).toBeCloseTo(s.params.m, 10);
  });
});
describe("field-reference data sufficiency is separate from arithmetic acceptance", () => {
  it("reproduces Iraqi year-2000 withdrawal and expansion but remains partial", () => {
    const s = benchmarkScenario("iraq")!,
      a = benchmarkAudit(s),
      b = a.rows[0].measured!;
    expect(s.history).toHaveLength(16);
    expect(b.F).toBeCloseTo(answers.iraq.F2000, 5);
    expect(b.Eo).toBeCloseTo(answers.iraq.Eo2000, 12);
    expect(b.EgBase).toBeCloseTo(answers.iraq.EgBase2000, 12);
    expect(a.issues.join(" ")).toContain("GP cumulative decreases");
    expect(
      pvtQC(s).messages.some((m) => m.text.includes("Large Rs jump")),
    ).toBe(true);
    expect(learningCases[2].status).toBe("PARTIAL_VALIDATION");
    expect(() => autoMatch(s, [{ key: "N", min: 1e6, max: 2e9 }])).toThrow(
      "history QC",
    );
  });
  it("does not fabricate SABA production history or claim multi-tank support", () => {
    expect(benchmarkScenario("saba")).toBeNull();
    expect(learningCases[3].status).toBe("INSUFFICIENT_SOURCE_DATA");
  });
  it("verifies independent linear-Bo support magnitude against an analytic answer", () => {
    const s = demo();
    s.params = {
      ...s.params,
      pi: 3000,
      pb: 1500,
      N: 10e6,
      m: 0,
      cf: 0,
      cw: 0,
      caq: 500,
    };
    s.pvt = {
      mode: "table",
      oilMode: "undersaturated",
      extrapolate: false,
      table: [
        { pressure: 1500, bo: 1.35, rs: null, bg: null, z: null, bw: 1 },
        { pressure: 3000, bo: 1.2, rs: null, bg: null, z: null, bw: 1 },
      ],
    };
    const r = {
      ...s.history[0],
      np: 1e6,
      gp: 0,
      wp: 0,
      wi: 0,
      gi: 0,
      pressure: null,
    };
    const pvt = makePVT(s.pvt, s.params, "oil");
    expect(solvePressure(s, r, pvt).root).toBeCloseTo(1666.666666666667, 6);
    s.aquifer = "pot";
    const p = solvePressure(s, r, pvt).root;
    expect(p).toBeCloseTo(2142.857142857143, 6);
    expect(500 * (3000 - p)).toBeCloseTo(428571.4285714286, 3);
  });
});
describe("flexible oil PVT, reference import and scenario integrity", () => {
  it("accepts oil Bo/Rs/Bg without Z, and requires explicit constant Bw approval", () => {
    const text = "Pressure,Bo,Rs,Bg\n3000,1.2,500,.001\n2000,1.3,400,.002";
    expect(() =>
      importPVT(text, "oil", "FIELD", {
        oilMode: "black-oil",
        constantBw: null,
        source: "source",
      }),
    ).toThrow("Explicitly approve");
    const config = importPVT(text, "oil", "FIELD", {
      oilMode: "black-oil",
      constantBw: 1,
      source: "source",
    });
    expect(config.table[0].z).toBeNull();
    expect(config.constantBw).toBe(1);
    expect(
      makePVT(config, { ...demo().params, pi: 3000 }, "oil")(2500).z,
    ).toBeNull();
  });
  it("rejects absent/nonfinite PVT keys and mixed missing values", () => {
    const a = { pressure: 2000, bo: 1.2, rs: null, bg: null, z: null, bw: 1 };
    expect(() =>
      validateTable([a, { ...a, pressure: 3000, rs: undefined } as never]),
    ).toThrow("PVT values");
    expect(() => validateTable([a, { ...a, pressure: 3000, rs: 500 }])).toThrow(
      "throughout",
    );
    expect(() => interpolatePVT(NaN, [a, { ...a, pressure: 3000 }])).toThrow(
      "finite",
    );
  });
  it("never substitutes Bo-only data below Pb or when a gas cap/free gas is required", () => {
    const s = benchmarkScenario("virginia")!,
      pvt = makePVT(s.pvt, s.params, "oil");
    expect(() => pvt(1400)).toThrow("p ≥ Pb");
    expect(() => makePVT(s.pvt, { ...s.params, m: 0.1 }, "oil")(3500)).toThrow(
      "gas cap",
    );
    expect(() => balanceAt(s, { ...s.history[2], gp: 100 }, 3500, pvt)).toThrow(
      "free-gas",
    );
  });
  it("maps independent units, preserves observations, and round-trips exact cumulatives", () => {
    const s = benchmarkScenario("dake")!;
    const raw = "Observation,Pressure,Np,Rp,Wp\nA,22,2,100,4\nB,20,3,110,5";
    const o = {
      mapping: {
        Observation: "Observation",
        Pressure: "Pressure",
        Np: "Np",
        Rp: "Rp",
        Wp: "Wp",
      },
      units: { Pressure: "MPa(a)", Np: "MMSTB", Wp: "MSTB", Rp: "scf/STB" },
      oilMode: "black-oil" as const,
      constantBw: 1,
      source: "exercise",
    };
    const imported = importReference(parseTable(raw), s, o);
    expect(imported.history[1]).toMatchObject({
      date: "",
      observation: "B",
      np: 3e6,
      gp: 330e6,
      wp: 5000,
    });
    const next = { ...s, history: imported.history };
    expect(parseProject(JSON.stringify(next))).toEqual(next);
    const exported = historyExport(next);
    const back = importReference(parseTable(serializeCSV(exported)), next, {
      ...o,
      mapping: {
        Observation: "Observation",
        Pressure: "Pressure",
        Np: "Np",
        Gp: "Gp",
        Wp: "Wp",
        Use: "Use",
      },
      units: { Pressure: "psia", Np: "STB", Gp: "scf", Wp: "STB" },
    });
    expect(back.history[1].gp).toBe(330e6);
    expect(back.history[1].np).toBe(3e6);
  });
  it("flags inconsistent published cumulative GOR without silently repairing the table", () => {
    const s = benchmarkScenario("iraq")!,
      t = parseTable(learningCases[2].raw!);
    const imported = importReference(t, s, {
      mapping: {
        Observation: "Year",
        Pressure: "Pressure_psia",
        Np: "Np_MMSTB",
        Wp: "Wp_MMSTB",
        Rp: "Rp_scf_STB",
        Rs: "Rs_scf_STB",
        Bo: "Bo_rb_STB",
        Bg: "Bg_rb_scf",
      },
      units: {
        Pressure: "psia",
        Np: "MMSTB",
        Wp: "MMSTB",
        Rp: "scf/STB",
        Rs: "scf/STB",
        Bo: "rb/STB",
        Bg: "rb/scf",
      },
      oilMode: "black-oil",
      constantBw: 1,
      source: "paper Table 2",
    });
    expect(imported.issues.join(" ")).toContain("GP cumulative decreases");
    expect(imported.history[3].gp).toBeCloseTo(11147866271.055, 4);
  });
});
describe("solver root audit and bounded matching", () => {
  it("detects multiple sign-changing roots and rejects discontinuous/nonfinite bridges", () => {
    expect(
      scanRoots((x) => (x - 1) * (x - 3), [0, 0.5, 1.5, 2, 2.5, 3.5, 4]).map(
        (r) => r.root,
      ),
    ).toEqual([1, 3]);
    expect(scanRoots((x) => (x === 2 ? NaN : x - 2), [1, 2, 3])).toEqual([]);
  });
  it("recovers pressures above/below Pb without measured pressure leakage and has small volume residuals", () => {
    const s = demo(),
      pvt = makePVT(s.pvt, s.params, "oil");
    for (const row of s.history) {
      const result = solvePressure(
        s,
        { ...row, pressure: null, use: false },
        pvt,
      );
      expect(result.root).toBeCloseTo(row.pressure!, 5);
      expect(Math.abs(result.residual)).toBeLessThan(0.001);
    }
  });
  it("fits N with fixed support/PVT and preserves the input scenario", () => {
    const s = demo();
    s.params.N = 70e6;
    const before = JSON.stringify(s);
    const result = autoMatch(s, [{ key: "N", min: 50e6, max: 120e6 }]);
    expect(result.converged).toBe(true);
    expect(result.params.N / 1e6).toBeCloseTo(85, 3);
    expect(result.after).toBeLessThan(0.01);
    expect(result.params.m).toBe(s.params.m);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("fits N and m, reporting sensitivity and correlation rather than varying PVT", () => {
    const s = demo();
    s.params.N = 75e6;
    s.params.m = 0.25;
    const result = autoMatch(s, [
      { key: "N", min: 60e6, max: 110e6 },
      { key: "m", min: 0.05, max: 0.45 },
    ]);
    expect(result.params.N / 1e6).toBeCloseTo(85, 2);
    expect(result.params.m).toBeCloseTo(0.18, 3);
    expect(result.after).toBeLessThan(0.02);
    expect(result.sensitivity).toHaveLength(2);
    expect(result.params.caq).toBe(s.params.caq);
  });
  it("fits N and Pot storage against independently generated supported history", () => {
    const s = demo();
    s.aquifer = "pot";
    s.params.caq = 18000;
    const pvt = makePVT(s.pvt, s.params, "oil");
    s.history = s.history.map((row) => {
      const b = balanceAt(s, row, row.pressure!, pvt);
      const scale = b.F === 0 ? 1 : b.support / b.F;
      return {
        ...row,
        np: row.np * scale,
        gp: row.gp * scale,
        wp: row.wp * scale,
      };
    });
    s.params.N = 75e6;
    s.params.caq = 10000;
    const result = autoMatch(s, [
      { key: "N", min: 60e6, max: 110e6 },
      { key: "caq", min: 0, max: 40000 },
    ]);
    expect(result.params.N / 1e6).toBeCloseTo(85, 2);
    expect(result.params.caq).toBeCloseTo(18000, 0);
    expect(result.after).toBeLessThan(0.02);
  });
  it("fails clearly for unsupported fitting, sparse surveys, and invalid bounds", () => {
    expect(() =>
      autoMatch(demo("gas"), [{ key: "N", min: 1, max: 2 }]),
    ).toThrow("oil only");
    const s = demo();
    s.history = s.history.slice(0, 1);
    expect(() => autoMatch(s, [{ key: "N", min: 1e6, max: 100e6 }])).toThrow(
      "Insufficient",
    );
    expect(() => autoMatch(demo(), [{ key: "N", min: 0, max: 1 }])).toThrow(
      "Bounds",
    );
  });
  it("preserves the original dry-gas production and forward response", () => {
    const s = demo("gas");
    expect(evaluate(s).at(-1)!.predicted).toBeCloseTo(1400, 5);
  });
});

describe("QC edge cases and rounding diagnostics", () => {
  it("exposes Dake rounding instability without mutating the printed table", () => {
    const s = benchmarkScenario("dake")!;
    const source = JSON.stringify(s);
    const study = roundingSensitivity(s);
    expect(study.trials).toBe(42);
    expect(study.rejected).toBe(0);
    expect(study.nonphysical).toBeGreaterThan(0);
    expect(study.fixedN![0] / 1e6).toBeGreaterThan(110);
    expect(study.fixedN![1] / 1e6).toBeLessThan(120);
    expect(study.jointN![0]).toBeLessThan(0);
    expect(study.jointN![1]).toBeGreaterThan(180e6);
    expect(JSON.stringify(s)).toBe(source);
  });
  it("does not label unknown Bo-only cumulative Rp as zero", () => {
    const s = benchmarkScenario("virginia")!;
    expect(benchmarkAudit(s).rows[1].measured!.rp).toBeNull();
  });
  it("detects multiple forward roots in a nonmonotone source table", () => {
    const s = benchmarkScenario("virginia")!;
    s.params = { ...s.params, pi: 3000, pb: 1000, N: 10e6, cf: 0, cw: 0 };
    s.pvt.table = [
      [1000, 1.2],
      [1500, 1.4],
      [2000, 1.2],
      [2500, 1.4],
      [3000, 1.2],
    ].map(([pressure, bo]) => ({
      pressure,
      bo,
      rs: null,
      bg: null,
      z: null,
      bw: 1,
    }));
    const row = { ...s.history[1], np: 1e6, gp: 0, wp: 0, pressure: null };
    const result = solvePressure(s, row, makePVT(s.pvt, s.params, "oil"));
    // At a root: 10e6(Bo−1.2)=1e6 Bo => Bo=4/3. Four segments cross it.
    expect(result.candidates).toHaveLength(4);
    expect(result.root).toBeCloseTo(2666.666666667, 6);
    expect(result.warnings?.[0]).toContain("Multiple");
    expect(Math.abs(result.residual)).toBeLessThan(0.001);
  });
  it("rejects malformed optional PVT source metadata on JSON import", () => {
    for (const metadata of [
      { source: {} },
      { constantBw: -1 },
      { suppliedColumns: [{}] },
    ]) {
      const s = demo();
      Object.assign(s.pvt, metadata);
      expect(() => parseProject(JSON.stringify(s))).toThrow("metadata");
    }
  });
  it("rejects unknown per-column units instead of silently treating them as field units", () => {
    expect(() => referenceFactor("Rp", "instantaneous GOR")).toThrow(
      "Invalid unit",
    );
    expect(() => referenceFactor("Bg", "unknown")).toThrow("Invalid unit");
  });
});

it("reports finite one-sided sensitivity when the Dake table boundary blocks a central perturbation", () => {
  const s = benchmarkScenario("dake")!;
  const result = autoMatch(s, [
    { key: "N", min: 57.5e6, max: 207e6 },
    { key: "m", min: 0, max: 1.5 },
  ]);
  expect(
    result.sensitivity.every((v) => Number.isFinite(v.rmsPressureChange)),
  ).toBe(true);
  expect(result.warnings.some((v) => v.includes("one-sided"))).toBe(true);
  expect(result.correlation).not.toBeNull();
  expect(result.after).toBeLessThan(result.before);
});
