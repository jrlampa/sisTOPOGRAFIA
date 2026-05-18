import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd());
const lockPath = path.join(rootDir, "package-lock.json");
const outDir = path.join(rootDir, "artifacts");
const outPath = path.join(outDir, "sbom-node.json");

if (!fs.existsSync(lockPath)) {
  console.error("[sbom] package-lock.json not found");
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const packages = lock.packages ?? {};

const components = Object.entries(packages)
  .filter(([pkgPath, pkg]) => pkgPath !== "" && pkg && typeof pkg === "object" && typeof pkg.version === "string")
  .map(([pkgPath, pkg]) => {
    const normalizedPath = String(pkgPath).replace(/^node_modules\//, "");
    const name = normalizedPath.split("node_modules/").pop() ?? normalizedPath;

    return {
      type: "library",
      name,
      version: pkg.version,
      purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(pkg.version)}`,
    };
  });

if (components.length === 0) {
  console.error("[sbom] No components found in package-lock.json");
  process.exit(1);
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: lock.name ?? "sisrua-unified",
      version: lock.version ?? "0.0.0",
    },
    tools: [
      {
        vendor: "sisTOPOGRAFIA",
        name: "generate-sbom-node",
        version: "1.0.0",
      },
    ],
  },
  components,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");

console.log(`[sbom] Generated ${outPath} with ${components.length} components`);
