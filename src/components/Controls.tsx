import { useState } from "react";
import { ChevronDown, SlidersHorizontal, Info } from "lucide-react";
import type { Parameters, Scenario } from "../types";
import { fromField, toField, unit } from "../engineering/units";
import type { Quantity } from "../engineering/units";
import { makePVT } from "../engineering/pvt";
export function Controls({
  s,
  change,
  setTab,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
  setTab: (tab: string) => void;
}) {
  const a = s.params;
  let initialBg: number | null = null;
  try {
    initialBg = makePVT(s.pvt, a, s.model)(a.pi).bg;
  } catch {
    /* The calculation panel explains invalid PVT. */
  }
  const set = (key: keyof Parameters, value: number | boolean | null) =>
    change({ ...s, params: { ...a, [key]: value } });
  const field = (
    key: keyof Parameters,
    label: string,
    q: Quantity = "dimensionless",
    scale = 1,
    range?: [number, number],
    tip?: string,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={Number(a[key])}
      q={q}
      units={s.units}
      scale={scale}
      range={range}
      onChange={(v) => set(key, v)}
      tip={tip}
    />
  );
  return (
    <aside className="controls">
      <div className="controls-title">
        <SlidersHorizontal size={17} />
        <h2>Model parameters</h2>
        <span className="live-dot" title="Updates automatically" />
      </div>
      <p className="control-intro">Adjust the tank. Explore the response.</p>
      <details open>
        <summary>
          Reservoir conditions
          <ChevronDown size={14} />
        </summary>
        {field("pi", "Initial pressure · pᵢ", "pressure", 1, [1000, 7000])}
        {s.pvt.mode === "correlation" ? (
          field("temperature", "Temperature", "temperature")
        ) : (
          <p className="micro">
            Temperature is not used to infer missing table properties.
          </p>
        )}
        {s.model === "oil" &&
          field("pb", "Bubble-point pressure · Pᵦ", "pressure")}
      </details>
      <details open>
        <summary>
          {s.model === "oil" ? "Oil & gas in place" : "Gas in place"}
          <ChevronDown size={14} />
        </summary>
        {s.model === "oil" ? (
          <>
            {field(
              "N",
              "Original oil in place · N",
              "liquid",
              1e6,
              [10e6, 200e6],
              "Original stock-tank oil volume. Direct entry can exceed the slider range.",
            )}
            {field(
              "m",
              "Gas-cap ratio · m",
              "dimensionless",
              1,
              [0, 1],
              "Initial gas-cap reservoir volume / initial oil reservoir volume. Included once in Eg and Efw.",
            )}
          </>
        ) : (
          <>
            {field("G", "Original gas in place · G", "gas", 1e9, [20e9, 400e9])}
            <label className="check">
              <input
                type="checkbox"
                disabled={s.pvt.mode === "table"}
                checked={a.zi !== null}
                onChange={(e) => set("zi", e.target.checked ? 0.95 : null)}
              />{" "}
              Calibrate initial Z-factor
            </label>
            {a.zi !== null &&
              s.pvt.mode === "correlation" &&
              field("zi", "Initial Z-factor · Zᵢ")}
            {initialBg !== null && s.pvt.mode === "correlation" && (
              <NumberField
                label="Initial gas FVF · Bgi"
                value={initialBg}
                q="bg"
                units={s.units}
                onChange={(bg) =>
                  set("zi", (bg * a.pi) / (0.005035 * (a.temperature + 459.67)))
                }
                tip="Entering initial Bg calibrates Zi through Bg = 0.005035 Z T/p. The same calibrated curve is used everywhere."
              />
            )}
            {s.pvt.mode === "table" && (
              <p className="micro">
                Initial Bg and Zi come from the uploaded PVT table. Correlation
                calibration controls do not override table properties.
              </p>
            )}
          </>
        )}
      </details>
      <details open>
        <summary>
          PVT configuration
          <ChevronDown size={14} />
        </summary>
        <div className="pvt-label">
          <span className="tiny-dot" />
          {s.pvt.mode === "table"
            ? "User-supplied PVT table"
            : s.model === "oil"
              ? "Vasquez–Beggs + DAK"
              : "Sutton + DAK"}
        </div>
        {s.pvt.mode === "correlation" ? (
          <>
            {field(
              "gasGravity",
              s.model === "oil"
                ? "Gas gravity · γgc (100 psig)"
                : "Gas gravity · γg",
            )}
            {s.model === "oil" && (
              <>
                {field("api", "Oil gravity · °API")}
                {field("rsi", "Initial solution GOR · Rsi", "rs")}
              </>
            )}
          </>
        ) : (
          <p className="micro">
            Initial fluid properties come from the table. Correlation
            temperature, gravity and Rsi inputs do not override it; review the
            selected values and any missing properties in PVT QC.
          </p>
        )}
        <button className="text-button" onClick={() => setTab("PVT")}>
          Review PVT model <span>↗</span>
        </button>
      </details>
      <details>
        <summary>
          Rock & formation water
          <ChevronDown size={14} />
        </summary>
        {field("swi", "Initial water saturation · Swi")}
        {field("cf", "Rock compressibility · cf", "compressibility", 1e-6)}
        {field("cw", "Water compressibility · cw", "compressibility", 1e-6)}
        {field("bw", "Water FVF · Bw", "fvf")}
      </details>
      <details open>
        <summary>
          Aquifer support
          <ChevronDown size={14} />
        </summary>
        <label className="field-label" htmlFor="aquifer">
          Aquifer model
        </label>
        <select
          id="aquifer"
          value={s.aquifer}
          onChange={(e) =>
            change({ ...s, aquifer: e.target.value as Scenario["aquifer"] })
          }
        >
          <option value="none">None · closed tank</option>
          <option value="pot">Pot · equilibrium storage</option>
        </select>
        {s.aquifer === "pot" && (
          <>
            {field(
              "caq",
              "Storage coefficient · Caq",
              "storage",
              1,
              [0, 100000],
            )}
            <p className="micro">
              We = Caq (pᵢ − p). Equilibrium storage approximation; no transient
              aquifer flow.
            </p>
          </>
        )}
      </details>
      <details>
        <summary>
          Injection accounting
          <ChevronDown size={14} />
        </summary>
        <label className="check">
          <input
            type="checkbox"
            checked={a.injection}
            onChange={(e) => set("injection", e.target.checked)}
          />{" "}
          Include injection in net withdrawal
        </label>
        {a.injection && (
          <>
            {field("bwi", "Injected water FVF · Bwi", "fvf")}
            <label className="check">
              <input
                type="checkbox"
                checked={a.bgi !== null}
                onChange={(e) => set("bgi", e.target.checked ? 0.001 : null)}
              />{" "}
              Specify injected gas FVF
            </label>
            {a.bgi !== null ? (
              field("bgi", "Injected gas FVF · Bgi", "bg")
            ) : (
              <p className="micro">
                Injected gas uses the current reservoir Bg.
              </p>
            )}
          </>
        )}
      </details>
      <div className="sidebar-note">
        <Info size={15} />
        <p>
          One tank. Uniform pressure.
          <br />
          Every result is calculated locally.
        </p>
      </div>
    </aside>
  );
}
export function NumberField({
  label,
  value,
  q,
  units,
  scale = 1,
  range,
  onChange,
  tip,
}: {
  label: string;
  value: number;
  q: Quantity;
  units: Scenario["units"];
  scale?: number;
  range?: [number, number];
  onChange: (n: number) => void;
  tip?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = fromField(value, q, units) / scale;
  const prefix =
    scale === 1e6
      ? "MM "
      : scale === 1e9
        ? "B "
        : scale === 1e-6
          ? "10⁻⁶ "
          : "";
  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() && Number.isFinite(n))
      onChange(toField(n * scale, q, units));
    setDraft(null);
  };
  return (
    <div className="number-field">
      <label className="field-label">
        {label}
        {tip && (
          <span title={tip} tabIndex={0}>
            <Info size={12} />
          </span>
        )}
      </label>
      <div className="number-box">
        <input
          aria-label={label}
          type="number"
          step="any"
          value={draft ?? Number(shown.toPrecision(8))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) commit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span>
          {prefix}
          {unit(q, units)}
        </span>
      </div>
      {range && (
        <>
          <input
            aria-label={`${label} slider`}
            type="range"
            min={Math.min(range[0], value)}
            max={Math.max(range[1], value)}
            step="any"
            value={value}
            onChange={(e) => {
              setDraft(null);
              onChange(Number(e.target.value));
            }}
          />
          <div className="range-label">
            <span>
              {(fromField(range[0], q, units) / scale).toLocaleString(
                undefined,
                { maximumFractionDigits: 1 },
              )}
            </span>
            <span>
              {(fromField(range[1], q, units) / scale).toLocaleString(
                undefined,
                { maximumFractionDigits: 1 },
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
