import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'release', 'frontend');
const packageJsonPath = path.join(projectRoot, 'package.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const outputZip = path.join(outputDir, `mintcat-frontend_${version}.zip`);
const manifestTemplate = path.join(outputDir, `mintcat-frontend_${version}.manifest.example.json`);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html not found. Run npm run build before packaging frontend zip.');
}

fs.mkdirSync(outputDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function collectFiles(dir, baseDir = dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(fullPath, baseDir);
      }
      if (!entry.isFile()) {
        return [];
      }
      return [{
        fullPath,
        relativePath: path.relative(baseDir, fullPath).split(path.sep).join('/'),
      }];
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function uint16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of collectFiles(distDir)) {
  const data = fs.readFileSync(file.fullPath);
  const name = Buffer.from(file.relativePath, 'utf8');
  const stat = fs.statSync(file.fullPath);
  const { dosDate, dosTime } = dosDateTime(stat.mtime);
  const checksum = crc32(data);

  const localHeader = Buffer.concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(dosTime),
    uint16(dosDate),
    uint32(checksum),
    uint32(data.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    name,
  ]);

  localParts.push(localHeader, data);

  const centralHeader = Buffer.concat([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(dosTime),
    uint16(dosDate),
    uint32(checksum),
    uint32(data.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(offset),
    name,
  ]);

  centralParts.push(centralHeader);
  offset += localHeader.length + data.length;
}

const centralDirectory = Buffer.concat(centralParts);
const endOfCentralDirectory = Buffer.concat([
  uint32(0x06054b50),
  uint16(0),
  uint16(0),
  uint16(centralParts.length),
  uint16(centralParts.length),
  uint32(centralDirectory.length),
  uint32(offset),
  uint16(0),
]);

const zip = Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
fs.writeFileSync(outputZip, zip);

const sha256 = crypto.createHash('sha256').update(zip).digest('hex');
fs.writeFileSync(`${outputZip}.sha256`, `${sha256}  ${path.basename(outputZip)}\n`);

const manifest = {
  version,
  url: `https://example.com/mintcat/frontend/${path.basename(outputZip)}`,
  sha256,
  signature: '',
  minAppVersion: version,
  maxAppVersion: version,
  entry: 'index.html',
};
fs.writeFileSync(manifestTemplate, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Frontend zip created: ${path.relative(projectRoot, outputZip)}`);
console.log(`SHA-256: ${sha256}`);
console.log(`Manifest template: ${path.relative(projectRoot, manifestTemplate)}`);
