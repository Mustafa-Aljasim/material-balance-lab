import { ReferenceImport } from "./ReferenceImport";
import { useState } from "react";
import { Upload } from "lucide-react";
import type { Scenario } from "../types";
import {
  gasUnits,
  importHistory,
  liquidUnits,
  parseTable,
  pressureUnits,
} from "../engineering/history";
import type { ImportOptions, Mapping, RawTable } from "../engineering/history";
export function ImportHistory({
  s,
  change,
  close,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
  close: () => void;
}) {
  const [reference, setReference] = useState(false);
  const [raw, setRaw] = useState(""),
    [table, setTable] = useState<RawTable | null>(null),
    [error, setError] = useState("");
  const [o, setO] = useState<ImportOptions>({
    format: "cumulative",
    mapping: {},
    liquidUnit: s.units === "FIELD" ? "STB" : "sm³",
    gasUnit: s.units === "FIELD" ? "scf" : "sm³",
    pressureUnit: s.units === "FIELD" ? "psia" : "MPa(a)",
    integration: "interval-end",
    model: s.model,
  });
  const keys = [
    "Date",
    ...(o.format === "rates"
      ? ["qo", "qg", "qw", "qi", "qgi"]
      : ["Np", "Gp", "Wp", "Wi", "Gi"]),
    "Pressure",
    "Use",
  ];
  const map = (t: RawTable, format: ImportOptions["format"]) => {
    const mapping: Mapping = {};
    for (const key of [
      "Date",
      ...(format === "rates"
        ? ["qo", "qg", "qw", "qi", "qgi"]
        : ["Np", "Gp", "Wp", "Wi", "Gi"]),
      "Pressure",
      "Use",
    ])
      mapping[key] =
        t.headers.find(
          (h) => h.toLowerCase().replace(/\s/g, "") === key.toLowerCase(),
        ) ?? "";
    return mapping;
  };
  const read = (text: string) => {
    try {
      const t = parseTable(text);
      setRaw(text);
      setTable(t);
      const format = t.headers.some(
        (h) => h.toLowerCase() === "qo" || h.toLowerCase() === "qg",
      )
        ? "rates"
        : o.format;
      setO({ ...o, format, mapping: map(t, format) });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (reference)
    return (
      <div className="modal-backdrop">
        <section
          className="modal import-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Reference Exercise import"
        >
          <button
            className="close-modal"
            aria-label="Close reference import"
            onClick={close}
          >
            ×
          </button>
          <button onClick={() => setReference(false)}>
            Rates / cumulative import
          </button>
          <ReferenceImport s={s} change={change} close={close} />
        </section>
      </div>
    );
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import production history"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-modal"
          aria-label="Close history import"
          onClick={close}
        >
          ×
        </button>
        <span className="eyebrow">PRODUCTION & PRESSURE HISTORY</span>
        <h2>Bring your data into the lab</h2>
        <p className="modal-intro">
          Upload CSV or paste cells copied from Excel. Data stays in your
          browser.
        </p>
        <button onClick={() => setReference(true)}>
          Reference Exercise · pressure-indexed data / Rp / PVT
        </button>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {!table ? (
          <>
            <label className="upload-zone">
              <Upload size={24} />
              <strong>Select a CSV file</strong>
              <span>Up to 5 MB · 2,000 rows</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={async (e) => {
                  try {
                    if (e.target.files?.[0])
                      read(await e.target.files[0].text());
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
            </label>
            <label className="field-label" htmlFor="paste">
              Or paste a table with a header row
            </label>
            <textarea
              id="paste"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={7}
              placeholder={
                "Date\tNp\tGp\tWp\tWi\tPressure\n2020-01-01\t0\t0\t0\t0\t4200"
              }
            />
            <p className="micro">
              Dates: YYYY-MM-DD or M/D/YYYY. Gas and water injection columns are
              optional. Blank measured pressures are allowed.
            </p>
            <button className="primary-button" onClick={() => read(raw)}>
              Continue to column mapping <span>→</span>
            </button>
          </>
        ) : (
          <>
            <div className="import-options">
              <label>
                Data format
                <select
                  value={o.format}
                  onChange={(e) => {
                    const format = e.target.value as ImportOptions["format"];
                    setO({ ...o, format, mapping: map(table, format) });
                  }}
                >
                  <option value="cumulative">Cumulative volumes</option>
                  <option value="rates">Daily rates</option>
                </select>
              </label>
              <label>
                Liquid {o.format === "rates" ? "rate" : "volume"} units
                <select
                  value={o.liquidUnit}
                  onChange={(e) => setO({ ...o, liquidUnit: e.target.value })}
                >
                  {Object.keys(liquidUnits).map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {o.format === "rates" ? "/day" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gas {o.format === "rates" ? "rate" : "volume"} units
                <select
                  value={o.gasUnit}
                  onChange={(e) => setO({ ...o, gasUnit: e.target.value })}
                >
                  {Object.keys(gasUnits).map((v) => (
                    <option key={v} value={v}>
                      {v}
                      {o.format === "rates" ? "/day" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Absolute pressure
                <select
                  value={o.pressureUnit}
                  onChange={(e) => setO({ ...o, pressureUnit: e.target.value })}
                >
                  {Object.keys(pressureUnits).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            {o.format === "rates" && (
              <div className="notice">
                <label>
                  Integration convention{" "}
                  <select
                    value={o.integration}
                    onChange={(e) =>
                      setO({
                        ...o,
                        integration: e.target
                          .value as ImportOptions["integration"],
                      })
                    }
                  >
                    <option value="interval-end">
                      Interval-ending rate × elapsed days
                    </option>
                    <option value="trapezoidal">
                      Trapezoidal: average endpoint rates × days
                    </option>
                  </select>
                </label>
                <p>
                  The first date establishes t₀ with zero cumulative volume.
                  Interval-ending rates describe (previous date, current date].
                  Trapezoidal integration assumes linear rate changes.
                  Prehistory volumes must be supplied as cumulatives.
                </p>
              </div>
            )}
            <div className="mapping-grid">
              {keys.map((key) => (
                <label key={key}>
                  {key}
                  {key === "Date" ||
                  key ===
                    (s.model === "oil"
                      ? o.format === "rates"
                        ? "qo"
                        : "Np"
                      : o.format === "rates"
                        ? "qg"
                        : "Gp")
                    ? " *"
                    : ""}
                  <select
                    value={o.mapping[key] ?? ""}
                    onChange={(e) =>
                      setO({
                        ...o,
                        mapping: { ...o.mapping, [key]: e.target.value },
                      })
                    }
                  >
                    <option value="">
                      {key === "Pressure"
                        ? "No surveys"
                        : key === "Use"
                          ? "All surveys active"
                          : "Not supplied (zero)"}
                    </option>
                    {table.headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="micro">
              {table.rows.length} rows detected. Unmapped volumes are explicitly
              treated as zero. Missing cells in mapped volume columns are
              rejected. Imported data replaces the history and retains current
              tank parameters.
            </p>
            <div className="button-row">
              <button onClick={() => setTable(null)}>Back</button>
              <button
                className="primary-button"
                onClick={() => {
                  try {
                    const history = importHistory(table, o);
                    change({
                      ...s,
                      source: "imported",
                      name: s.name.replace("depletion", "imported history"),
                      history,
                    });
                    close();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Import {table.rows.length} rows
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
