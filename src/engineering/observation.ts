import type { HistoryRow } from "../types";
export const historyLabel = (r: HistoryRow) =>
  r.date || r.observation || "Unlabelled observation";
export const hasDates = (rows: HistoryRow[]) => rows.every((r) => !!r.date);
export const historyAxisTitle = (rows: HistoryRow[]) =>
  hasDates(rows)
    ? "Production date"
    : "Observation order (no elapsed time supplied)";
