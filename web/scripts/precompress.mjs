// Runs after `vite build` (npm postbuild): pre-compress every text asset in dist/ with Brotli and gzip.
// The server (staticPrecompressed) serves the .br/.gz file when the browser accepts it, so the big JS/CSS
// chunks go over the wire 4-5x smaller with zero per-request CPU. One-time cost at build.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

const DIR = "dist";
const EXT = new Set([".js", ".css", ".html", ".svg", ".json", ".webmanifest", ".txt", ".map", ".ico"]);
const MIN = 1024; // not worth compressing tiny files

let files = 0, before = 0, afterBr = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { walk(p); continue; }
    if (name.endsWith(".br") || name.endsWith(".gz")) continue;
    if (!EXT.has(extname(name).toLowerCase()) || s.size < MIN) continue;
    const buf = readFileSync(p);
    const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
    const gz = gzipSync(buf, { level: 9 });
    writeFileSync(p + ".br", br);
    writeFileSync(p + ".gz", gz);
    files++; before += s.size; afterBr += br.length;
  }
}
walk(DIR);
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`precompressed ${files} files: ${kb(before)} -> ${kb(afterBr)} brotli (${(100 - (afterBr / before) * 100).toFixed(0)}% smaller)`);
