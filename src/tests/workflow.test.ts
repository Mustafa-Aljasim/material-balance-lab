import { describe, expect, it } from "vitest";
import {
  historyIssues,
  importHistory,
  integrateRates,
  normalizeDate,
  parseTable,
  serializeCSV,
} from "../engineering/history";
import type { ImportOptions, RateRow } from "../engineering/history";
import { demo } from "../data/demo";
import {
  historyExport,
  parseProject,
  resultsCSV,
} from "../engineering/project";
import { evaluate } from "../engineering/diagnostics";
const rates: RateRow[] = [
  {
    date: "2020-01-01",
    qo: 10,
    qg: 100,
    qw: 3,
    qi: 4,
    qgi: 5,
    pressure: 3000,
    use: true,
  },
  {
    date: "2020-01-11",
    qo: 20,
    qg: 200,
    qw: 5,
    qi: 6,
    qgi: 7,
    pressure: null,
    use: false,
  },
  {
    date: "2020-02-10",
    qo: 30,
    qg: 300,
    qw: 8,
    qi: 9,
    qgi: 10,
    pressure: 2000,
    use: true,
  },
];
const o: ImportOptions = {
  format: "cumulative",
  mapping: {
    Date: "Date",
    Np: "Np",
    Gp: "Gp",
    Wp: "Wp",
    Wi: "Wi",
    Gi: "Gi",
    Pressure: "Pressure",
    Use: "Use",
  },
  liquidUnit: "STB",
  gasUnit: "scf",
  pressureUnit: "psia",
  integration: "interval-end",
  model: "oil",
};
describe("time-aware history workflows", () => {
  it("integrates interval-ending rates over unequal calendar intervals", () => {
    const r = integrateRates(rates, "interval-end");
    expect(r[0].np).toBe(0);
    expect(r[1].np).toBe(200);
    expect(r[2].np).toBe(1100);
    expect(r[2].gp).toBe(11000);
    expect(r[2].wp).toBe(290);
    expect(r[2].wi).toBe(330);
    expect(r[2].gi).toBe(370);
    expect(r[1].pressure).toBeNull();
    expect(r[1].use).toBe(false);
  });
  it("trapezoidal integration gives the correct area, never an average cumulative", () => {
    expect(integrateRates(rates, "trapezoidal")[2].np).toBe(900);
  });
  it("handles leap days by UTC elapsed days", () => {
    const r = integrateRates(
      [
        { ...rates[0], date: "2020-02-28" },
        { ...rates[1], date: "2020-03-01" },
      ],
      "interval-end",
    );
    expect(r[1].np).toBe(40);
  });
  it("maps pasted Excel TSV and converts independently selected units", () => {
    const t = parseTable(
      "When\tOil\tGas\tP\n1/1/2020\t0\t0\t20\n2/1/2020\t2\t5\t18",
    );
    const rows = importHistory(t, {
      ...o,
      mapping: { Date: "When", Np: "Oil", Gp: "Gas", Pressure: "P" },
      liquidUnit: "MSTB",
      gasUnit: "MMscf",
      pressureUnit: "MPa(a)",
    });
    expect(rows[1].np).toBe(2000);
    expect(rows[1].gp).toBe(5e6);
    expect(rows[1].pressure).toBeCloseTo(2610.6792791, 4);
    expect(rows[1].wp).toBe(0);
  });
  it("preserves supplied cumulative volumes exactly", () => {
    const t = parseTable("Date,Np\n2020-01-01,100\n2020-02-01,300");
    expect(
      importHistory(t, { ...o, mapping: { Date: "Date", Np: "Np" } }).map(
        (r) => r.np,
      ),
    ).toEqual([100, 300]);
  });
  it("flags duplicate dates, missing cells, impossible pressures, date rollover and declining cumulatives", () => {
    expect(() => normalizeDate("2020-02-30")).toThrow("Invalid date");
    expect(() =>
      importHistory(parseTable("Date,Np\n2020-01-01,0\n2020-01-01,1"), {
        ...o,
        mapping: { Date: "Date", Np: "Np" },
      }),
    ).toThrow("duplicate");
    expect(() =>
      importHistory(parseTable("Date,Np\n2020-01-01,"), {
        ...o,
        mapping: { Date: "Date", Np: "Np" },
      }),
    ).toThrow("missing");
    const s = demo();
    s.history[1].np = -1;
    s.history[2].pressure = -1;
    s.history[3].gp = 0;
    expect(historyIssues(s.history).join(" ")).toMatch(
      /nonnegative.*pressure.*cumulative decreases/,
    );
  });
  it("rejects duplicate mappings and malformed CSV columns", () => {
    expect(() =>
      importHistory(parseTable("Date,Np\n2020-01-01,0"), {
        ...o,
        mapping: { Date: "Date", Np: "Np", Gp: "Np" },
      }),
    ).toThrow("only be mapped once");
    expect(() => parseTable("Date,Np\n2020-01-01,0,5")).toThrow(
      "different number",
    );
  });
});
describe("project and export integrity", () => {
  it("JSON round trip includes PVT, units, survey flags and display configuration", () => {
    const s = demo("gas");
    s.history[3].use = false;
    s.units = "METRIC";
    s.display.tab = "Material Balance";
    s.display.extrapolatePz = true;
    expect(parseProject(JSON.stringify(s))).toEqual(s);
  });
  it("rejects malformed projects and nonfinite/missing production values", () => {
    expect(() => parseProject("{")).toThrow();
    expect(() => parseProject("{}")).toThrow("Invalid project");
    const s = demo();
    (s.params as unknown as Record<string, unknown>).N = "85";
    expect(() => parseProject(JSON.stringify(s))).toThrow(
      "Invalid numeric parameter N",
    );
    const t = demo();
    t.history[1].gp = NaN;
    expect(() => parseProject(JSON.stringify(t))).toThrow(
      "Invalid project history",
    );
  });
  it("history CSV is reimportable without changing field volumes or active flags", () => {
    const s = demo();
    s.history[5].use = false;
    const text = resultsCSV(s, evaluate(s));
    expect(text).toContain("Residual_calc_minus_meas_psia");
    const exported = historyExport(s);
    const back = importHistory(parseTable(serializeCSV(exported)), o);
    back.forEach((r, i) => {
      expect(r.np).toBe(s.history[i].np);
      expect(r.gp).toBe(s.history[i].gp);
      expect(r.use).toBe(s.history[i].use);
    });
  });
});
