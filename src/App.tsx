import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronRight,
  Download,
  FlaskConical,
  FolderOpen,
  Menu,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Model, Scenario } from "./types";
import { demo } from "./data/demo";
import { evaluate, metrics, pzValidity } from "./engineering/diagnostics";
import {
  download,
  parseProject,
  PROJECT_KEY,
  resultsCSV,
  TABS,
} from "./engineering/project";
import { Controls } from "./components/Controls";
import { Inspector } from "./components/Inspector";
import {
  Overview,
  DiagnosticCharts,
  PressureCharts,
  fmt,
} from "./pages/Overview";
import { History } from "./pages/History";
import { PVTPage } from "./pages/PVTPage";
import { Drive } from "./pages/Drive";
import { Methodology } from "./pages/Methodology";
import { Chart, colors } from "./charts/Chart";
import { fromField, unit } from "./engineering/units";
function load() {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    return { scenario: raw ? parseProject(raw) : demo(), error: "" };
  } catch (e) {
    return {
      scenario: demo(),
      error: `Saved project could not be restored: ${(e as Error).message}. A synthetic demo is open. The saved copy is retained until you edit or load a case.`,
    };
  }
}
export default function App() {
  const [initial] = useState(load),
    [s, setScenario] = useState<Scenario>(initial.scenario),
    [selected, inspect] = useState<string | null>(null),
    [mobile, setMobile] = useState(false);
  const [message, setMessage] = useState(initial.error),
    [storage, setStorage] = useState(
      initial.error ? "Recovery needed" : "Saved on this device",
    );
  const [dirty, setDirty] = useState(false),
    openRef = useRef<HTMLInputElement>(null);
  const cases = useRef<Partial<Record<Model, Scenario>>>({ [s.model]: s });
  const change = (next: Scenario) => {
    setScenario(next);
    setDirty(true);
  };
  const tab = s.display.tab,
    setTab = (tab: string) => {
      change({ ...s, display: { ...s.display, tab } });
      setMobile(false);
    };
  const closeInspector = useCallback(() => inspect(null), []);
  useEffect(() => {
    if (!dirty) return;
    setStorage("Saving locally…");
    const persist = () => {
      try {
        const raw = JSON.stringify(s);
        parseProject(raw);
        localStorage.setItem(PROJECT_KEY, raw);
        setStorage("Saved on this device");
      } catch (e) {
        setStorage("Not saved · review inputs");
        setMessage(
          `Automatic save: ${(e as Error).message}. Your previous valid saved case is retained.`,
        );
      }
    };
    const id = setTimeout(persist, 500);
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
    };
  }, [s, dirty]);
  const calculation = useMemo(() => {
    try {
      return { rows: evaluate(s), error: "" };
    } catch (e) {
      return { rows: [], error: (e as Error).message };
    }
  }, [s.model, s.params, s.pvt, s.history, s.aquifer]);
  const rows = calculation.rows,
    met = metrics(rows),
    warnings = rows.filter((r) => r.error);
  let pzWhy: string[] = [];
  if (s.model === "gas" && !calculation.error)
    try {
      pzWhy = pzValidity(s, rows);
    } catch {
      /* Shown by the numerical engine. */
    }
  const switchModel = (m: Model) => {
    if (m === s.model) return;
    cases.current[s.model] = s;
    change({ ...(cases.current[m] ?? demo(m)), units: s.units });
    inspect(null);
    setMobile(false);
  };
  const reset = () => {
    change({ ...demo(s.model), units: s.units });
    inspect(null);
    setMessage("Synthetic demo restored, with aquifer None.");
  };
  const save = () => {
    try {
      const content = JSON.stringify(s, null, 2);
      parseProject(content);
      download(content, "material-balance-project.json");
      setMessage("Project JSON downloaded.");
    } catch (e) {
      setMessage(`Cannot save this case: ${(e as Error).message}`);
    }
  };
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Building2 size={25} />
          </div>
          <div>
            <strong>
              PETROLEUM<span>ACADEMIA</span>
            </strong>
            <small>TOOLS FOR RESERVOIR UNDERSTANDING</small>
          </div>
        </div>
        <div className="top-separator" />
        <div className="product-name">
          Material Balance <span>Lab</span>
          <small>INTERACTIVE RESERVOIR ENGINEERING</small>
        </div>
        <div className="top-tools">
          <div className="segmented" aria-label="Reservoir type">
            {(["oil", "gas"] as const).map((m) => (
              <button
                key={m}
                aria-pressed={s.model === m}
                className={s.model === m ? "active" : ""}
                onClick={() => switchModel(m)}
              >
                {m === "oil" ? "Oil" : "Dry gas"}
              </button>
            ))}
          </div>
          <select
            aria-label="Unit system"
            value={s.units}
            onChange={(e) =>
              change({ ...s, units: e.target.value as Scenario["units"] })
            }
          >
            <option>FIELD</option>
            <option>METRIC</option>
          </select>
          <div className="file-tools">
            <button title="Download full project JSON" onClick={save}>
              <Save size={15} />
              <span>Save</span>
            </button>
            <button
              title="Open project JSON"
              onClick={() => openRef.current?.click()}
            >
              <FolderOpen size={15} />
              <span>Open</span>
            </button>
          </div>
          <input
            ref={openRef}
            type="file"
            hidden
            accept=".json"
            aria-label="Open saved JSON project"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (file) {
                  const next = parseProject(await file.text());
                  change(next);
                  inspect(null);
                  setMessage(`Opened ${next.name}.`);
                }
              } catch (err) {
                setMessage(`Project was not opened: ${(err as Error).message}`);
              }
              e.target.value = "";
            }}
          />
          <button
            className="export-button"
            onClick={() =>
              download(
                resultsCSV(s, rows),
                "material-balance-results.csv",
                "text/csv",
              )
            }
          >
            <Download size={15} />
            <span>Export results</span>
          </button>
          <button
            className="icon-button"
            title="Reset current demo"
            aria-label="Reset demo"
            onClick={reset}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </header>
      <div className="projectbar">
        <div>
          <span className="breadcrumb">
            Workspace <ChevronRight size={12} />
          </span>
          <input
            aria-label="Project name"
            maxLength={200}
            value={s.name}
            onChange={(e) => change({ ...s, name: e.target.value })}
          />
          <span
            className={`pill ${s.source === "synthetic" ? "synthetic" : ""}`}
          >
            <FlaskConical size={12} />
            {s.source === "synthetic"
              ? "Synthetic demo"
              : s.source === "imported"
                ? "Imported history"
                : "Edited history"}
          </span>
        </div>
        <span className="local-status">
          <span className="tiny-dot" />
          {storage}
        </span>
      </div>
      <div className={`workspace ${mobile ? "show-controls" : ""}`}>
        <Controls
          key={s.model + s.units}
          s={s}
          change={change}
          setTab={setTab}
        />
        <main>
          <div className="workspace-header">
            <div>
              <div className="eyebrow">
                RESERVOIR ANALYSIS /{" "}
                {s.model === "oil" ? "BLACK OIL" : "DRY GAS"}
              </div>
              <h1>
                Material Balance Lab<span className="version">v1.0</span>
              </h1>
            </div>
            <button
              className="mobile-toggle"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={17} /> Parameters
            </button>
            <span className="engine-badge">
              <ShieldCheck size={15} /> Deterministic tank model
            </span>
          </div>
          <nav className="tabs" aria-label="Workspace tabs">
            {TABS.map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "Production & Pressure History"
                  ? "Production & Pressure"
                  : t}
              </button>
            ))}
          </nav>
          <div className="page-content">
            {message && (
              <div className="notice message" role="status">
                {message}
                <button
                  title="Dismiss message"
                  aria-label="Dismiss message"
                  onClick={() => setMessage("")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {calculation.error && (
              <div role="alert" className="notice error">
                Calculation paused: {calculation.error}
              </div>
            )}
            {warnings.length > 0 && (
              <details className="notice warning">
                <summary>
                  {warnings.length} history timestep(s) need attention
                </summary>
                {warnings.map((r) => (
                  <p key={r.row.id}>
                    {r.row.date}: {r.error}
                  </p>
                ))}
              </details>
            )}
            {tab === "Dashboard" && !calculation.error && (
              <Overview s={s} rows={rows} inspect={inspect} setTab={setTab} />
            )}
            {tab === "Production & Pressure History" && (
              <History key={s.model} s={s} change={change} inspect={inspect} />
            )}
            {tab === "PVT" && (
              <PVTPage s={s} change={change} inspect={inspect} />
            )}
            {tab === "Material Balance" && (
              <>
                <div className="page-title">
                  <div>
                    <h2>Graphical material balance</h2>
                    <p>
                      Interpret selected pressure surveys against the entered
                      tank model.
                    </p>
                  </div>
                  <div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={s.display.corrected}
                        onChange={(e) =>
                          change({
                            ...s,
                            display: {
                              ...s.display,
                              corrected: e.target.checked,
                            },
                          })
                        }
                      />{" "}
                      Aquifer-corrected diagnostics
                    </label>
                    {s.model === "gas" && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={s.display.extrapolatePz && !pzWhy.length}
                          disabled={!!pzWhy.length}
                          onChange={(e) =>
                            change({
                              ...s,
                              display: {
                                ...s.display,
                                extrapolatePz: e.target.checked,
                              },
                            })
                          }
                        />{" "}
                        Extrapolate valid p/Z to zero
                      </label>
                    )}
                  </div>
                </div>
                {pzWhy.length > 0 && (
                  <div className="notice warning">
                    Classical volumetric p/Z interpretation is unavailable:{" "}
                    {pzWhy.join("; ")}. The general gas volume balance still
                    predicts pressure.
                  </div>
                )}
                {!calculation.error && (
                  <DiagnosticCharts s={s} rows={rows} inspect={inspect} />
                )}
                <section className="card">
                  <h3>Pressure surveys used in diagnostics</h3>
                  <p className="micro">
                    Selection is shared with the pressure-match objective.
                    Production cumulatives remain unchanged.
                  </p>
                  <div className="survey-selection">
                    {s.history
                      .filter((r) => r.pressure !== null)
                      .map((r) => (
                        <label key={r.id} className="check">
                          <input
                            aria-label={`Include ${r.date} in regression`}
                            type="checkbox"
                            checked={r.use}
                            onChange={(e) =>
                              change({
                                ...s,
                                history: s.history.map((h) =>
                                  h.id === r.id
                                    ? { ...h, use: e.target.checked }
                                    : h,
                                ),
                              })
                            }
                          />
                          {r.date}
                        </label>
                      ))}
                  </div>
                </section>
              </>
            )}
            {tab === "History Match" && (
              <>
                <div className="page-title">
                  <div>
                    <h2>Manual pressure history match</h2>
                    <p>
                      Adjust inventory, gas cap and aquifer storage using the
                      parameter panel.
                    </p>
                  </div>
                  <span className="pill">{met.count} active surveys</span>
                </div>
                <div className="metric-line">
                  RMSE{" "}
                  <strong>
                    {fmt(
                      met.rmse === null
                        ? null
                        : fromField(met.rmse, "pressure", s.units),
                      4,
                    )}{" "}
                    {unit("pressure", s.units)}
                  </strong>{" "}
                  MAE{" "}
                  <strong>
                    {fmt(
                      met.mae === null
                        ? null
                        : fromField(met.mae, "pressure", s.units),
                      4,
                    )}{" "}
                    {unit("pressure", s.units)}
                  </strong>
                  <span>
                    {met.solved}/{met.count} active predictions available
                  </span>
                </div>
                <div className="chart-grid">
                  <PressureCharts s={s} rows={rows} inspect={inspect} />
                  <PressureCharts
                    s={s}
                    rows={rows}
                    inspect={inspect}
                    cumulative
                  />
                </div>
                <Chart
                  title="Pressure residuals"
                  data={[
                    {
                      type: "scatter",
                      mode: "lines+markers",
                      name: "Calculated − measured",
                      x: rows.filter((r) => r.row.use).map((r) => r.row.date),
                      y: rows
                        .filter((r) => r.row.use)
                        .map((r) =>
                          r.residual === null
                            ? null
                            : fromField(r.residual, "pressure", s.units),
                        ),
                      customdata: rows
                        .filter((r) => r.row.use)
                        .map((r) => r.row.id),
                      marker: { color: colors.orange },
                      line: { color: colors.orange, width: 1 },
                    },
                  ]}
                  xTitle="Survey date"
                  yTitle={`Residual (${unit("pressure", s.units)})`}
                  onPoint={inspect}
                />
                <div className="card match-table">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Use</th>
                          <th>Date</th>
                          <th>Measured ({unit("pressure", s.units)})</th>
                          <th>Calculated ({unit("pressure", s.units)})</th>
                          <th>Residual ({unit("pressure", s.units)})</th>
                          <th>Calculation audit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.row.id}>
                            <td>
                              <input
                                aria-label={`Match survey ${r.row.date}`}
                                type="checkbox"
                                checked={r.row.use}
                                onChange={(e) =>
                                  change({
                                    ...s,
                                    history: s.history.map((h) =>
                                      h.id === r.row.id
                                        ? { ...h, use: e.target.checked }
                                        : h,
                                    ),
                                  })
                                }
                              />
                            </td>
                            <td>{r.row.date}</td>
                            <td>
                              {fmt(
                                r.row.pressure === null
                                  ? null
                                  : fromField(
                                      r.row.pressure,
                                      "pressure",
                                      s.units,
                                    ),
                                4,
                              )}
                            </td>
                            <td>
                              {fmt(
                                r.predicted === null
                                  ? null
                                  : fromField(r.predicted, "pressure", s.units),
                                4,
                              )}
                            </td>
                            <td>
                              {fmt(
                                r.residual === null
                                  ? null
                                  : fromField(r.residual, "pressure", s.units),
                                5,
                              )}
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => inspect(r.row.id)}
                              >
                                Inspect equations
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="interpretation">
                  Predictions do not use measured pressure. Failed roots are
                  gaps with warnings. Metrics include only active, solved
                  surveys; review the solved/active count before comparing
                  cases. Residual = calculated minus measured.
                </p>
              </>
            )}
            {tab === "Drive Mechanisms" && (
              <Drive s={s} rows={rows} inspect={inspect} />
            )}
            {tab === "Methodology & Equations" && (
              <Methodology model={s.model} />
            )}
          </div>
          <footer>
            <span>
              Petroleum Academia <span className="footer-dot">/</span>{" "}
              Engineering through understanding.
            </span>
            <span>
              Local calculations ·{" "}
              {s.source === "synthetic"
                ? "Synthetic teaching example"
                : "User-supplied history"}
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <Inspector
          key={selected}
          s={s}
          selected={selected}
          rows={rows}
          close={closeInspector}
        />
      )}
    </div>
  );
}
