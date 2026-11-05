import { useState } from "react";
import type { Scenario } from "../types";
import { parseTable } from "../engineering/history";
import type { RawTable } from "../engineering/history";
import {
  importReference,
  referenceKeys,
  referenceUnitOptions,
} from "../engineering/referenceImport";
import type { ReferenceOptions } from "../engineering/referenceImport";
export function ReferenceImport({
  s,
  change,
  close,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
  close: () => void;
}) {
  const [text, setText] = useState(""),
    [table, setTable] = useState<RawTable | null>(null),
    [error, setError] = useState(""),
    [approveBw, setApproveBw] = useState(false);
  const [o, setO] = useState<ReferenceOptions>({
    mapping: {},
    units: Object.fromEntries(
      referenceKeys.map((k) => [k, referenceUnitOptions(k)[0]]),
    ),
    oilMode: "black-oil",
    constantBw: null,
    source: "User-supplied reference exercise",
  });
  const read = (raw: string) => {
    try {
      const t = parseTable(raw);
      setText(raw);
      setTable(t);
      const mapping: Record<string, string> = {},
        units = { ...o.units };
      for (const k of referenceKeys) {
        mapping[k] =
          t.headers.find(
            (h) =>
              h.toLowerCase() === k.toLowerCase() ||
              h.toLowerCase().startsWith(k.toLowerCase() + "_"),
          ) ?? "";
        const h = mapping[k];
        if (h.includes("MMSTB")) units[k] = "MMSTB";
        else if (h.includes("MSTB")) units[k] = "MSTB";
        else if (h.includes("MMscf")) units[k] = "MMscf";
        else if (h.includes("Mscf")) units[k] = "Mscf";
      }
      mapping.Observation ||= t.headers.find((h) => h === "Year") ?? "";
      mapping.Pressure ||=
        t.headers.find((h) => h === "P_psia" || h === "Pressure_psia") ?? "";
      setO({ ...o, mapping, units });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="card reference-import">
      <h3>Reference Exercise import</h3>
      <p className="interpretation">
        Map cumulative observations and optional co-located PVT. Leave Date
        unmapped for pressure-indexed textbook data. Observation labels preserve
        order and never imply elapsed time. Rp must be cumulative producing GOR;
        instantaneous test GOR is unsuitable.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!table ? (
        <>
          <textarea
            aria-label="Reference exercise table"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pressure_psia,Np_MMSTB,Rp_scf_STB,Bo,Rs,Bg"
          />
          <label className="file-button">
            Upload reference CSV
            <input
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={async (e) => {
                if (e.target.files?.[0]) read(await e.target.files[0].text());
              }}
            />
          </label>
          <button onClick={() => read(text)}>Map reference columns</button>
        </>
      ) : (
        <>
          <div className="mapping-grid">
            {referenceKeys.map((k) => (
              <label key={k}>
                {k === "Rp" ? "Rp · cumulative GOR" : k}
                <select
                  aria-label={`Reference ${k} column`}
                  value={o.mapping[k] ?? ""}
                  onChange={(e) =>
                    setO({
                      ...o,
                      mapping: { ...o.mapping, [k]: e.target.value },
                    })
                  }
                >
                  <option value="">
                    {k === "Date"
                      ? "No actual dates"
                      : k === "Rp"
                        ? "No Rp conversion"
                        : "Not supplied"}
                  </option>
                  {table.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
                {referenceUnitOptions(k).length > 1 && (
                  <select
                    aria-label={`Reference ${k} unit`}
                    value={o.units[k]}
                    onChange={(e) =>
                      setO({ ...o, units: { ...o.units, [k]: e.target.value } })
                    }
                  >
                    {referenceUnitOptions(k).map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
          <label className="check">
            Oil formulation
            <select
              value={o.oilMode}
              onChange={(e) =>
                setO({
                  ...o,
                  oilMode: e.target.value as ReferenceOptions["oilMode"],
                })
              }
            >
              <option value="black-oil">Black oil · Bo, Rs, Bg</option>
              <option value="undersaturated">
                Bo only · no gas cap, p ≥ Pb
              </option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={approveBw}
              onChange={(e) => setApproveBw(e.target.checked)}
            />{" "}
            I approve constant Bw = {s.params.bw} where absent (no invented Z,
            Rs or Bg)
          </label>
          <label className="field-label">
            Original source
            <input
              value={o.source}
              onChange={(e) => setO({ ...o, source: e.target.value })}
            />
          </label>
          <p className="micro">
            Unmapped Wp, Wi and Gi are explicitly treated as zero. Gp is derived
            from Np × Rp only if Rp is mapped; otherwise zero. The selected
            initial pressure remains {s.params.pi} psia; edit initial conditions
            in Model parameters. Forward calculations pause on invalid
            cumulative trends. Direct PVT tables must cover pi; no initial PVT
            row is invented.
          </p>
          <div className="button-row">
            <button onClick={() => setTable(null)}>Back</button>
            <button
              className="primary-button"
              onClick={() => {
                try {
                  const imported = importReference(table, s, {
                    ...o,
                    constantBw: approveBw ? s.params.bw : null,
                  });
                  change({
                    ...s,
                    name: "Imported reference exercise",
                    source: "imported",
                    history: imported.history,
                    pvt: imported.pvt,
                    assumptions: [
                      ...(s.assumptions ?? []),
                      `Reference import: ${o.source}. Unmapped Wp/Wi/Gi = zero. ${approveBw ? `Constant Bw ${s.params.bw} approved.` : ""}`,
                      o.oilMode === "undersaturated"
                        ? "Above-Pb Bo-only balance: constant solution gas cancels; no free-gas withdrawal or initial cap."
                        : "Rp, if mapped, denotes cumulative producing GOR.",
                    ],
                  });
                  close();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Import reference exercise
            </button>
          </div>
        </>
      )}
    </section>
  );
}
