import { describe, expect, it } from "vitest";
import { empty, fixture, gasPVT, knownOil, oilPVT, tank } from "./fixtures";
import { oilBalance } from "../engineering/oilMBE";
import { gasBalance } from "../engineering/gasMBE";
import { waterInflux } from "../engineering/aquifer";
import {
  evaluate,
  linearFit,
  metrics,
  originSlope,
  pzValidity,
} from "../engineering/diagnostics";
import { bisect, solvePressure } from "../engineering/pressureSolver";
import {
  correlationPVT,
  dakZ,
  gasCorrelationPVT,
  interpolatePVT,
  makePVT,
  sutton,
  validateTable,
} from "../engineering/pvt";
import { fromField, toField } from "../engineering/units";
import { demo } from "../data/demo";
describe("oil balance: independently calculated algebraic fixture", () => {
  it("has correct withdrawal, expansion terms and exactly one gas-cap multiplier", () => {
    const b = oilBalance(
      2000,
      { ...empty, np: 2e6, gp: 2e9, wp: 1e6 },
      tank,
      oilPVT,
      "none",
    );
    expect(b.F).toBeCloseTo(6e6, 6);
    for (const k of ["Eo", "Eg", "Efw", "Et", "support"] as const)
      expect(b[k]).toBeCloseTo(knownOil[k], 8);
    expect(b.closure).toBeCloseTo(1464800, 6);
    expect(b.indices!.reduce((s, x) => s + x, 0)).toBeCloseTo(
      knownOil.support / b.F,
      12,
    );
  });
  it("closes for algebraically balanced production and reports signed indices", () => {
    const np = knownOil.support / 1.8;
    const b = oilBalance(
      2000,
      { ...empty, np, gp: 600 * np, wp: 0.1 * np },
      tank,
      oilPVT,
      "none",
    );
    expect(b.closure).toBeCloseTo(0, 7);
    expect(b.indices!.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    expect(
      oilBalance(3100, { ...empty, np: 100 }, tank, oilPVT, "none").oil,
    ).toBeLessThan(0);
  });
  it("uses injection FVFs with negative withdrawal signs; disabling injection removes them", () => {
    const r = { ...empty, wi: 100, gi: 200 };
    expect(oilBalance(2000, r, tank, oilPVT, "none").F).toBeCloseTo(-110.24, 9);
    expect(
      oilBalance(2000, r, { ...tank, injection: false }, oilPVT, "none").F,
    ).toBe(0);
    expect(gasBalance(2000, r, tank, gasPVT, "none").F).toBeCloseTo(-110.24, 9);
    expect(
      gasBalance(2000, r, { ...tank, bgi: null }, gasPVT, "none").F,
    ).toBeCloseTo(-110.3, 9);
  });
  it("handles zero oil production without a singular Rp and suppresses tiny indices", () => {
    const b = oilBalance(2000, { ...empty, gp: 1000 }, tank, oilPVT, "none");
    expect(b.F).toBe(2);
    expect(b.rp).toBeNull();
    expect(oilBalance(3000, empty, tank, oilPVT, "none").indices).toBeNull();
  });
});
describe("gas balance and volumetric interpretation", () => {
  it("matches an exact independent ideal gas volume balance", () => {
    const b = gasBalance(
      2000,
      { ...empty, gp: tank.G / 3 },
      { ...tank, cf: 0, cw: 0 },
      gasPVT,
      "none",
    );
    expect(b.F).toBeCloseTo(5e6, 7);
    expect(b.Eg).toBeCloseTo(0.0005, 12);
    expect(b.closure).toBeCloseTo(0, 7);
  });
  it("DAK gas demo is linear in p/Z versus Gp with intercept G", () => {
    const s = demo("gas"),
      pvt = makePVT(s.pvt, s.params, "gas"),
      rows = evaluate(s);
    const fit = linearFit(
      s.history.map((r) => [r.gp, r.pressure! / pvt(r.pressure!).z]),
    );
    expect(fit!.interceptX! / s.params.G).toBeCloseTo(1, 12);
    expect(pzValidity(s, rows)).toEqual([]);
    rows.forEach((r) =>
      expect(r.measured!.p / r.measured!.pvt.z).toBeCloseTo(
        (s.params.pi / pvt(s.params.pi).z) * (1 - r.row.gp / s.params.G),
        9,
      ),
    );
  });
  it("disables p/Z straight-line interpretation for support, pore effects, water production and injection", () => {
    const s = demo("gas");
    s.aquifer = "pot";
    s.params.cf = 1e-6;
    s.history.at(-1)!.wp = 100;
    const reasons = pzValidity(s, evaluate(s));
    expect(reasons).toContain("aquifer support");
    expect(reasons).toContain("rock/connate-water expansion");
    expect(reasons).toContain("water production or injection");
  });
  it("cannot hide inconsistent table Bg/Z data", () => {
    const s = demo("gas"),
      pvt = makePVT(s.pvt, s.params, "gas");
    s.pvt = {
      mode: "table",
      extrapolate: false,
      table: [pvt(1400), pvt(4200)],
    };
    s.pvt.table[0].bg *= 1.2;
    expect(pzValidity(s, evaluate(s))).toContain(
      "PVT Bg and Z/p differ by over 0.5%",
    );
  });
});
describe("aquifer and forward pressure", () => {
  it("None is default; zero storage has no influx; pot supports signed backflow", () => {
    expect(demo("oil").aquifer).toBe("none");
    expect(demo("gas").aquifer).toBe("none");
    expect(waterInflux("pot", 0, 3000, 1000)).toBe(0);
    expect(waterInflux("none", 500, 3000, 1000)).toBe(0);
    expect(waterInflux("pot", 500, 3000, 2000)).toBe(500000);
    expect(waterInflux("pot", 500, 3000, 3100)).toBe(-50000);
  });
  it("recovers a pot-supported oil pressure from explicit known-answer withdrawal", () => {
    const np = (knownOil.support + 500000) / 1.8;
    expect(
      solvePressure(
        { ...fixture, aquifer: "pot" },
        { ...empty, np, gp: 600 * np, wp: 0.1 * np },
        oilPVT,
      ).root,
    ).toBeCloseTo(2000, 4);
  });
  it("uses gas water and pore terms consistently in the pressure solution", () => {
    const a = { ...tank, G: 10e9 },
      p = 2000,
      wp = 50000,
      wi = 10000;
    const support =
      a.G *
        (3 / p -
          3 / a.pi +
          (((3 / a.pi) * (a.cf + a.swi * a.cw)) / (1 - a.swi)) * (a.pi - p)) +
      a.caq * (a.pi - p);
    const gp = (support - wp + wi * a.bwi) / (3 / p);
    const s = {
      ...fixture,
      model: "gas" as const,
      aquifer: "pot" as const,
      params: a,
    };
    expect(solvePressure(s, { ...empty, gp, wp, wi }, gasPVT).root).toBeCloseTo(
      p,
      4,
    );
  });
  it("can solve injection pressures above initial pressure", () => {
    const a = { ...tank, cf: 0, cw: 0, bgi: null },
      gi = a.G / 6;
    expect(
      solvePressure(
        { ...fixture, model: "gas", params: a },
        { ...empty, gi },
        gasPVT,
      ).root,
    ).toBeCloseTo(3500, 4);
  });
  it("reports depleted inventory and PVT coverage failure with no fabricated values", () => {
    const s = demo("gas");
    s.history.at(-1)!.gp = s.params.G * 1.1;
    const bad = evaluate(s).at(-1)!;
    expect(bad.predicted).toBeNull();
    expect(bad.error).toContain("No pressure root");
    const t = demo("gas"),
      pv = makePVT(t.pvt, t.params, "gas");
    t.pvt = { mode: "table", extrapolate: false, table: [pv(3500), pv(4200)] };
    expect(evaluate(t).at(-1)!.error).toContain("PVT range");
  });
  it("detects invalid, nonfinite and nonconvergent root functions", () => {
    expect(() => bisect(() => NaN, 1, 2)).toThrow("Nonfinite");
    expect(() => bisect((p) => p - 0.3, 0, 1, 1e-15, 1)).toThrow(
      "failed to converge",
    );
  });
  it("survey exclusion changes metrics but never volume history or predicted pressures", () => {
    const s = demo(),
      before = JSON.stringify(s.history.map(({ use: _, ...rest }) => rest));
    const first = evaluate(s);
    s.history = s.history.map((r, i) => (i === 3 ? { ...r, use: false } : r));
    const after = evaluate(s);
    expect(JSON.stringify(s.history.map(({ use: _, ...rest }) => rest))).toBe(
      before,
    );
    expect(first.map((r) => r.predicted)).toEqual(
      after.map((r) => r.predicted),
    );
    expect(metrics(after).count).toBe(metrics(first).count - 1);
  });
  it("computes residuals as calculated minus measured and counts unsolved surveys", () => {
    const s = demo("gas");
    s.history[1].pressure! += 20;
    expect(evaluate(s)[1].residual).toBeCloseTo(-20, 4);
    s.history.at(-1)!.gp = s.params.G * 1.1;
    expect(metrics(evaluate(s))).toMatchObject({ count: 17, solved: 16 });
  });
});
describe("PVT and dimensional conversion", () => {
  it("Sutton matches hand-calculated pseudo-critical values", () => {
    expect(sutton(0.7).tpc).toBeCloseTo(377.59, 10);
    expect(sutton(0.7).ppc).toBeCloseTo(663.336, 10);
  });
  it("DAK agrees with a published gas-chart check and rejects unsupported range", () => {
    expect(dakZ(1.5, 1.5)).toBeCloseTo(0.8593, 3);
    expect(() => dakZ(1, 1)).toThrow("DAK requires");
    expect(() => dakZ(31, 1.5)).toThrow("DAK requires");
  });
  it("VB Bo and Rs are continuous at Pb with saturated and undersaturated behavior", () => {
    const a = demo().params,
      below = correlationPVT(a.pb - 0.0001, a),
      at = correlationPVT(a.pb, a),
      above = correlationPVT(a.pb + 0.0001, a);
    expect(at.rs).toBe(a.rsi);
    expect(above.rs).toBe(a.rsi);
    expect(below.bo).toBeCloseTo(at.bo, 6);
    expect(above.bo).toBeCloseTo(at.bo, 6);
    expect(correlationPVT(a.pb * 1.5, a).bo).toBeLessThan(at.bo);
    const rs = a.rsi * (2000 / a.pb) ** 1.187;
    const bo =
      1 +
      4.67e-4 * rs +
      (((a.temperature - 60) * a.api) / a.gasGravity) *
        (1.1e-5 + 1.337e-9 * rs);
    expect(correlationPVT(2000, a).bo).toBeCloseTo(bo, 12);
  });
  it("calibrates gas Zi while preserving Bg proportional to Z/p", () => {
    const a = { ...demo("gas").params, zi: 0.9 },
      v = gasCorrelationPVT(a.pi, a);
    expect(v.z).toBeCloseTo(0.9, 12);
    expect(v.bg).toBeCloseTo(
      (0.005035 * 0.9 * (a.temperature + 459.67)) / a.pi,
      14,
    );
  });
  it("linearly interpolates exact properties, rejects extrapolation, permits explicit opt-in", () => {
    const table = validateTable([oilPVT(3000), oilPVT(2000)]),
      v = interpolatePVT(2500, table);
    expect(v.bo).toBeCloseTo(1.25, 12);
    expect(v.rs).toBe(500);
    expect(v.bg).toBeCloseTo(0.0015, 12);
    expect(interpolatePVT(2000, table)).toEqual(table[0]);
    expect(interpolatePVT(3000, table)).toEqual(table[1]);
    expect(() => interpolatePVT(1500, table)).toThrow("outside PVT range");
    expect(interpolatePVT(1500, table, true).rs).toBe(300);
    expect(() => validateTable([oilPVT(3000), oilPVT(3000)])).toThrow(
      "Duplicate",
    );
  });
  it("uses uploaded table data in both diagnostics and forward solver", () => {
    const s = demo(),
      custom = makePVT(s.pvt, s.params, s.model);
    s.pvt = {
      mode: "table",
      extrapolate: false,
      table: [custom(1000), custom(2800), custom(4200), custom(5500)],
    };
    const v = makePVT(s.pvt, s.params, "oil")(2600),
      row = s.history[8];
    const b = oilBalance(2600, row, s.params, () => v, "none");
    // A changed table must change both the measured audit and predictions.
    const old = evaluate(s);
    s.pvt.table[1].bo += 0.05;
    const next = evaluate(s);
    expect(b.pvt.bo).toBe(v.bo);
    expect(next[8].measured!.pvt.bo).not.toBe(old[8].measured!.pvt.bo);
    expect(next[8].predicted).not.toBe(old[8].predicted);
  });
  it("converts FIELD ↔ METRIC including pressure, temperature, Bg and compressibility", () => {
    expect(fromField(1, "liquid", "METRIC")).toBeCloseTo(0.158987294928, 12);
    expect(fromField(1, "gas", "METRIC")).toBeCloseTo(0.028316846592, 12);
    expect(fromField(212, "temperature", "METRIC")).toBe(100);
    for (const q of [
      "pressure",
      "liquid",
      "gas",
      "temperature",
      "compressibility",
      "storage",
      "rs",
      "bg",
      "dimensionless",
    ] as const)
      expect(toField(fromField(123.456, q, "METRIC"), q, "METRIC")).toBeCloseTo(
        123.456,
        10,
      );
    expect(fromField(0.001, "bg", "METRIC")).toBeCloseTo(0.005614583333, 10);
  });
  it("regression is explicitly origin-constrained and degenerate points have no fit", () => {
    expect(
      originSlope([
        [1, 2],
        [2, 4],
      ]),
    ).toBe(2);
    expect(originSlope([[0, 0]])).toBeNull();
    expect(
      linearFit([
        [1, 2],
        [1, 3],
      ]),
    ).toBeNull();
  });
});
