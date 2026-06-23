// scripts/set-version.mjs
// Atualiza a FONTE ÚNICA de versão: o campo "version" do package.json.
// O version.ts (via Vite) e o android/app/build.gradle leem dela.
// Uso: npm run version:set 4.3.3
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = join(__dirname, '..', 'package.json');

const input = process.argv[2];
if (!input) {
  console.error('\n❌ Informe a versão. Ex: npm run version:set 4.3.3\n');
  process.exit(1);
}
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
if (!m) {
  console.error(`\n❌ Formato inválido: "${input}". Use major.minor.patch (ex: 4.3.3).\n`);
  process.exit(1);
}

// Limite por causa do versionCode do Android (x*10000 + y*100 + z):
// minor e patch precisam ficar abaixo de 100.
const [, major, minor, patch] = m;
if (Number(minor) > 99 || Number(patch) > 99) {
  console.error('\n❌ minor e patch devem ser < 100 (limite do versionCode Android).\n');
  process.exit(1);
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(PKG, 'utf8'));
} catch (err) {
  console.error('\n❌ Não consegui ler o package.json.\n', err.message);
  process.exit(1);
}

const old = pkg.version;
pkg.version = `${major}.${minor}.${patch}`;
// Mantém a formatação com 2 espaços e quebra de linha final (padrão npm).
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const code = Number(major) * 10000 + Number(minor) * 100 + Number(patch);
console.log(`\n✅ Versão: ${old} → ${pkg.version}  (versionCode Android: ${code})\n`);
