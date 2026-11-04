import { describe, expect, it } from "vitest";
import { demo } from "../data/demo";
import { evaluate, metrics } from "../engineering/diagnostics";
import { bisect } from "../engineering/pressureSolver";
describe("Stage 1 independently generated depletion fixtures", () => {
  for (const model of ["oil", "gas"] as const) {
    it(`${model}: recovers every prescribed pressure without using measurements`, () => {
      const s = demo(model),
        known = s.history.map((r) => r.pressure!);
      s.history.forEach((r) => {
        r.pressure = 999;
        r.use = false;
      });
      const rows = evaluate(s);
      rows.forEach((r, i) => {
        expect(r.error).toBeUndefined();
        expect(r.predicted).toBeCloseTo(known[i], 4);
      });
    });
    it(`${model}: exact demo closes and starts at pi`, () => {
      const s = demo(model),
        rows = evaluate(s);
      expect(rows[0].predicted).toBe(s.params.pi);
      expect(metrics(rows).rmse).toBeLessThan(1e-5);
      rows.forEach((r) =>
        expect(Math.abs(r.measured!.closure)).toBeLessThan(0.001),
      );
    });
  }
  it("reports unbracketed and nonconvergent roots", () => {
    expect(() => bisect((x) => x * x + 1, 0, 2)).toThrow("not bracketed");
    expect(() => bisect((x) => x - Math.PI, 0, 4, 1e-20, 2)).toThrow(
      "failed to converge",
    );
  });
});
