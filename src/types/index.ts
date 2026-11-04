export type Model = "oil" | "gas";
export type Units = "FIELD" | "METRIC";
export interface Parameters {
  pi: number;
  temperature: number;
  N: number;
  G: number;
  m: number;
  swi: number;
  cf: number;
  cw: number;
  bw: number;
  pb: number;
  rsi: number;
  api: number;
  gasGravity: number;
  zi: number | null;
  caq: number;
  injection: boolean;
  bwi: number;
  bgi: number | null;
}
export interface PVT {
  pressure: number;
  bo: number;
  rs: number;
  bg: number;
  bw: number;
  z: number;
}
export interface PVTConfig {
  mode: "correlation" | "table";
  table: PVT[];
  extrapolate: boolean;
}
export interface HistoryRow {
  id: string;
  date: string;
  np: number;
  gp: number;
  wp: number;
  wi: number;
  gi: number;
  pressure: number | null;
  use: boolean;
}
export interface Scenario {
  version: 1;
  name: string;
  source: "synthetic" | "imported" | "edited";
  model: Model;
  units: Units;
  params: Parameters;
  pvt: PVTConfig;
  aquifer: "none" | "pot";
  history: HistoryRow[];
  display: { tab: string; corrected: boolean; extrapolatePz: boolean };
}
export interface Balance {
  p: number;
  pvt: PVT;
  initial: PVT;
  F: number;
  Eo: number;
  Eg: number;
  Efw: number;
  Et: number;
  We: number;
  oil: number;
  gas: number;
  rock: number;
  support: number;
  closure: number;
  rp: number | null;
  indices: [number, number, number, number] | null;
}
export interface SolvedRow {
  row: HistoryRow;
  predicted: number | null;
  residual: number | null;
  measured: Balance | null;
  predictedBalance: Balance | null;
  error?: string;
}
export interface RootResult {
  root: number;
  iterations: number;
  residual: number;
}
export type PVTProvider = (p: number) => PVT;
