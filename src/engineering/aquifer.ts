export function waterInflux(
  model: "none" | "pot",
  caq: number,
  pi: number,
  p: number,
): number {
  if (caq < 0 || !Number.isFinite(caq))
    throw new Error("Aquifer storage must be finite and nonnegative.");
  // Signed equilibrium storage: negative at pressure above pi (backflow).
  return model === "pot" ? caq * (pi - p) : 0;
}
