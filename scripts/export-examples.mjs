// Development-time fixture export only. The application itself has no Node backend.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createServer } from "vite";
const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "public", "examples");
const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true },
});
try {
  const { demo } = await server.ssrLoadModule("/src/data/demo.ts");
  const { makePVT } = await server.ssrLoadModule("/src/engineering/pvt.ts");
  const { serializeCSV } = await server.ssrLoadModule(
    "/src/engineering/history.ts",
  );
  const { historyExport } = await server.ssrLoadModule(
    "/src/engineering/project.ts",
  );
  await mkdir(out, { recursive: true });
  for (const model of ["oil", "gas"]) {
    const s = demo(model),
      pvt = makePVT(s.pvt, s.params, model);
    const pressures = [
      ...new Set([
        ...s.history.map((r) => r.pressure),
        s.params.pb,
        ...Array.from({ length: 101 }, (_, i) => 1000 + i * 45),
      ]),
    ].sort((a, b) => a - b);
    await writeFile(
      join(out, `${model}-demo.json`),
      JSON.stringify(s, null, 2),
    );
    await writeFile(
      join(out, `${model}-history-field.csv`),
      serializeCSV(historyExport(s)),
    );
    await writeFile(
      join(out, `${model}-pvt-field.csv`),
      serializeCSV(
        pressures.map((p) => {
          const v = pvt(p);
          return {
            Pressure: p,
            Bo: v.bo,
            Rs: v.rs,
            Bg: v.bg,
            Bw: v.bw,
            Z: v.z,
          };
        }),
      ),
    );
    console.log(`Exported ${model} synthetic case, history and PVT table.`);
  }
} finally {
  await server.close();
}
