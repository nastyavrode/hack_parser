import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const output = resolve(root, '.serverless/yandex-function');
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'prisma'), { recursive: true });
writeFileSync(
  resolve(output, 'package.json'),
  readFileSync(resolve(root, 'yandex-cloud/function/package.json'), 'utf8'),
);
const sourceSchema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
const schema = sourceSchema.replace(
  'binaryTargets = ["native", "debian-openssl-3.0.x"]',
  'binaryTargets = ["debian-openssl-3.0.x"]',
);
if (schema === sourceSchema) throw new Error('Could not configure the Prisma schema for the Yandex Cloud Linux runtime.');
writeFileSync(resolve(output, 'prisma/schema.prisma'), schema);

await build({
  entryPoints: [resolve(root, 'src/serverless/yandex-handler.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['@prisma/client', 'playwright'],
  tsconfig: resolve(root, 'tsconfig.json'),
  outfile: resolve(output, 'index.js'),
});

execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: output, stdio: 'inherit' });
execFileSync(resolve(output, 'node_modules/.bin/prisma'), ['generate', '--schema', 'prisma/schema.prisma'], { cwd: output, stdio: 'inherit' });
const runtimePackage = JSON.parse(readFileSync(resolve(output, 'package.json'), 'utf8'));
delete runtimePackage.devDependencies;
writeFileSync(resolve(output, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`);
execFileSync('npm', ['prune', '--omit=dev', '--no-audit', '--no-fund'], { cwd: output, stdio: 'inherit' });
for (const packagePath of [
  'node_modules/prisma',
  'node_modules/@prisma/engines',
  'node_modules/effect',
  'node_modules/jiti',
  'package-lock.json',
]) {
  rmSync(resolve(output, packagePath), { recursive: true, force: true });
}
console.info(`Yandex Cloud Function package ready at ${output}`);
