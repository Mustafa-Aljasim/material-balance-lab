import {
  historyLabel,
  hasDates,
  historyAxisTitle,
} from "../engineering/observation";
import { useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import type { HistoryRow, Scenario } from "../types";
import { demo } from "../data/demo";
import { Chart, colors } from "../charts/Chart";
import { fromField, toField, unit } from "../engineering/units";
import { historyIssues, serializeCSV } from "../engineering/history";
import { ImportHistory } from "../components/ImportHistory";
import { download, historyExport } from "../engineering/project";
import { EditableNumber } from "../components/EditableNumber";
export function History({
  s,
  change,
  inspect,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
  inspect: (id: string) => void;
}) {
  const [importing, setImporting] = useState(false),
    [page, setPage] = useState(0);
  const issues = historyIssues(s.history, s.params.pi),
    oil = s.model === "oil";
  const setRow = (
    id: string,
    key: keyof HistoryRow,
    value: string | boolean | number | null,
  ) =>
    change({
      ...s,
      source: "edited",
      history: s.history.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    });
  const cols = [
    { key: "np", label: "Np", q: "liquid", scale: 1e6 },
    { key: "gp", label: "Gp", q: "gas", scale: 1e9 },
    { key: "wp", label: "Wp", q: "liquid", scale: 1e6 },
    { key: "wi", label: "Wi", q: "liquid", scale: 1e6 },
    { key: "gi", label: "Gi", q: "gas", scale: 1e9 },
  ] as const;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(s.history.length / 30) - 1),
  );
  const dated = hasDates(s.history);
  const sorted = dated
    ? [...s.history].sort((a, b) => a.date.localeCompare(b.date))
    : s.history;
  const rates = sorted.map((r, i) => {
    if (!i) return null;
    const prev = sorted[i - 1],
      days = (Date.parse(r.date) - Date.parse(prev.date)) / 864e5;
    return days > 0
      ? {
          qo: (r.np - prev.np) / days,
          qg: (r.gp - prev.gp) / days,
          qw: (r.wp - prev.wp) / days,
          qi: (r.wi - prev.wi) / days,
          qgi: (r.gi - prev.gi) / days,
        }
      : null;
  });
  return (
    <>
      <div className="page-title">
        <div>
          <h2>Production & pressure history</h2>
          <p>
            Keep the full production record. Select pressure surveys
            independently.
          </p>
        </div>
        <div className="button-row">
          <button onClick={() => setImporting(true)}>
            <Upload size={14} /> Import / paste
          </button>
          <button
            title="Export history in current display units"
            onClick={() =>
              download(
                serializeCSV(historyExport(s)),
                "history.csv",
                "text/csv",
              )
            }
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>
      {issues.length > 0 && (
        <div className="notice error" role="alert">
          <strong>Resolve history issues before calculating</strong>
          {issues.slice(0, 10).map((i, n) => (
            <p key={n}>{i}</p>
          ))}
        </div>
      )}
      <div className="card history-card">
        <div className="table-toolbar">
          <div>
            <span className="pill">{s.history.length} history rows</span>
            <span className="micro">
              {" "}
              Editable cumulatives ·{" "}
              {
                s.history.filter((r) => r.use && r.pressure !== null).length
              }{" "}
              active surveys
            </span>
          </div>
          <div className="button-row">
            <button
              onClick={() =>
                change({
                  ...s,
                  history: s.history.map((r) => ({ ...r, use: true })),
                })
              }
            >
              Use all
            </button>
            <button
              onClick={() =>
                change({
                  ...s,
                  history: s.history.map((r) => ({ ...r, use: false })),
                })
              }
            >
              Exclude all
            </button>
            <button
              onClick={() =>
                change({
                  ...s,
                  source: "synthetic",
                  history: demo(s.model).history,
                })
              }
            >
              Load synthetic history
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table history-table">
            <thead>
              <tr>
                <th>Use</th>
                <th>{dated ? "Date" : "Observation (no dates)"}</th>
                {cols.map((c) => (
                  <th key={c.key}>
                    {c.label}
                    <small>
                      {c.scale === 1e6 ? "MM" : "B"} {unit(c.q, s.units)}
                    </small>
                  </th>
                ))}
                <th>
                  Pressure<small>{unit("pressure", s.units)}</small>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.history
                .slice(currentPage * 30, currentPage * 30 + 30)
                .map((r) => (
                  <tr key={r.id} className={!r.use ? "excluded" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Use survey ${historyLabel(r)}`}
                        checked={r.use}
                        onChange={(e) => setRow(r.id, "use", e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${dated ? "Date" : "Observation"} ${r.id}`}
                        type={dated ? "date" : "text"}
                        value={dated ? r.date : (r.observation ?? "")}
                        onChange={(e) =>
                          setRow(
                            r.id,
                            dated ? "date" : "observation",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    {cols.map((c) => (
                      <td key={c.key}>
                        <EditableNumber
                          key={`${r.id}-${s.units}-${c.key}`}
                          label={`${c.label} ${historyLabel(r)}`}
                          value={fromField(r[c.key], c.q, s.units) / c.scale}
                          onCommit={(raw) =>
                            setRow(
                              r.id,
                              c.key,
                              raw.trim()
                                ? toField(Number(raw) * c.scale, c.q, s.units)
                                : Number.NaN,
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <EditableNumber
                        key={`${r.id}-${s.units}-p`}
                        label={`Pressure ${historyLabel(r)}`}
                        value={
                          r.pressure === null
                            ? null
                            : fromField(r.pressure, "pressure", s.units)
                        }
                        onCommit={(raw) =>
                          setRow(
                            r.id,
                            "pressure",
                            raw.trim()
                              ? toField(Number(raw), "pressure", s.units)
                              : null,
                          )
                        }
                        placeholder="No survey"
                      />
                    </td>
                    <td>
                      <button
                        className="delete-row"
                        title={`Delete row ${historyLabel(r)}`}
                        onClick={() =>
                          change({
                            ...s,
                            source: "edited",
                            history: s.history.filter((v) => v.id !== r.id),
                          })
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <button
            disabled={s.history.length >= 2000}
            onClick={() => {
              const last = s.history.at(-1),
                date =
                  last && Number.isFinite(Date.parse(last.date))
                    ? new Date(Date.parse(last.date) + 30 * 864e5)
                        .toISOString()
                        .slice(0, 10)
                    : "2020-01-01";
              change({
                ...s,
                source: "edited",
                history: [
                  ...s.history,
                  {
                    id: crypto.randomUUID(),
                    date: dated ? date : "",
                    ...(dated
                      ? {}
                      : { observation: `Observation ${s.history.length + 1}` }),
                    np: last?.np ?? 0,
                    gp: last?.gp ?? 0,
                    wp: last?.wp ?? 0,
                    wi: last?.wi ?? 0,
                    gi: last?.gi ?? 0,
                    pressure: null,
                    use: true,
                  },
                ],
              });
              setPage(Math.floor(s.history.length / 30));
            }}
          >
            <Plus size={14} /> Add row
          </button>
          <div className="button-row">
            <button
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span className="micro">
              {currentPage + 1} /{" "}
              {Math.max(1, Math.ceil(s.history.length / 30))}
            </span>
            <button
              disabled={(currentPage + 1) * 30 >= s.history.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <p className="interpretation">
        “Use” controls the match objective and diagnostic regressions only. It
        never changes production volumes or the calculated pressure trajectory.
        Rows retain cumulative volumes as entered; blank pressure means no
        survey. Imported rates are integrated using elapsed calendar days.
      </p>
      {!dated && (
        <p className="notice soft">
          These are pressure-indexed observations. Actual dates and elapsed time
          are unavailable: rate curves and any future transient aquifer
          calculation are unavailable. Cumulative volumes remain exactly as
          supplied.
        </p>
      )}
      {dated && (
        <div className="chart-grid">
          <Chart
            title="Produced & injected liquids"
            subtitle="Interval-average rates derived from cumulative differences"
            data={(["qo", "qw", "qi"] as const).map((k, i) => ({
              type: "scatter",
              mode: "lines+markers",
              name: { qo: "Oil", qw: "Water", qi: "Water injection" }[k],
              x: sorted.map(historyLabel),
              y: rates.map((r) =>
                r ? fromField(r[k], "liquid", s.units) : null,
              ),
              customdata: sorted.map((r) => r.id),
              line: { color: [colors.green, colors.blue, colors.orange][i] },
            }))}
            xTitle="Date (rate applies to preceding interval)"
            yTitle={`Liquid rate (${unit("liquid", s.units)}/day)`}
            onPoint={inspect}
          />
          <Chart
            title="Gas production & injection"
            subtitle="Interval-average gas rates at standard conditions"
            data={(["qg", "qgi"] as const).map((k, i) => ({
              type: "scatter",
              mode: "lines+markers",
              name: k === "qg" ? "Gas production" : "Gas injection",
              x: sorted.map(historyLabel),
              y: rates.map((r) =>
                r ? fromField(r[k], "gas", s.units) / 1e6 : null,
              ),
              customdata: sorted.map((r) => r.id),
              line: { color: i ? colors.orange : colors.green },
            }))}
            xTitle={historyAxisTitle(s.history)}
            yTitle={`Gas rate (MM ${unit("gas", s.units)}/day)`}
            onPoint={inspect}
          />
        </div>
      )}
      <div className="chart-grid">
        <Chart
          title="Cumulative history"
          subtitle="Integrated production and injection, never averaged"
          data={(oil
            ? (["np", "wp", "wi"] as const)
            : (["gp", "gi"] as const)
          ).map((k, i) => ({
            type: "scatter",
            mode: "lines+markers",
            name: k.toUpperCase(),
            x: s.history.map(historyLabel),
            y: s.history.map(
              (r) =>
                fromField(r[k], oil ? "liquid" : "gas", s.units) /
                (oil ? 1e6 : 1e9),
            ),
            customdata: s.history.map((r) => r.id),
            line: { color: [colors.green, colors.blue, colors.orange][i] },
          }))}
          xTitle={historyAxisTitle(s.history)}
          yTitle={`Cumulative (${oil ? "MM" : "B"} ${unit(oil ? "liquid" : "gas", s.units)})`}
          onPoint={inspect}
        />
        <Chart
          title="Measured reservoir pressure"
          data={[
            {
              type: "scatter",
              mode: "markers",
              name: "Pressure surveys",
              x: s.history.map(historyLabel),
              y: s.history.map((r) =>
                r.pressure === null
                  ? null
                  : fromField(r.pressure, "pressure", s.units),
              ),
              customdata: s.history.map((r) => r.id),
              marker: {
                color: s.history.map((r) =>
                  r.use ? colors.orange : colors.gray,
                ),
                size: 8,
              },
            },
          ]}
          xTitle="Survey date"
          yTitle={`Pressure (${unit("pressure", s.units)})`}
          onPoint={inspect}
        />
      </div>
      {importing && (
        <ImportHistory
          s={s}
          change={change}
          close={() => {
            setImporting(false);
            setPage(0);
          }}
        />
      )}
    </>
  );
}
