import { historyLabel } from "../engineering/observation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PVT, Scenario, SolvedRow } from "../types";
import { makePVT } from "../engineering/pvt";
import { MathBlock } from "./Math";
import { Methodology } from "../pages/Methodology";
const n = (x: number | null) =>
  x === null
    ? "not supplied"
    : Math.abs(x) < 1e-8 && x !== 0
      ? x.toExponential(8)
      : Number(x.toPrecision(12)).toString();
export function Inspector({
  s,
  selected,
  rows,
  close,
}: {
  s: Scenario;
  selected: string;
  rows: SolvedRow[];
  close: () => void;
}) {
  const [source, setSource] = useState<"measured" | "predicted">(
      selected.startsWith("predicted:") ? "predicted" : "measured",
    ),
    ref = useRef<HTMLElement>(null);
  const row = rows.find(
    (r) => r.row.id === selected.replace(/^predicted:/, ""),
  );
  const b =
    source === "predicted" || !row?.measured
      ? row?.predictedBalance
      : row?.measured;
  let v: PVT | undefined = b?.pvt,
    error = "";
  if (selected.startsWith("pvt:"))
    try {
      v = makePVT(s.pvt, s.params, s.model)(Number(selected.slice(4)));
    } catch (e) {
      error = (e as Error).message;
    }
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const elements = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, [close]);
  const a = s.params;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal inspector"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
      >
        <button
          className="close-modal"
          aria-label="Close Equation Inspector"
          onClick={close}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">FOLLOW THE NUMBERS</span>
        <h2 id="inspector-title">Equation Inspector</h2>
        <p className="modal-intro">
          {row
            ? `${historyLabel(row.row)} · ${row.row.use ? "Active survey" : "Excluded survey"}`
            : selected.startsWith("pvt:")
              ? "Selected PVT sample"
              : "Model reference equation"}{" "}
          · Calculation audit in canonical field units
        </p>
        {row && (
          <div className="segmented inspector-toggle">
            <button
              className={source === "measured" ? "active" : ""}
              disabled={!row.measured}
              onClick={() => setSource("measured")}
            >
              At measured pressure
            </button>
            <button
              className={source === "predicted" ? "active" : ""}
              disabled={!row.predictedBalance}
              onClick={() => setSource("predicted")}
            >
              At predicted pressure
            </button>
          </div>
        )}
        {error && <p className="notice error">{error}</p>}
        {row?.error && <p className="notice warning">{row.error}</p>}
        {v && (
          <>
            <h3>PVT values actually used</h3>
            <div className="audit-grid">
              {[
                ["Pressure", v.pressure, "psia"],
                ["Bo", v.bo, "rb/STB"],
                ["Rs", v.rs, "scf/STB"],
                ["Bg", v.bg, "rb/scf"],
                ["Bw", v.bw, "rb/STB"],
                ["Z", v.z, "dimensionless"],
              ].map(([label, value, u]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>
                    {value === null ? "Not supplied" : n(Number(value))}
                  </strong>
                  <small>{u}</small>
                </div>
              ))}
            </div>
            <p className="micro">
              Source:{" "}
              {s.pvt.mode === "table"
                ? `piecewise-linear table interpolation${s.pvt.extrapolate ? "; extrapolation enabled" : "; extrapolation disabled"}`
                : s.model === "oil"
                  ? "Rsi/Pb-calibrated Vasquez–Beggs; Sutton–DAK; constant entered Bw"
                  : "Sutton–DAK; constant entered Bw"}
              .
            </p>
          </>
        )}
        {b && row && (
          <>
            <h3>Withdrawal & expansion</h3>
            <p className="micro">
              Np = {n(row.row.np)} STB · Gp ={" "}
              {b.simplifiedOil
                ? "not supplied; associated gas cancels in this formulation"
                : `${n(row.row.gp)} scf`}{" "}
              · Wp = {n(row.row.wp)} STB · Wi = {n(row.row.wi)} STB · Gi ={" "}
              {n(row.row.gi)} scf. Rp ={" "}
              {b.simplifiedOil
                ? "not established from Bo-only inputs"
                : b.rp === null
                  ? "undefined at Np = 0; expanded F remains valid"
                  : `${n(b.rp)} scf/STB`}
              .
            </p>
            {b.simplifiedOil ? (
              <>
                <div className="notice soft">
                  Above-Pb Bo-only balance. Constant associated solution gas
                  cancels; Rs, Bg and Z were not supplied and are not
                  fabricated.
                </div>
                <MathBlock equation="F=N_p B_o+W_p B_w-W_i B_{wi}" />
                <div className="worked">
                  {n(row.row.np)} × {n(b.pvt.bo)} + {n(row.row.wp)} ×{" "}
                  {n(b.pvt.bw)} − {a.injection ? n(row.row.wi * a.bwi) : "0"} ={" "}
                  {n(b.F)} rb
                </div>
                <MathBlock equation="E_o=B_o-B_{oi}" />
                <div className="worked">
                  {n(b.pvt.bo)} − {n(b.initial.bo)} = {n(b.Eo)} rb/STB. Gas-cap
                  contribution = 0 because m = 0, not an inferred Bg.
                </div>
              </>
            ) : (
              <>
                <MathBlock
                  equation={
                    s.model === "oil"
                      ? "F=N_p B_o+(G_p-N_p R_s)B_g+W_p B_w-W_iB_{w,inj}-G_iB_{g,inj}"
                      : "F=G_pB_g+W_pB_w-W_iB_{w,inj}-G_iB_{g,inj}"
                  }
                />
                <div className="worked">
                  {s.model === "oil"
                    ? `${n(row.row.np)} × ${n(b.pvt.bo)} + (${n(row.row.gp)} − ${n(row.row.np)} × ${n(b.pvt.rs)}) × ${n(b.pvt.bg)}`
                    : `${n(row.row.gp)} × ${n(b.pvt.bg)}`}{" "}
                  + {n(row.row.wp)} × {n(b.pvt.bw)} −{" "}
                  {a.injection
                    ? `${n(row.row.wi)} × ${n(a.bwi)} − ${n(row.row.gi)} × ${n(a.bgi ?? b.pvt.bg)}`
                    : "0 (injection excluded)"}{" "}
                  = <strong>{n(b.F)} rb</strong>
                </div>
                {s.model === "oil" ? (
                  <>
                    <MathBlock equation={"E_o=(B_o-B_{oi})+(R_{si}-R_s)B_g"} />
                    <div className="worked">
                      ({n(b.pvt.bo)} − {n(b.initial.bo)}) + ({n(b.initial.rs)} −{" "}
                      {n(b.pvt.rs)}) × {n(b.pvt.bg)} ={" "}
                      <strong>{n(b.Eo)} rb/STB</strong>
                    </div>
                    <MathBlock equation={"E_g=m B_{oi}(B_g/B_{gi}-1)"} />
                    <div className="worked">
                      {n(a.m)} × {n(b.initial.bo)} × ({n(b.pvt.bg)} /{" "}
                      {n(b.initial.bg)} − 1) = <strong>{n(b.Eg)} rb/STB</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <MathBlock equation={"E_g=B_g-B_{gi}"} />
                    <div className="worked">
                      {n(b.pvt.bg)} − {n(b.initial.bg)} ={" "}
                      <strong>{n(b.Eg)} rb/scf</strong>
                    </div>
                  </>
                )}
              </>
            )}
            <MathBlock
              equation={
                s.model === "oil"
                  ? String.raw`E_{fw}=(1+m)B_{oi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p)`
                  : String.raw`E_{fw}=B_{gi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p)`
              }
            />
            <div className="worked">
              {s.model === "oil"
                ? `(1 + ${n(a.m)}) × ${n(b.initial.bo)}`
                : n(b.initial.bg)}{" "}
              × ({n(a.cf)} + {n(a.swi)} × {n(a.cw)}) / (1 − {n(a.swi)}) × (
              {n(a.pi)} − {n(b.p)}) ={" "}
              <strong>
                {n(b.Efw)} {s.model === "oil" ? "rb/STB" : "rb/scf"}
              </strong>
            </div>
            <MathBlock
              equation={String.raw`E_t=E_o+E_g+E_{fw},\qquad W_e=C_{aq}(p_i-p)`}
            />
            <div className="worked">
              Et = {n(b.Eo)} + {n(b.Eg)} + {n(b.Efw)} ={" "}
              <strong>{n(b.Et)}</strong>
              <br />
              We ={" "}
              {s.aquifer === "pot"
                ? `${n(a.caq)} × (${n(a.pi)} − ${n(b.p)})`
                : "0 (aquifer: None)"}{" "}
              = <strong>{n(b.We)} rb</strong>
            </div>
            <MathBlock
              equation={
                s.model === "oil" ? "F_{model}=NE_t+W_e" : "F_{model}=GE_t+W_e"
              }
            />
            <div className="worked">
              {n(s.model === "oil" ? a.N : a.G)} × {n(b.Et)} + {n(b.We)} ={" "}
              <strong>{n(b.support)} rb</strong>
              <br />
              Closure (support − withdrawal) ={" "}
              <strong>{n(b.closure)} rb</strong>
              <br />
              Calculated − measured pressure ={" "}
              <strong>
                {row.residual === null
                  ? "No measured survey / no valid solution"
                  : `${n(row.residual)} psia`}
              </strong>
            </div>
            <p className="micro">
              Numbers are displayed to 12 significant digits; calculations
              retain IEEE-754 double precision. Negative contributions remain
              signed. Initial Rs comes from the selected PVT source, including
              table data.
            </p>
          </>
        )}
        {!row && !selected.startsWith("pvt:") && (
          <Methodology model={s.model} />
        )}
      </section>
    </div>
  );
}
