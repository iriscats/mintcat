import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'release', 'frontend');
const packageJsonPath = path.join(projectRoot, 'package.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const outputZip = path.join(outputDir, `mintcat-frontend_${version}.zip`);
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_UTF8_FLAG = 0x0800;

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

function compressFile(data) {
  if (data.length === 0) {
    return { method: ZIP_METHOD_STORE, payload: data };
  }

  const compressed = zlib.deflateRawSync(data, { level: zlib.constants.Z_BEST_COMPRESSION });
  return compressed.length < data.length
    ? { method: ZIP_METHOD_DEFLATE, payload: compressed }
    : { method: ZIP_METHOD_STORE, payload: data };
}

const localParts = [];
const centralParts = [];
let offset = 0;
let totalInputSize = 0;
let totalStoredSize = 0;

for (const file of collectFiles(distDir)) {
  const data = fs.readFileSync(file.fullPath);
  const { method, payload } = compressFile(data);
  const name = Buffer.from(file.relativePath, 'utf8');
  const stat = fs.statSync(file.fullPath);
  const { dosDate, dosTime } = dosDateTime(stat.mtime);
  const checksum = crc32(data);
  totalInputSize += data.length;
  totalStoredSize += payload.length;

  const localHeader = Buffer.concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(ZIP_UTF8_FLAG),
    uint16(method),
    uint16(dosTime),
    uint16(dosDate),
    uint32(checksum),
    uint32(payload.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    name,
  ]);

  localParts.push(localHeader, payload);

  const centralHeader = Buffer.concat([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(ZIP_UTF8_FLAG),
    uint16(method),
    uint16(dosTime),
    uint16(dosDate),
    uint32(checksum),
    uint32(payload.length),
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
  offset += localHeader.length + payload.length;
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

console.log(`Frontend zip created: ${path.relative(projectRoot, outputZip)}`);
console.log(`Compressed payload: ${totalStoredSize} / ${totalInputSize} bytes (${((totalStoredSize / totalInputSize) * 100).toFixed(2)}%)`);
