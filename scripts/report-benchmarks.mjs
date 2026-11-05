import { createServer } from "vite";
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
});
try {
  const { benchmarkScenario, benchmarkAudit } = await server.ssrLoadModule(
    "/src/data/benchmarks.ts",
  );
  const { roundingSensitivity } = await server.ssrLoadModule(
    "/src/engineering/gasCapRegression.ts",
  );
  console.log(
    "Dake half-digit stress test",
    roundingSensitivity(benchmarkScenario("dake")),
  );
  for (const id of ["virginia", "dake", "iraq"]) {
    const a = benchmarkAudit(benchmarkScenario(id));
    console.log(
      JSON.stringify(
        {
          id,
          N_MMSTB: a.N / 1e6,
          gasCap: a.gasCap.fit,
          first: a.rows.find((r) => r.row.np > 0)?.measured,
          issues: a.issues,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await server.close();
}
