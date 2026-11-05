import type { Units } from "../types";
export type Quantity =
  | "pressure"
  | "liquid"
  | "gas"
  | "temperature"
  | "compressibility"
  | "storage"
  | "rs"
  | "bg"
  | "fvf"
  | "dimensionless";
const factors: Record<Exclude<Quantity, "temperature">, number> = {
  pressure: 0.006894757293168,
  liquid: 0.158987294928,
  gas: 0.028316846592,
  compressibility: 1 / 0.006894757293168,
  storage: 0.158987294928 / 0.006894757293168,
  rs: 0.028316846592 / 0.158987294928,
  bg: 0.158987294928 / 0.028316846592,
  fvf: 1,
  dimensionless: 1,
};
export function fromField(value: number, q: Quantity, u: Units): number;
export function fromField(value: null, q: Quantity, u: Units): null;
export function fromField(
  value: number | null,
  q: Quantity,
  u: Units,
): number | null;
export function fromField(
  value: number | null,
  q: Quantity,
  u: Units,
): number | null {
  if (value === null) return null;
  return u === "FIELD"
    ? value
    : q === "temperature"
      ? ((value - 32) * 5) / 9
      : value * factors[q];
}
export function toField(value: number, q: Quantity, u: Units): number {
  return u === "FIELD"
    ? value
    : q === "temperature"
      ? (value * 9) / 5 + 32
      : value / factors[q];
}
export const unit = (q: Quantity, u: Units): string =>
  ({
    pressure: u === "FIELD" ? "psia" : "MPa(a)",
    liquid: u === "FIELD" ? "STB" : "sm³",
    gas: u === "FIELD" ? "scf" : "sm³",
    temperature: u === "FIELD" ? "°F" : "°C",
    compressibility: u === "FIELD" ? "psi⁻¹" : "MPa⁻¹",
    storage: u === "FIELD" ? "rb/psi" : "rm³/MPa",
    rs: u === "FIELD" ? "scf/STB" : "sm³/sm³",
    bg: u === "FIELD" ? "rb/scf" : "rm³/sm³",
    fvf: u === "FIELD" ? "rb/STB" : "rm³/sm³",
    dimensionless: "–",
  })[q];
export const reservoirUnit = (u: Units) => (u === "FIELD" ? "rb" : "rm³");
