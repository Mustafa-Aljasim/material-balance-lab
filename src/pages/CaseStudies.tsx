import { useMemo, useState } from "react";
import type { Scenario } from "../types";
import {
  learningCases,
  benchmarkAudit,
  benchmarkScenario,
} from "../data/benchmarks";
import { demo } from "../data/demo";
import { DiagnosticCharts, fmt } from "./Overview";
import { roundingSensitivity } from "../engineering/gasCapRegression";
import { GasCapAnalysis } from "../components/GasCapAnalysis";
import { Inspector } from "../components/Inspector";
import { makePVT } from "../engineering/pvt";
import { solvePressure } from "../engineering/pressureSolver";
import { historyLabel } from "../engineering/observation";
import { download } from "../engineering/project";
import { serializeCSV } from "../engineering/history";
function supportTrial(caq: number) {
  const s = demo("oil");
  s.params = {
    ...s.params,
    pi: 3000,
    pb: 1500,
    N: 10e6,
    m: 0,
    cf: 0,
    cw: 0,
    caq,
    bw: 1,
  };
  s.pvt = {
    mode: "table",
    oilMode: "undersaturated",
    extrapolate: false,
    source: "Independent artificial linear-Bo test, not SABA PVT",
    table: [
      { pressure: 1500, bo: 1.35, rs: null, bg: null, bw: 1, z: null },
      { pressure: 3000, bo: 1.2, rs: null, bg: null, bw: 1, z: null },
    ],
  };
  s.history = [
    {
      id: "support-test",
      date: "",
      observation: "Controlled test (no field date)",
      np: 1e6,
      gp: 0,
      wp: 0,
      wi: 0,
      gi: 0,
      pressure: null,
      use: true,
    },
  ];
  const pvt = makePVT(s.pvt, s.params, "oil");
  s.aquifer = "none";
  const none = solvePressure(s, s.history[0], pvt).root;
  s.aquifer = "pot";
  const pot = solvePressure(s, s.history[0], pvt).root;
  return { none, pot, We: caq * (3000 - pot) };
}
export function CaseStudies({ openCase }: { openCase: (s: Scenario) => void }) {
  const [id, setId] = useState("virginia"),
    [rawEdits, setRawEdits] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [ack, setAck] = useState(false),
    [caq, setCaq] = useState(500);
  const c = learningCases.find((c) => c.id === id)!,
    base = useMemo(() => {
      try {
        return { scenario: benchmarkScenario(id, applied[id]), error: "" };
      } catch (e) {
        return { scenario: null, error: (e as Error).message };
      }
    }, [id, applied]),
    s = base.scenario;
  let audit: ReturnType<typeof benchmarkAudit> | null = null,
    auditError = "";
  try {
    if (s) audit = benchmarkAudit(s);
  } catch (e) {
    auditError = (e as Error).message;
  }
  const rounding = useMemo(
    () => (id === "dake" && s && audit ? roundingSensitivity(s) : null),
    [id, s],
  );
  const edited = !!applied[id],
    status = edited ? "PARTIAL_VALIDATION" : c.status;
  const comparison = useMemo(
    () =>
      learningCases.map((item) => {
        const sample = benchmarkScenario(item.id);
        const a = sample ? benchmarkAudit(sample) : null;
        return {
          id: item.id,
          status: item.status,
          calculated:
            item.id === "virginia"
              ? `${fmt(a!.N! / 1e6, 5)} MMSTB`
              : item.id === "dake"
                ? `${fmt(a!.N! / 1e6, 5)} MMSTB (m=.5)`
                : item.id === "iraq"
                  ? `${fmt(a!.rows[0].measured!.F / 1e6, 8)} MMrb (2000 F)`
                  : "Exact field model unavailable",
          expected:
            item.id === "virginia"
              ? "257 MMSTB (printed)"
              : item.id === "dake"
                ? "≈115 MMSTB"
                : item.id === "iraq"
                  ? "23.01567 MMrb (F check)"
                  : "23.371 million m³; RMSE 2.306568",
          difference:
            item.id === "virginia"
              ? "+25.82907 MMSTB (+10.0502%)"
              : item.id === "dake"
                ? "-0.43927 MMSTB (−0.382%)"
                : item.id === "iraq"
                  ? "+0.00000193 MMrb (rounding)"
                  : "Not comparable without full input history",
        };
      }),
    [],
  );
  let trial: ReturnType<typeof supportTrial> | null = null,
    trialError = "";
  try {
    if (id === "saba") trial = supportTrial(caq);
  } catch (e) {
    trialError = (e as Error).message;
  }
  return (
    <div className="case-studies">
      <div className="page-title">
        <div>
          <span className="eyebrow">EVIDENCE BEFORE INTERPRETATION</span>
          <h2>Engineering QC & Case Studies</h2>
          <p>
            Source tables, arithmetic checkpoints and modelling assumptions are
            separate validation claims.
          </p>
        </div>
      </div>
      <div className="case-selector">
        {learningCases.map((item) => (
          <button
            key={item.id}
            className={id === item.id ? "active" : ""}
            onClick={() => {
              setId(item.id);
              setSelected(null);
              setAck(false);
              setError("");
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="section-heading">
          <h3>{c.name}</h3>
          <span className={`validation-status ${status.toLowerCase()}`}>
            {status}
          </span>
        </div>
        <a href={c.url} target="_blank" rel="noreferrer">
          {c.source} ↗
        </a>
        <p className="interpretation">{c.objective}</p>
        <div className="qc-columns">
          <div>
            <h3>Declared assumptions</h3>
            <ul>
              {c.assumptions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Missing inputs / limitations</h3>
            <ul>
              {c.missing.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="notice soft">
          <strong>Published:</strong> {c.published}
        </p>
        {id === "virginia" && (
          <p className="notice warning">
            Raw-history through-origin fit is 282.829065946 MMSTB, 10.0502%
            above 257. Early ratios and the later linear slope are not
            identical. Origin-constrained least squares, unconstrained intercept
            fitting, point selection and tabulated rounding are different
            conventions; rounding alone does not establish 257. The ≈283.82
            rounded-column result is reported in the task brief; without its
            exact rounded-column transcription it is not independently certified
            here. No adjustment is made to force 257.
          </p>
        )}
        {id === "dake" && (
          <p className="notice soft">
            PASS applies to term arithmetic and the approximate fixed-m
            exercise, not uniqueness of both parameters. A free intercept fit
            gives N≈108.70273 MMSTB and m≈0.541202. At fixed m=.4/.5/.6,
            through-origin slopes are approximately 132.26377 / 114.56073 /
            101.03664 MMSTB. Inspect correlation and leave-one-out sensitivity
            below.
          </p>
        )}
        {id === "iraq" && (
          <p className="notice warning">
            PARTIAL_VALIDATION: printed Rp yields decreasing derived Gp and Bg
            rises sharply across a narrow pressure range. Rowwise F/Eo/Eg⁰ can
            be audited. The displayed no-cap/no-aquifer/zero-compressibility
            slope is only an exploratory baseline; calibrated OOIP
            1237.3/1245.66 MMSTB cannot be asserted from these assumptions.
          </p>
        )}
      </section>
      {(error || base.error || auditError) && (
        <p role="alert" className="notice error">
          {error || base.error || auditError}
        </p>
      )}
      {s && audit && (
        <>
          <section className="card">
            <div className="section-heading">
              <h3>Reproduced input & calculation audit</h3>
              <button
                onClick={() =>
                  download(
                    serializeCSV(
                      audit!.rows.map((r) => ({
                        Observation: historyLabel(r.row),
                        Pressure_psia: r.row.pressure,
                        Np_STB: r.row.np,
                        Gp_scf: r.row.gp,
                        Wp_STB: r.row.wp,
                        F_rb: r.measured?.F,
                        Eo_rb_STB: r.measured?.Eo,
                        Eg0_rb_STB: r.measured?.EgBase,
                        Eg_m_weighted: r.measured?.Eg,
                        Efw: r.measured?.Efw,
                        Et: r.measured?.Et,
                        Warning: r.error ?? "",
                      })),
                    ),
                    `${id}-audit.csv`,
                    "text/csv",
                  )
                }
              >
                Download audit CSV
              </button>
            </div>
            <p>
              Through-origin baseline N ={" "}
              <strong>
                {fmt(audit.N === null ? null : audit.N / 1e6, 8)} MMSTB
              </strong>
              . This is a graphical calculation at measured pressure, not a
              pressure match.
            </p>
            {audit.issues.length > 0 && (
              <div className="notice warning">
                {audit.issues.map((x) => (
                  <p key={x}>{x}</p>
                ))}{" "}
                Forward simulation/Auto Match are blocked until
                cumulative-history QC is resolved; printed values are preserved.
              </div>
            )}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Observation</th>
                    <th>p (psia)</th>
                    <th>F (MMrb)</th>
                    <th>Eo (rb/STB)</th>
                    <th>Eg⁰ (rb/STB)</th>
                    <th>Efw (rb/STB)</th>
                    <th>Et (rb/STB)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((r) => (
                    <tr key={r.row.id}>
                      <td>{historyLabel(r.row)}</td>
                      <td>{fmt(r.row.pressure, 3)}</td>
                      <td>{fmt(r.measured ? r.measured.F / 1e6 : null, 8)}</td>
                      <td>{fmt(r.measured?.Eo, 9)}</td>
                      <td>{fmt(r.measured?.EgBase, 9)}</td>
                      <td>
                        {id === "iraq"
                          ? "Not established (baseline 0)"
                          : fmt(r.measured?.Efw, 9)}
                      </td>
                      <td>{fmt(r.measured?.Et, 9)}</td>
                      <td>
                        <button onClick={() => setSelected(r.row.id)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {rounding && (
            <section className="card">
              <h3>Dake printed-digit rounding sensitivity</h3>
              <p>
                Each Bo, Rs or Bg cell (including initial PVT) is perturbed
                separately by ± half its last printed digit: 0.00005 rb/STB, 0.5
                scf/STB or 0.000005 rb/scf. {rounding.trials} resolved trials;{" "}
                {rounding.rejected} unresolved; {rounding.nonphysical}{" "}
                nonphysical joint fits retained for diagnosis.
              </p>
              <p>
                Fixed m=.5 N range:{" "}
                {rounding.fixedN?.map((v) => fmt(v / 1e6, 6)).join(" – ")}{" "}
                MMSTB. Joint-fit N range:{" "}
                {rounding.jointN?.map((v) => fmt(v / 1e6, 6)).join(" – ")}{" "}
                MMSTB; m range: {rounding.m?.map((v) => fmt(v, 6)).join(" – ")}.
              </p>
              <p className="micro">
                One cell at a time; this is neither a simultaneous uncertainty
                envelope nor a confidence interval. The unconstrained intercept
                is especially sensitive because the observations are strongly
                correlated.
              </p>
            </section>
          )}
          <DiagnosticCharts s={s} rows={audit.rows} inspect={setSelected} />
          <GasCapAnalysis s={s} rows={audit.rows} inspect={setSelected} />
        </>
      )}
      {id !== "saba" && (
        <>
          <section className="card">
            <h3>Edit a temporary source copy</h3>
            <p className="micro">
              Units remain in the CSV header. Edited data is labelled partial
              validation and does not replace the published fixture or any saved
              reservoir model.
            </p>
            <textarea
              aria-label="Editable benchmark source CSV"
              rows={7}
              value={rawEdits[id] ?? applied[id] ?? c.raw!}
              onChange={(e) =>
                setRawEdits({ ...rawEdits, [id]: e.target.value })
              }
            />
            <div className="button-row">
              <button
                onClick={() => {
                  setApplied({ ...applied, [id]: rawEdits[id] ?? c.raw! });
                  setError("");
                }}
              >
                Recalculate edited table
              </button>
              <button
                onClick={() => {
                  const next = { ...applied };
                  delete next[id];
                  setApplied(next);
                  const raw = { ...rawEdits };
                  delete raw[id];
                  setRawEdits(raw);
                  setError("");
                }}
              >
                Restore source fixture
              </button>
              <button onClick={() => download(c.raw!, c.filename!, "text/csv")}>
                Download original CSV
              </button>
            </div>
            {id === "iraq" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />{" "}
                I understand that m=0, no aquifer, zero pore effects and Pb=pi
                are only an exploratory baseline; published cumulative
                inconsistencies remain flagged.
              </label>
            )}
            <button
              className="primary-button"
              disabled={!s || !audit || (id === "iraq" && !ack)}
              onClick={() =>
                s &&
                openCase({
                  ...s,
                  display: { ...s.display, tab: "Material Balance" },
                })
              }
            >
              Open temporary working scenario
            </button>
          </section>
        </>
      )}
      {id === "saba" && (
        <>
          <section className="card">
            <h3>What the source establishes</h3>
            <p className="interpretation">
              Reservoir X: Pi 330.8 bar (table rounds to 4801 psi), T 140 °C,
              Swi 21.6%, initial OOIP 22.199 million m³, aquifer volume 460×10³
              m³, reported water-inflow constant 228.4 m³/bar, oil FVF 1.93
              m³/Sm³. These aggregates do not supply pressure-dependent PVT or
              the dated withdrawal/injection history. The water-inflow constant
              is not silently equated to this lab’s Caq. The small-pot result is
              from the single-tank analysis; the later fault/transmissibility
              exercise is a separate multi-tank calculation.
            </p>
            <span className="validation-status unsupported_model">
              UNSUPPORTED_MODEL · transient aquifers / multiple tanks
            </span>
            <p className="micro">
              No SABA production dates or pressure points have been digitized or
              invented. Upload complete source data through Reference Exercise
              import to investigate a declared supported model.
            </p>
          </section>
          <section className="card">
            <h3>Independent synthetic Pot support verification</h3>
            <p className="interpretation">
              Not SABA history or a calibrated SABA fluid. Artificial Bo = 1.2 +
              0.0001(3000−p), N=10 MMSTB, Np=1 MMSTB, no
              cap/rock/water/injection. Analytic Δp = 1,200,000 / (900 + Caq).
              This independently checks support direction and magnitude against
              the forward solver.
            </p>
            <label>
              Trial Caq (rb/psi)
              <input
                aria-label="Synthetic support Caq"
                type="number"
                min="0"
                step="any"
                value={caq}
                onChange={(e) => setCaq(Number(e.target.value))}
              />
            </label>
            {trialError ? (
              <p className="notice error">{trialError}</p>
            ) : (
              trial && (
                <div className="metric-line">
                  None <strong>{fmt(trial.none, 6)} psia</strong>Pot{" "}
                  <strong>{fmt(trial.pot, 6)} psia</strong>Support gain{" "}
                  <strong>{fmt(trial.pot - trial.none, 6)} psi</strong>We{" "}
                  <strong>{fmt(trial.We, 3)} rb</strong>
                </div>
              )
            )}
          </section>
        </>
      )}
      <section className="card">
        <h3>Four-case comparison</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Benchmark</th>
                <th>Expected / published</th>
                <th>Calculated</th>
                <th>Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => (
                <tr key={r.id}>
                  <td>{learningCases.find((c) => c.id === r.id)!.name}</td>
                  <td>{r.expected}</td>
                  <td>{r.calculated}</td>
                  <td>{r.difference}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="micro">
          A passing arithmetic checkpoint never upgrades an incomplete
          field-model reconstruction to PASS. Status FAIL is reserved for a
          failed numerical acceptance check. Data sufficiency and unsupported
          physics are separate categories.
        </p>
      </section>
      {selected && s && audit && (
        <Inspector
          selected={selected}
          rows={audit.rows}
          s={s}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}
