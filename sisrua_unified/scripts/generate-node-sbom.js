import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function main() {
  await mkdir('artifacts', { recursive: true });

  const { stdout } = await execFileAsync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['sbom', '--sbom-format', 'cyclonedx', '--json'],
    { maxBuffer: 20 * 1024 * 1024 },
  );

  await writeFile('artifacts/sbom-node.json', stdout, 'utf8');
}

main().catch((error) => {
  console.error('[security:sbom:node] Falha ao gerar SBOM Node.', error);
  process.exitCode = 1;
});
