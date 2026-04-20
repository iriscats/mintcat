#!/usr/bin/env node
/**
 * 为发布的内部资源 zip 生成 .torrent 文件（含 Web Seed / BEP 19）。
 *
 * 用法：
 *   node scripts/make-torrent.mjs <file> --web-seed <https-url> [options]
 *
 * 例：
 *   node scripts/make-torrent.mjs dist/UE4SSL.zip \
 *     --web-seed https://releases.mint.cat/ue4ssl/1.2.3/windows/stable/UE4SSL.zip \
 *     --name UE4SSL.zip \
 *     --piece-length 4194304 \
 *     --tracker udp://tracker.opentrackr.org:1337/announce \
 *     --tracker udp://tracker.openbittorrent.com:6969/announce \
 *     --out dist/UE4SSL.zip.torrent
 *
 * 同时会在 stdout 打印对应的 magnet URI（含 ws= 指向 Web Seed），方便写入 checkUpdatesBatch 返回体。
 *
 * 说明：这是无第三方依赖的最小 BEP 3/BEP 12/BEP 19 .torrent 生成器，
 * 使用 Node 内置 crypto/fs。piece_length 默认 4 MiB，是 UE4SSL/DRG 级别 zip 的合理折中。
 */
import { createHash } from 'node:crypto';
import { createReadStream, statSync, writeFileSync } from 'node:fs';
import { argv, exit, stdout } from 'node:process';
import { basename } from 'node:path';

function parseArgs(argv) {
    const args = {
        _: [],
        trackers: [],
        webSeeds: [],
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const eat = () => argv[++i];
        switch (a) {
            case '-h':
            case '--help': args.help = true; break;
            case '--name': args.name = eat(); break;
            case '--piece-length': args.pieceLength = parseInt(eat(), 10); break;
            case '--tracker':
            case '--announce': args.trackers.push(eat()); break;
            case '--web-seed':
            case '--url-list': args.webSeeds.push(eat()); break;
            case '--out': args.out = eat(); break;
            case '--comment': args.comment = eat(); break;
            case '--private': args.private = true; break;
            default:
                if (a.startsWith('-')) {
                    console.error(`Unknown option: ${a}`);
                    exit(2);
                }
                args._.push(a);
        }
    }
    return args;
}

function bencode(v) {
    if (Buffer.isBuffer(v)) {
        return Buffer.concat([Buffer.from(`${v.length}:`), v]);
    }
    if (typeof v === 'string') {
        const b = Buffer.from(v, 'utf8');
        return Buffer.concat([Buffer.from(`${b.length}:`), b]);
    }
    if (typeof v === 'number' || typeof v === 'bigint') {
        return Buffer.from(`i${v}e`);
    }
    if (Array.isArray(v)) {
        return Buffer.concat([Buffer.from('l'), ...v.map(bencode), Buffer.from('e')]);
    }
    if (v && typeof v === 'object') {
        const keys = Object.keys(v).sort();
        const parts = [Buffer.from('d')];
        for (const k of keys) {
            if (v[k] === undefined || v[k] === null) continue;
            parts.push(bencode(k), bencode(v[k]));
        }
        parts.push(Buffer.from('e'));
        return Buffer.concat(parts);
    }
    throw new Error(`Unsupported bencode type: ${typeof v}`);
}

async function computePieces(path, pieceLength) {
    return new Promise((resolve, reject) => {
        const hashes = [];
        let buffer = Buffer.alloc(0);
        const stream = createReadStream(path, { highWaterMark: 1024 * 1024 });
        stream.on('data', (chunk) => {
            buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
            while (buffer.length >= pieceLength) {
                const piece = buffer.subarray(0, pieceLength);
                hashes.push(createHash('sha1').update(piece).digest());
                buffer = buffer.subarray(pieceLength);
            }
        });
        stream.on('end', () => {
            if (buffer.length > 0) {
                hashes.push(createHash('sha1').update(buffer).digest());
            }
            resolve(Buffer.concat(hashes));
        });
        stream.on('error', reject);
    });
}

function infoHashHex(infoDict) {
    return createHash('sha1').update(bencode(infoDict)).digest('hex');
}

function buildMagnet(infoHashHex, name, trackers, webSeeds) {
    const parts = [`magnet:?xt=urn:btih:${infoHashHex}`];
    if (name) parts.push(`dn=${encodeURIComponent(name)}`);
    for (const tr of trackers) parts.push(`tr=${encodeURIComponent(tr)}`);
    for (const ws of webSeeds) parts.push(`ws=${encodeURIComponent(ws)}`);
    return parts.join('&');
}

async function main() {
    const args = parseArgs(argv);
    if (args.help || args._.length === 0) {
        console.log(`Usage:\n  make-torrent.mjs <file> --web-seed <https-url> [--tracker udp://...] [--name <str>] [--piece-length <bytes>] [--out <path>]`);
        exit(args.help ? 0 : 2);
    }
    const filePath = args._[0];
    const stat = statSync(filePath);
    if (!stat.isFile()) {
        console.error(`Not a file: ${filePath}`);
        exit(1);
    }
    const name = args.name || basename(filePath);
    const pieceLength = args.pieceLength || 4 * 1024 * 1024;
    const trackers = args.trackers.length > 0 ? args.trackers : [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
    ];

    if (args.webSeeds.length === 0) {
        console.warn('[warn] no --web-seed provided; clients without peers will not be able to fall back to HTTP via BT');
    }

    const pieces = await computePieces(filePath, pieceLength);
    const info = {
        length: stat.size,
        name,
        'piece length': pieceLength,
        pieces,
    };
    if (args.private) info.private = 1;

    const announce = trackers[0];
    const announceList = trackers.length > 1 ? trackers.map((t) => [t]) : undefined;

    const torrent = {
        announce,
        ...(announceList ? { 'announce-list': announceList } : {}),
        ...(args.webSeeds.length > 0 ? { 'url-list': args.webSeeds.length === 1 ? args.webSeeds[0] : args.webSeeds } : {}),
        'created by': 'mintcat-make-torrent',
        'creation date': Math.floor(Date.now() / 1000),
        ...(args.comment ? { comment: args.comment } : {}),
        encoding: 'UTF-8',
        info,
    };

    const torrentBytes = bencode(torrent);
    const outPath = args.out || `${filePath}.torrent`;
    writeFileSync(outPath, torrentBytes);

    const hex = infoHashHex(info);
    const magnet = buildMagnet(hex, name, trackers, args.webSeeds);

    stdout.write(JSON.stringify({
        torrent: outPath,
        infoHash: hex,
        name,
        length: stat.size,
        pieceLength,
        magnet,
    }, null, 2) + '\n');
}

main().catch((e) => { console.error(e); exit(1); });
