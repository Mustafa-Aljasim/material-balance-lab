import { useState } from "react";
/** Preserve full precision on focus/blur; commit only a deliberate edit. */
export function EditableNumber({
  value,
  label,
  onCommit,
  placeholder,
}: {
  value: number | null;
  label: string;
  onCommit: (raw: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed =
    value === null || !Number.isFinite(value)
      ? ""
      : Number(value.toPrecision(10)).toString();
  return (
    <input
      aria-label={label}
      type="number"
      step="any"
      value={draft ?? displayed}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== displayed) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
