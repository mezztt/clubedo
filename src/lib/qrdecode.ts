/* eslint-disable */
// Decodificador de códigos QR en TypeScript puro, sin dependencias, + helper de cámara compartido.
//
//   decodeQR(rgba, width, height) -> string | null     (rgba = ImageData.data de un canvas)
//   startCameraScan(video, onResult, opts) -> { stop() }  (BarcodeDetector si existe; si no, este decodificador)
//
// Pipeline: gris -> binarizado adaptativo local (media/desvío por ventana, imagen integral) -> detección de finder patterns
// (1:1:3:1:1 en filas, verificado en columnas) -> elección de la terna TL/TR/BL -> versión por dimensión + patrón de timing
// -> patrón de alineación -> homografía -> muestreo de la grilla -> formato (BCH) / versión (BCH) -> desenmascarado ->
// codewords -> Reed-Solomon (GF(256)) -> modos numérico / alfanumérico / byte / kanji / ECI. Versiones 1 a 40, QR rotados,
// claro sobre oscuro (invertidos) y módulos chicos. Un frame de 640x480 se resuelve en ~5-20 ms.
// Pruebas reproducibles: _shared/qrtest/ (gen.py, gen2.py, run.mjs, cv2base.py, README.txt).

// ===================================================================================================================
// Tablas del estándar
// ===================================================================================================================
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // L
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // M
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Q
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // H
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
// Bits de formato -> índice de nivel en las tablas (L=0, M=1, Q=2, H=3)
const FORMAT_BITS_TO_LEVEL = [1, 0, 3, 2];

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = ver * 4 + 17;
  const result = [6];
  const tail: number[] = [];
  for (let pos = size - 7, n = 1; n < numAlign; pos -= step, n++) tail.push(pos);
  tail.reverse();
  return result.concat(tail);
}

// ===================================================================================================================
// GF(256) y Reed-Solomon
// ===================================================================================================================
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);
const gfDiv = (a: number, b: number) => (a === 0 ? 0 : GF_EXP[GF_LOG[a] + 255 - GF_LOG[b]]);

/** Corrige `cw` (datos + ecc, el primero es el coeficiente de mayor grado) en el lugar. false si no se puede. */
function rsCorrect(cw: Uint8Array, nsym: number): boolean {
  const n = cw.length;
  const synd = new Uint8Array(nsym);
  let bad = false;
  for (let i = 0; i < nsym; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s = gfMul(s, GF_EXP[i]) ^ cw[j];
    synd[i] = s;
    if (s) bad = true;
  }
  if (!bad) return true;

  // Berlekamp-Massey
  let C = [1];
  let B = [1];
  let L = 0, m = 1, b = 1;
  for (let i = 0; i < nsym; i++) {
    let d = synd[i];
    for (let j = 1; j <= L; j++) if (j < C.length) d ^= gfMul(C[j], synd[i - j]);
    if (d === 0) { m++; continue; }
    const T = C.slice();
    const coef = gfDiv(d, b);
    while (C.length < B.length + m) C.push(0);
    for (let j = 0; j < B.length; j++) C[j + m] ^= gfMul(coef, B[j]);
    if (2 * L <= i) { L = i + 1 - L; B = T; b = d; m = 1; } else m++;
  }
  while (C.length > 1 && C[C.length - 1] === 0) C.pop();
  const nerr = C.length - 1;
  if (nerr === 0 || nerr * 2 > nsym) return false;

  // Chien: posición p (0 = primero) tiene X = alpha^(n-1-p); es raíz si C(X^-1) = 0
  const pos: number[] = [];
  for (let p = 0; p < n; p++) {
    const xinvExp = (255 - ((n - 1 - p) % 255)) % 255; // exponente de X^-1
    let v = 0;
    for (let j = 0; j <= nerr; j++) if (C[j]) v ^= GF_EXP[(GF_LOG[C[j]] + j * xinvExp) % 255];
    if (v === 0) pos.push(p);
  }
  if (pos.length !== nerr) return false;

  // Omega = S(x) * C(x) mod x^nsym  (S(x) = sum synd[i] x^i)
  const omega = new Uint8Array(nsym);
  for (let i = 0; i < nsym; i++) {
    let v = 0;
    for (let j = 0; j <= i && j <= nerr; j++) v ^= gfMul(C[j], synd[i - j]);
    omega[i] = v;
  }
  for (const p of pos) {
    const xe = (n - 1 - p) % 255;
    const X = GF_EXP[xe];
    const xinvExp = (255 - xe) % 255;
    let om = 0;
    for (let j = 0; j < nsym; j++) if (omega[j]) om ^= GF_EXP[(GF_LOG[omega[j]] + j * xinvExp) % 255];
    // derivada formal de C evaluada en X^-1: solo términos impares
    let dv = 0;
    for (let j = 1; j <= nerr; j += 2) if (C[j]) dv ^= GF_EXP[(GF_LOG[C[j]] + (j - 1) * xinvExp) % 255];
    if (dv === 0) return false;
    cw[p] ^= gfMul(X, gfDiv(om, dv));
  }
  // verificación
  for (let i = 0; i < nsym; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s = gfMul(s, GF_EXP[i]) ^ cw[j];
    if (s) return false;
  }
  return true;
}

// ===================================================================================================================
// Matriz de módulos -> texto
// ===================================================================================================================
function popcount(x: number): number {
  let c = 0;
  while (x) { c += x & 1; x >>>= 1; }
  return c;
}

const FORMAT_CODES: number[] = (() => {
  const out: number[] = [];
  for (let d = 0; d < 32; d++) {
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    out.push(((d << 10) | rem) ^ 0x5412);
  }
  return out;
})();
const VERSION_CODES: number[] = (() => {
  const out: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (let v = 7; v <= 40; v++) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    out[v] = (v << 12) | rem;
  }
  return out;
})();

class Matrix {
  data: Uint8Array;
  constructor(public size: number) { this.data = new Uint8Array(size * size); }
  get(x: number, y: number): number { return this.data[y * this.size + x]; }
}

function readFormat(m: Matrix): { level: number; mask: number; dist: number } | null {
  const s = m.size;
  let a = 0, b = 0;
  // copia 1
  for (let i = 0; i <= 5; i++) a |= m.get(8, i) << i;
  a |= m.get(8, 7) << 6;
  a |= m.get(8, 8) << 7;
  a |= m.get(7, 8) << 8;
  for (let i = 9; i < 15; i++) a |= m.get(14 - i, 8) << i;
  // copia 2
  for (let i = 0; i < 8; i++) b |= m.get(s - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) b |= m.get(8, s - 15 + i) << i;
  let best = -1, bd = 99;
  for (let d = 0; d < 32; d++) {
    const dd = Math.min(popcount(a ^ FORMAT_CODES[d]), popcount(b ^ FORMAT_CODES[d]));
    if (dd < bd) { bd = dd; best = d; }
  }
  if (bd > 3) return null;
  return { level: FORMAT_BITS_TO_LEVEL[best >> 3], mask: best & 7, dist: bd };
}

/** Filtro barato: las dos copias de la info de formato deben coincidir con un mismo código (distancia total <= 6). */
function formatConsistent(m: Matrix): boolean {
  const s = m.size;
  let a = 0, b = 0;
  for (let i = 0; i <= 5; i++) a |= m.get(8, i) << i;
  a |= m.get(8, 7) << 6; a |= m.get(8, 8) << 7; a |= m.get(7, 8) << 8;
  for (let i = 9; i < 15; i++) a |= m.get(14 - i, 8) << i;
  for (let i = 0; i < 8; i++) b |= m.get(s - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) b |= m.get(8, s - 15 + i) << i;
  for (let d = 0; d < 32; d++) if (popcount(a ^ FORMAT_CODES[d]) + popcount(b ^ FORMAT_CODES[d]) <= 6) return true;
  return false;
}

/** Igual que finderMatch pero directo sobre la imagen, con la escala local de cada finder (robusto a perspectiva fuerte). */
function finderMatchImg(S: Sampler, t: Triple, corr: number): number {
  const { tl, tr, bl } = t;
  const ex = Math.hypot(tr.x - tl.x, tr.y - tl.y), ey = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const ux = [(tr.x - tl.x) / ex, (tr.y - tl.y) / ex], uy = [(bl.x - tl.x) / ey, (bl.y - tl.y) / ey];
  let ok = 0;
  for (const f of [tl, tr, bl]) {
    const m = f.s * corr;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
      const x = f.x + (ux[0] * i + uy[0] * j) * m, y = f.y + (ux[1] * i + uy[1] * j) * m;
      const ring = Math.max(Math.abs(i), Math.abs(j));
      if (S.at(x, y) === (ring === 2 ? 0 : 1)) ok++;
    }
  }
  return ok / 147;
}

function readVersion(m: Matrix): number | null {
  const s = m.size;
  if (s < 45) return null;
  let a = 0, b = 0;
  for (let i = 0; i < 18; i++) {
    a |= m.get(s - 11 + (i % 3), Math.floor(i / 3)) << i;
    b |= m.get(Math.floor(i / 3), s - 11 + (i % 3)) << i;
  }
  let best = -1, bd = 99;
  for (let v = 7; v <= 40; v++) {
    const dd = Math.min(popcount(a ^ VERSION_CODES[v]), popcount(b ^ VERSION_CODES[v]));
    if (dd < bd) { bd = dd; best = v; }
  }
  return bd <= 3 ? best : null;
}

function functionMask(ver: number): Uint8Array {
  const size = ver * 4 + 17;
  const f = new Uint8Array(size * size);
  const fill = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < size && y < size) f[y * size + x] = 1;
  };
  fill(0, 0, 9, 9); // finder + separador + formato
  fill(size - 8, 0, 8, 9);
  fill(0, size - 8, 9, 8);
  fill(6, 0, 1, size); // timing
  fill(0, 6, size, 1);
  if (ver >= 2) {
    const pos = alignmentPositions(ver);
    const n = pos.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      fill(pos[i] - 2, pos[j] - 2, 5, 5);
    }
  }
  if (ver >= 7) { fill(size - 11, 0, 3, 6); fill(0, size - 11, 6, 3); }
  return f;
}
const FMASK_CACHE: Uint8Array[] = [];

function maskBit(mask: number, x: number, y: number): number {
  switch (mask) {
    case 0: return (x + y) % 2 === 0 ? 1 : 0;
    case 1: return y % 2 === 0 ? 1 : 0;
    case 2: return x % 3 === 0 ? 1 : 0;
    case 3: return (x + y) % 3 === 0 ? 1 : 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0 ? 1 : 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0 ? 1 : 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0 ? 1 : 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0 ? 1 : 0;
  }
}

class BitReader {
  pos = 0;
  constructor(public bytes: Uint8Array) {}
  left() { return this.bytes.length * 8 - this.pos; }
  read(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v << 1) | ((this.bytes[this.pos >> 3] >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
    return v;
  }
}

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function bytesToString(bytes: number[], eci: number): string {
  const u8 = Uint8Array.from(bytes);
  const TD: any = typeof TextDecoder !== "undefined" ? TextDecoder : null;
  if (eci === 20 && TD) { try { return new TD("shift_jis").decode(u8); } catch { /* sigue */ } }
  if (eci === 3 || eci === 1) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return s; }
  // UTF-8 (ECI 26 o por defecto); si no es UTF-8 válido, Latin-1
  if (TD) { try { return new TD("utf-8", { fatal: true }).decode(u8); } catch { /* sigue */ } }
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}

function parseSegments(data: Uint8Array, ver: number): string | null {
  const r = new BitReader(data);
  const cc = (n9: number, n26: number, n40: number) => (ver <= 9 ? n9 : ver <= 26 ? n26 : n40);
  let out = "";
  let pending: number[] = []; // bytes crudos acumulados (para decodificar UTF-8 de varios segmentos juntos)
  let eci = 26;
  const flush = () => { if (pending.length) { out += bytesToString(pending, eci); pending = []; } };
  while (r.left() >= 4) {
    const mode = r.read(4);
    if (mode === 0) break;
    if (mode === 1) { // numérico
      flush();
      let n = r.read(cc(10, 12, 14));
      while (n >= 3) { if (r.left() < 10) return null; const v = r.read(10); if (v >= 1000) return null; out += String(v).padStart(3, "0"); n -= 3; }
      if (n === 2) { if (r.left() < 7) return null; const v = r.read(7); if (v >= 100) return null; out += String(v).padStart(2, "0"); }
      else if (n === 1) { if (r.left() < 4) return null; const v = r.read(4); if (v >= 10) return null; out += String(v); }
    } else if (mode === 2) { // alfanumérico
      flush();
      let n = r.read(cc(9, 11, 13));
      while (n >= 2) { if (r.left() < 11) return null; const v = r.read(11); if (v >= 2025) return null; out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; n -= 2; }
      if (n === 1) { if (r.left() < 6) return null; const v = r.read(6); if (v >= 45) return null; out += ALNUM[v]; }
    } else if (mode === 4) { // byte
      const n = r.read(cc(8, 16, 16));
      if (r.left() < n * 8) return null;
      for (let i = 0; i < n; i++) pending.push(r.read(8));
    } else if (mode === 8) { // kanji
      flush();
      const n = r.read(cc(8, 10, 12));
      if (r.left() < n * 13) return null;
      const sj: number[] = [];
      for (let i = 0; i < n; i++) {
        const v = r.read(13);
        let a = Math.floor(v / 0xc0) << 8 | (v % 0xc0);
        a += a < 0x1f00 ? 0x8140 : 0xc140;
        sj.push(a >> 8, a & 255);
      }
      out += bytesToString(sj, 20);
    } else if (mode === 7) { // ECI
      flush();
      let v = r.read(8);
      if ((v & 0x80) === 0) eci = v;
      else if ((v & 0xc0) === 0x80) eci = ((v & 0x3f) << 8) | r.read(8);
      else eci = ((v & 0x1f) << 16) | r.read(16);
    } else if (mode === 3) { // structured append: 4 + 4 + 8 bits
      if (r.left() < 16) return null;
      r.read(16);
    } else if (mode === 5 || mode === 9) { // FNC1: sin efecto sobre el texto
      if (mode === 9) r.read(8);
    } else {
      return null;
    }
  }
  flush();
  return out;
}

/** m: módulos oscuros = 1. Devuelve el texto o null. */
function decodeMatrix(m: Matrix): string | null {
  const size = m.size;
  if ((size - 17) % 4 !== 0 || size < 21 || size > 177) return null;
  let ver = (size - 17) / 4;
  const fmt = readFormat(m);
  if (!fmt) return null;
  if (ver >= 7) {
    const v2 = readVersion(m);
    if (v2 !== null && v2 !== ver) return null;
  }
  const fm = FMASK_CACHE[ver] || (FMASK_CACHE[ver] = functionMask(ver));
  const rawCw = Math.floor(numRawDataModules(ver) / 8);
  const bytes = new Uint8Array(rawCw);
  let bit = 0;
  const total = rawCw * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fm[y * size + x] && bit < total) {
          const v = m.data[y * size + x] ^ maskBit(fmt.mask, x, y);
          bytes[bit >> 3] |= v << (7 - (bit & 7));
          bit++;
        }
      }
    }
  }
  if (bit !== total) return null;

  const nBlocks = NUM_ERROR_CORRECTION_BLOCKS[fmt.level][ver];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[fmt.level][ver];
  const numShort = nBlocks - (rawCw % nBlocks);
  const shortLen = Math.floor(rawCw / nBlocks);
  const blocks: number[][] = [];
  for (let i = 0; i < nBlocks; i++) blocks.push([]);
  let k = 0;
  for (let i = 0; i <= shortLen; i++) {
    for (let j = 0; j < nBlocks; j++) {
      if (i !== shortLen - eccLen || j >= numShort) {
        if (k >= rawCw) break;
        blocks[j].push(bytes[k++]);
      }
    }
  }
  const data: number[] = [];
  for (const blk of blocks) {
    const arr = Uint8Array.from(blk);
    if (!rsCorrect(arr, eccLen)) return null;
    for (let i = 0; i < arr.length - eccLen; i++) data.push(arr[i]);
  }
  return parseSegments(Uint8Array.from(data), ver);
}

// ===================================================================================================================
// Imagen: gris, reducción, binarizado
// ===================================================================================================================
interface Gray { w: number; h: number; d: Uint8Array }

function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const d = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return { w, h, d };
}

function shrink(g: Gray, f: number): Gray {
  if (f <= 1) return g;
  const w = Math.floor(g.w / f), h = Math.floor(g.h / f);
  const d = new Uint8Array(w * h);
  const area = f * f;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let yy = 0; yy < f; yy++) { const o = (y * f + yy) * g.w + x * f; for (let xx = 0; xx < f; xx++) s += g.d[o + xx]; }
      d[y * w + x] = (s / area + 0.5) | 0;
    }
  }
  return { w, h, d };
}

/** Binarizado adaptativo: negro si el gris < media local - k*desvío; ventanas planas (sin contraste) = blanco. 1 = negro. */
const INTEG: { a: Float64Array | null; b: Float64Array | null } = { a: null, b: null };
function binarize(g: Gray): Uint8Array {
  const { w, h, d } = g;
  const W = w + 1;
  const need = W * (h + 1);
  if (!INTEG.a || INTEG.a.length < need) { INTEG.a = new Float64Array(need); INTEG.b = new Float64Array(need); }
  const I = INTEG.a as Float64Array, I2 = INTEG.b as Float64Array;
  for (let y = 0; y < h; y++) {
    let rs = 0, rs2 = 0;
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      rs += v; rs2 += v * v;
      I[(y + 1) * W + x + 1] = I[y * W + x + 1] + rs;
      I2[(y + 1) * W + x + 1] = I2[y * W + x + 1] + rs2;
    }
  }
  const r = Math.max(6, Math.min(40, Math.round(Math.max(w, h) / 16)));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
      const s2 = I2[y1 * W + x1] - I2[y0 * W + x1] - I2[y1 * W + x0] + I2[y0 * W + x0];
      const mean = s / n;
      const v2 = s2 / n - mean * mean;
      if (v2 < 144) { out[y * w + x] = 0; continue; } // desvío < 12: zona plana -> fondo
      const sd = Math.sqrt(v2);
      out[y * w + x] = d[y * w + x] < mean - 0.12 * sd ? 1 : 0;
    }
  }
  return out;
}

// ===================================================================================================================
// Finder patterns
// ===================================================================================================================
interface FP { x: number; y: number; s: number; n: number }

function ratioOK(c: number[], tolF: number): boolean {
  const t = c[0] + c[1] + c[2] + c[3] + c[4];
  if (t < 7) return false;
  const m = t / 7, tol = m * tolF;
  return Math.abs(c[0] - m) < tol && Math.abs(c[1] - m) < tol && Math.abs(c[2] - 3 * m) < 3 * tol && Math.abs(c[3] - m) < tol && Math.abs(c[4] - m) < tol;
}

/** Recorre desde (x,y) en dirección (dx,dy) contando negro/blanco/negro hacia ambos lados. Devuelve [counts, centro a lo largo del eje] o null. */
function crossCheck(bin: Uint8Array, w: number, h: number, x: number, y: number, dx: number, dy: number, maxTotal: number): { c: number[]; center: number } | null {
  const c = [0, 0, 0, 0, 0];
  let px = x, py = y;
  const at = (a: number, b: number) => bin[b * w + a];
  if (!at(px, py)) return null;
  // hacia atrás
  let i = 2;
  let cx = px, cy = py;
  let lim = maxTotal;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 1) { c[2]++; cx -= dx; cy -= dy; if (c[2] > lim) return null; }
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 0) { c[1]++; cx -= dx; cy -= dy; if (c[1] > lim) return null; }
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 1) { c[0]++; cx -= dx; cy -= dy; if (c[0] > lim) return null; }
  // hacia adelante
  cx = px + dx; cy = py + dy;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 1) { c[2]++; cx += dx; cy += dy; if (c[2] > lim) return null; }
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 0) { c[3]++; cx += dx; cy += dy; if (c[3] > lim) return null; }
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  while (cx >= 0 && cy >= 0 && cx < w && cy < h && at(cx, cy) === 1) { c[4]++; cx += dx; cy += dy; if (c[4] > lim) return null; }
  void i;
  if (!ratioOK(c, 0.8)) return null;
  // centro: posición del píxel central. c[2] cuenta el píxel (x,y) una vez en el backward; ajustamos
  // El centro del run medio, en coordenadas a lo largo del eje, relativo a (x,y):
  const back = (() => { let n = 0, a = px - dx, b = py - dy; while (a >= 0 && b >= 0 && a < w && b < h && at(a, b) === 1) { n++; a -= dx; b -= dy; } return n; })();
  const fwd = c[2] - 1 - back;
  const center = (fwd - back) / 2; // desplazamiento del centro del run respecto de (x,y), en píxeles
  return { c, center };
}

function findFinders(bin: Uint8Array, w: number, h: number): FP[] {
  const found: FP[] = [];
  const rl: number[] = [];
  const skip = h > 900 ? 2 : 1;
  for (let y = 0; y < h; y += skip) {
    rl.length = 0;
    const row = y * w;
    let cur = bin[row], len = 1;
    const first = cur;
    for (let x = 1; x < w; x++) {
      const v = bin[row + x];
      if (v === cur) len++;
      else { rl.push(len); cur = v; len = 1; }
    }
    rl.push(len);
    // runs: color del run j = first ^ (j & 1)
    // buscamos N B N B N -> run j (negro) con j-4..j
    let startOf = 0;
    const n = rl.length;
    // posición de inicio de cada run
    const starts: number[] = new Array(n);
    for (let j = 0; j < n; j++) { starts[j] = startOf; startOf += rl[j]; }
    for (let j = 4; j < n; j++) {
      if ((first ^ (j & 1)) !== 1) continue;
      const c = [rl[j - 4], rl[j - 3], rl[j - 2], rl[j - 1], rl[j]];
      if (!ratioOK(c, 0.7)) continue;
      const total = c[0] + c[1] + c[2] + c[3] + c[4];
      let cx = starts[j - 2] + (rl[j - 2] - 1) / 2;
      let cy = y;
      const ix = Math.round(cx);
      // vertical
      const v1 = crossCheck(bin, w, h, ix, cy, 0, 1, total * 2);
      if (!v1) continue;
      cy = cy + v1.center;
      const iy = Math.round(cy);
      const h1 = crossCheck(bin, w, h, ix, iy, 1, 0, total * 2);
      if (!h1) continue;
      cx = ix + h1.center;
      const v2 = crossCheck(bin, w, h, Math.round(cx), iy, 0, 1, total * 2);
      if (!v2) continue;
      cy = iy + v2.center;
      const hs = h1.c[0] + h1.c[1] + h1.c[2] + h1.c[3] + h1.c[4];
      const vs = v2.c[0] + v2.c[1] + v2.c[2] + v2.c[3] + v2.c[4];
      if (Math.abs(hs - vs) > 0.6 * Math.max(hs, vs)) continue;
      const s = (hs + vs) / 14;
      // fusionar con uno cercano
      let merged = false;
      for (const f of found) {
        const dx = f.x - cx, dy = f.y - cy;
        if (dx * dx + dy * dy < (1.6 * Math.max(f.s, s)) ** 2 && Math.abs(f.s - s) < 0.6 * Math.max(f.s, s)) {
          f.x = (f.x * f.n + cx) / (f.n + 1);
          f.y = (f.y * f.n + cy) / (f.n + 1);
          f.s = (f.s * f.n + s) / (f.n + 1);
          f.n++;
          merged = true;
          break;
        }
      }
      if (!merged) found.push({ x: cx, y: cy, s, n: 1 });
    }
  }
  return found;
}

interface Triple { tl: FP; tr: FP; bl: FP; score: number }

function chooseTriples(all: FP[]): Triple[] {
  let c = all.filter((f) => f.n >= 2);
  if (c.length < 3) return [];
  c.sort((a, b) => b.n * b.s - a.n * a.s);
  c = c.slice(0, 14);
  const out: Triple[] = [];
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) for (let k = j + 1; k < c.length; k++) {
    const P = [c[i], c[j], c[k]];
    const sMin = Math.min(P[0].s, P[1].s, P[2].s), sMax = Math.max(P[0].s, P[1].s, P[2].s);
    if (sMax > sMin * 1.7) continue;
    // lados
    const d = (a: FP, b: FP) => Math.hypot(a.x - b.x, a.y - b.y);
    const dij = d(P[0], P[1]), djk = d(P[1], P[2]), dik = d(P[0], P[2]);
    // vértice del ángulo recto = opuesto al lado más largo
    let tlIdx: number, a: number, b: number, hyp: number;
    if (dij >= djk && dij >= dik) { tlIdx = 2; a = djk; b = dik; hyp = dij; }
    else if (djk >= dij && djk >= dik) { tlIdx = 0; a = dij; b = dik; hyp = djk; }
    else { tlIdx = 1; a = dij; b = djk; hyp = dik; }
    const sAvg = (P[0].s + P[1].s + P[2].s) / 3;
    if (a < 8 * sAvg || b < 8 * sAvg) continue;
    if (a > 190 * sAvg || b > 190 * sAvg) continue;
    const ratio = a / b;
    if (ratio < 0.6 || ratio > 1.0 / 0.6) continue;
    const hypErr = Math.abs(hyp - Math.sqrt(a * a + b * b)) / hyp;
    if (hypErr > 0.25) continue;
    const tl = P[tlIdx];
    const o = P.filter((_, q) => q !== tlIdx);
    const cross = (o[0].x - tl.x) * (o[1].y - tl.y) - (o[0].y - tl.y) * (o[1].x - tl.x);
    const tr = cross > 0 ? o[0] : o[1];
    const bl = cross > 0 ? o[1] : o[0];
    const score = hypErr + Math.abs(1 - ratio) * 0.5 + (sMax / sMin - 1) * 0.5 - 0.02 * Math.min(P[0].n, P[1].n, P[2].n);
    out.push({ tl, tr, bl, score });
  }
  out.sort((x, y) => x.score - y.score);
  return out.slice(0, 8);
}

// ===================================================================================================================
// Geometría
// ===================================================================================================================
type Xf = (u: number, v: number) => [number, number];

/** Homografía que lleva (u_i, v_i) -> (x_i, y_i) para 4 pares. */
function homography(src: number[][], dst: number[][]): Xf | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i], [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const [a, b, cc, d, e, f, g, hh] = A.map((row, i) => row[8] / row[i]);
  return (u, v) => {
    const z = g * u + hh * v + 1;
    return [(a * u + b * v + cc) / z, (d * u + e * v + f) / z];
  };
}

class Sampler {
  constructor(public bin: Uint8Array, public w: number, public h: number, public gray: Uint8Array) {}
  at(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0;
    return this.bin[iy * this.w + ix];
  }
  /** gris bilineal (el píxel i cubre [i, i+1)) */
  g(x: number, y: number): number {
    const fx = x - 0.5, fy = y - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const w = this.w, h = this.h, d = this.gray;
    const cx = (v: number) => (v < 0 ? 0 : v >= w ? w - 1 : v);
    const cy = (v: number) => (v < 0 ? 0 : v >= h ? h - 1 : v);
    const x1 = cx(x0 + 1), y1 = cy(y0 + 1);
    x0 = cx(x0); y0 = cy(y0);
    return (d[y0 * w + x0] * (1 - tx) + d[y0 * w + x1] * tx) * (1 - ty) + (d[y1 * w + x0] * (1 - tx) + d[y1 * w + x1] * tx) * ty;
  }
}

/** Busca el patrón de alineación (5x5: anillo negro, anillo blanco, centro negro) cerca de la posición prevista (en coordenadas de módulo). */
function findAlignment(S: Sampler, xf: Xf, cu: number, cv: number, range: number): [number, number] | null {
  let best = -1, bu = 0, bv = 0;
  const scoreAt = (u: number, v: number): number => {
    let sc = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const [x, y] = xf(u + i, v + j);
      const ring = Math.max(Math.abs(i), Math.abs(j));
      if (S.at(x, y) === (ring === 1 ? 0 : 1)) sc++;
    }
    return sc;
  };
  for (let dv = -range; dv <= range + 0.001; dv += 0.75) for (let du = -range; du <= range + 0.001; du += 0.75) {
    const s = scoreAt(cu + du, cv + dv) - 0.05 * Math.hypot(du, dv);
    if (s > best) { best = s; bu = du; bv = dv; }
  }
  if (best < 21) return null;
  // refinar
  for (let dv = -0.5; dv <= 0.501; dv += 0.125) for (let du = -0.5; du <= 0.501; du += 0.125) {
    const s = scoreAt(cu + bu + du, cv + bv + dv) - 0.05 * Math.hypot(bu + du, bv + dv);
    if (s > best + 1e-9) { best = s; bu += du; bv += dv; }
  }
  return [cu + bu, cv + bv];
}

/** Matriz de módulos a partir del binarizado (mayoría de 5 puntos) */
function sampleBin(S: Sampler, xf: Xf, dim: number): Matrix {
  const m = new Matrix(dim);
  const o = 0.27;
  for (let j = 0; j < dim; j++) for (let i = 0; i < dim; i++) {
    const u = i + 0.5, v = j + 0.5;
    let [x, y] = xf(u, v);
    let sum = S.at(x, y) * 2;
    [x, y] = xf(u - o, v); sum += S.at(x, y);
    [x, y] = xf(u + o, v); sum += S.at(x, y);
    [x, y] = xf(u, v - o); sum += S.at(x, y);
    [x, y] = xf(u, v + o); sum += S.at(x, y);
    m.data[j * dim + i] = sum >= 4 ? 1 : 0;
  }
  return m;
}

/** Matriz a partir del gris: valor por módulo (centro + 4 vecinos) y umbral local (promedio de ventana en módulos) o global (Otsu). */
function sampleGray(S: Sampler, xf: Xf, dim: number, local: boolean): Matrix {
  const val = new Float32Array(dim * dim);
  const o = 0.25;
  for (let j = 0; j < dim; j++) for (let i = 0; i < dim; i++) {
    const u = i + 0.5, v = j + 0.5;
    let [x, y] = xf(u, v);
    let s = S.g(x, y) * 2;
    [x, y] = xf(u - o, v); s += S.g(x, y);
    [x, y] = xf(u + o, v); s += S.g(x, y);
    [x, y] = xf(u, v - o); s += S.g(x, y);
    [x, y] = xf(u, v + o); s += S.g(x, y);
    val[j * dim + i] = s / 6;
  }
  const m = new Matrix(dim);
  if (!local) {
    const t = otsuF(val);
    for (let k = 0; k < val.length; k++) m.data[k] = val[k] < t ? 1 : 0;
    return m;
  }
  // integral sobre la grilla de módulos
  const r = Math.max(4, Math.round(dim / 5));
  const W = dim + 1, I = new Float64Array(W * W);
  for (let y = 0; y < dim; y++) { let rs = 0; for (let x = 0; x < dim; x++) { rs += val[y * dim + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + rs; } }
  for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(dim, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(dim, y + r + 1);
    const n = (x1 - x0) * (y1 - y0);
    const mean = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / n;
    m.data[y * dim + x] = val[y * dim + x] < mean ? 1 : 0;
  }
  return m;
}

function otsuF(val: Float32Array): number {
  const hist = new Float64Array(256);
  for (let k = 0; k < val.length; k++) hist[Math.max(0, Math.min(255, Math.round(val[k])))]++;
  let total = val.length, sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = -1, thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const bv = wB * wF * (mB - mF) * (mB - mF);
    if (bv > best) { best = bv; thr = i + 0.5; }
  }
  return thr;
}

/** Cuenta corridas negro/blanco a lo largo del segmento entre dos centros de finder, desplazado 3 módulos (fila/columna de timing). dim = corridas + 12. */
function timingRuns(S: Sampler, a: FP, b: FP, c: FP, ms: number, shift: number): number {
  // a = esquina TL, b = extremo del segmento, c = tercer finder (da el lado hacia donde desplazar)
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const L2 = Math.hypot(c.x - a.x, c.y - a.y);
  const vx = (c.x - a.x) / L2, vy = (c.y - a.y) / L2;
  const off = (3 + shift) * ms;
  const x0 = a.x + vx * off, y0 = a.y + vy * off;
  const step = Math.max(0.3, ms / 8);
  const n = Math.floor(L / step);
  const runs: number[] = [];
  let cur = -1, len = 0;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ux * i * step, y = y0 + uy * i * step;
    const v = S.at(x, y);
    if (v === cur) len++; else { if (cur !== -1) runs.push(len); cur = v; len = 1; }
  }
  runs.push(len);
  // absorber corridas espurias (< 0.45 módulo) fusionándolas con sus vecinas
  const minLen = (0.45 * ms) / step;
  let changed = true;
  while (changed && runs.length > 2) {
    changed = false;
    for (let i = 1; i < runs.length - 1; i++) {
      if (runs[i] < minLen) { runs[i - 1] += runs[i] + runs[i + 1]; runs.splice(i, 2); changed = true; break; }
    }
  }
  return runs.length;
}

function tryTriple(S: Sampler, t: Triple): string | null {
  const { tl, tr, bl } = t;
  const dTR = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const dBL = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const ms = (tl.s + tr.s + bl.s) / 3;
  // el tamaño de módulo medido en filas/columnas se infla por 1/cos(θ) en QR rotados
  const ang = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  const corr = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
  const msTrue = ms * corr;
  const dimEst = (dTR + dBL) / 2 / msTrue + 7;
  const v0 = Math.round((dimEst - 17) / 4);
  // candidatos de versión: por conteo de corridas de timing (ambos ejes) y por distancia
  const votes = new Map<number, number>();
  const vote = (dim: number, w: number) => {
    const v = Math.round((dim - 17) / 4);
    if (v < 1 || v > 40) return;
    const exact = Math.abs(dim - (v * 4 + 17)) < 0.01 ? 1 : 0.4;
    votes.set(v, (votes.get(v) || 0) + w * exact);
  };
  for (const sh of [0, -0.25, 0.25]) {
    vote(timingRuns(S, tl, tr, bl, msTrue, sh) + 12, 1);
    vote(timingRuns(S, tl, bl, tr, msTrue, sh) + 12, 1);
  }
  for (const dv of [0, -1, 1]) { const v = v0 + dv; if (v >= 1 && v <= 40) votes.set(v, (votes.get(v) || 0) + (dv === 0 ? 0.5 : 0.1)); }
  const cands = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]);
  const P = [[tl.x, tl.y], [tr.x, tr.y], [bl.x, bl.y]];
  for (const v of cands) {
    const dim = v * 4 + 17;
    const q4 = [tr.x + bl.x - tl.x, tr.y + bl.y - tl.y];
    const aff = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 3.5, dim - 3.5]], [P[0], P[1], P[2], q4]);
    if (!aff) continue;
    const tryXf = (xf: Xf): string | null => {
      let res = decodeMatrix(sampleBin(S, xf, dim));
      if (res !== null) return res;
      res = decodeMatrix(sampleGray(S, xf, dim, false));
      if (res !== null) return res;
      return decodeMatrix(sampleGray(S, xf, dim, true));
    };
    // filtro barato: si el formato (BCH) no se lee con la afín, esta terna/versión es un falso positivo
    const m0 = sampleBin(S, aff, dim);
    if (!formatConsistent(m0)) {
      if (finderMatchImg(S, t, corr) < 0.8) continue;
    }
    let apXf: Xf | null = null;
    if (v >= 2) {
      let ap = findAlignment(S, aff, dim - 6.5, dim - 6.5, 3 + dim / 12);
      if (ap) {
        let q = aff(ap[0], ap[1]);
        apXf = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 6.5, dim - 6.5]], [P[0], P[1], P[2], q]);
        if (apXf) {  // refinar con la nueva proyección
          const ap2 = findAlignment(S, apXf, dim - 6.5, dim - 6.5, 1.5);
          if (ap2) {
            q = apXf(ap2[0], ap2[1]);
            const x3 = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 6.5, dim - 6.5]], [P[0], P[1], P[2], q]);
            if (x3) apXf = x3;
          }
        }
      }
    }
    if (apXf) { const r = tryXf(apXf); if (r !== null) return r; }
    let r0 = decodeMatrix(m0);
    if (r0 === null) r0 = tryXf(aff);
    if (r0 !== null) return r0;
    // último recurso: mover la 4ª esquina (perspectiva sin patrón de alineación utilizable)
    if (dim <= 45) {
      for (const du of [0, 1, -1, 2, -2, 3, -3]) for (const dv of [0, 1, -1, 2, -2, 3, -3]) {
        if (!du && !dv) continue;
        const q = aff(dim - 3.5 + du * 0.7, dim - 3.5 + dv * 0.7);
        const xf = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 3.5, dim - 3.5]], [P[0], P[1], P[2], q]);
        if (!xf) continue;
        const res = decodeMatrix(sampleBin(S, xf, dim));
        if (res !== null) return res;
      }
    }
  }
  return null;
}

// ===================================================================================================================
// API pública
// ===================================================================================================================
const BUDGET_MS = 150;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function decodeQR(data: Uint8ClampedArray, width: number, height: number): string | null {
  const t0 = now();
  if (!data || width < 21 || height < 21) return null;
  const g0 = toGray(data, width, height);
  const maxDim = Math.max(width, height);
  const f = maxDim > 1000 ? Math.ceil(maxDim / 800) : 1;
  // 1er intento reducido (rápido); si no, a resolución completa o reducida a la mitad (QR chicos / borrosos en frames HD)
  const scales = f > 1 ? [f, Math.max(1, Math.floor(f / 2))] : [1];
  if (f === 3) scales[1] = 1;
  for (const sc of scales) {
    const r = decodeGray(sc === 1 ? g0 : shrink(g0, sc), t0);
    if (r !== null) return r;
    if (now() - t0 > BUDGET_MS) break;
  }
  return null;
}

function decodeGray(g: Gray, t0: number): string | null {
  const bin = binarize(g);
  for (let pass = 0; pass < 2; pass++) {
    let b = bin;
    if (pass === 1) { b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin[i] ^ 1; }
    const fps = findFinders(b, g.w, g.h);
    const triples = chooseTriples(fps);
    const S = new Sampler(b, g.w, g.h, g.d);
    for (const t of triples) {
      if (now() - t0 > BUDGET_MS) return null;
      const r = tryTriple(S, t);
      if (r !== null) return r;
    }
  }
  return null;
}


// ===================================================================================================================
// Cámara: startCameraScan (BarcodeDetector nativo si existe; si no, decodeQR sobre cuadros del video)
// ===================================================================================================================
export interface CameraScanOptions {
  /** formatos para BarcodeDetector (default ["qr_code"]). Los que no sean QR solo se leen si el navegador tiene BarcodeDetector. */
  formats?: string[];
  /** ms entre cuadros (default 120) */
  intervalMs?: number;
  /** cámara trasera ("environment", default) o frontal ("user") */
  facingMode?: "environment" | "user";
  /** se llama con un mensaje en español cuando no se puede abrir la cámara (https, permiso, sin cámara, en uso) */
  onError?: (message: string, error?: unknown) => void;
  /** se llama cuando la cámara ya está andando; mode = "native" (BarcodeDetector) o "js" (decodificador propio) */
  onReady?: (mode: "native" | "js") => void;
  /** ms durante los cuales no se repite un mismo texto (default 1500) */
  dedupeMs?: number;
  /** fuerza el decodificador propio aunque exista BarcodeDetector (pruebas) */
  forceJs?: boolean;
  /** lado mayor máximo del cuadro que se decodifica en JS (default 1280) */
  maxSide?: number;
}
export interface CameraScan { stop: () => void }

/** Motivo por el que la cámara no puede usarse en este contexto, o null si se puede intentar. */
export function cameraBlockReason(): string | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "Este entorno no tiene cámara.";
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return window.isSecureContext === false
      ? "La cámara solo funciona con https. Abrí el sistema desde la dirección segura (https://) o usá el lector USB / escribí el código."
      : "Este navegador no permite usar la cámara. Usá el lector USB o escribí el código.";
  }
  return null;
}

/** true si hay forma de intentar abrir la cámara (getUserMedia). Con decodificador propio ya no depende de BarcodeDetector. */
export function cameraScanSupported(): boolean {
  return cameraBlockReason() === null;
}

function cameraErrorMessage(e: any): string {
  const name = e && e.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError")
    return "Permiso de cámara denegado. Habilitá la cámara para este sitio en los ajustes del navegador y volvé a intentar, o usá el lector USB / escribí el código.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError")
    return "No se encontró ninguna cámara en este dispositivo. Usá el lector USB o escribí el código.";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return "La cámara está siendo usada por otra aplicación. Cerrala y volvé a intentar, o usá el lector USB / escribí el código.";
  return "No pudimos abrir la cámara" + (name ? " (" + name + ")" : "") + ". Revisá el permiso del navegador o usá el lector USB / escribí el código.";
}

export function startCameraScan(video: HTMLVideoElement, onResult: (text: string) => void, opts: CameraScanOptions = {}): CameraScan {
  let stopped = false;
  let timer = 0;
  let stream: MediaStream | null = null;
  const interval = opts.intervalMs ?? 120;
  const dedupe = opts.dedupeMs ?? 1500;
  let lastText = "", lastAt = 0;

  const release = () => {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (stream) { stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ya parada */ } }); stream = null; }
    try { if (video.srcObject) video.srcObject = null; } catch { /* nada */ }
  };
  const fail = (msg: string, err?: unknown) => { release(); if (!stopped) { stopped = true; opts.onError?.(msg, err); } };

  const run = async () => {
    const block = cameraBlockReason();
    if (block) return fail(block);
    const md = navigator.mediaDevices;
    const facing = opts.facingMode || "environment";
    try {
      try {
        stream = await md.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e: any) {
        if (e && (e.name === "OverconstrainedError" || e.name === "NotFoundError" || e.name === "ConstraintNotSatisfiedError")) stream = await md.getUserMedia({ video: true, audio: false });
        else throw e;
      }
    } catch (e) { return fail(cameraErrorMessage(e), e); }
    if (stopped) { release(); return; }
    try {
      video.muted = true;
      video.setAttribute("playsinline", "true");      // iOS Safari: sin esto abre a pantalla completa
      video.setAttribute("muted", "");
      video.srcObject = stream;
      await video.play();
    } catch (e) { return fail(cameraErrorMessage(e), e); }
    if (stopped) { release(); return; }

    // detector nativo (si existe y lee QR); si no, decodificador propio
    let native: any = null;
    const BD = (typeof window !== "undefined" ? (window as any).BarcodeDetector : undefined) as any;
    const wanted = opts.formats && opts.formats.length ? opts.formats : ["qr_code"];
    if (BD && !opts.forceJs) {
      try {
        let formats = wanted;
        if (typeof BD.getSupportedFormats === "function") {
          const sup: string[] = await BD.getSupportedFormats();
          formats = wanted.filter((f) => sup.includes(f));
        }
        if (formats.includes("qr_code")) native = new BD({ formats });
      } catch { native = null; }
    }
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    const maxSide = opts.maxSide || 1280;
    const jsDecode = (): string | null => {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return null;
      const k = Math.min(1, maxSide / Math.max(vw, vh));
      const w = Math.max(21, Math.round(vw * k)), h = Math.max(21, Math.round(vh * k));
      if (!canvas) { canvas = document.createElement("canvas"); }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; ctx = null; }
      if (!ctx) ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      return decodeQR(img.data, w, h);
    };
    opts.onReady?.(native ? "native" : "js");

    const emit = (text: string) => {
      const t = Date.now();
      if (text === lastText && t - lastAt < dedupe) { lastAt = t; return; }
      lastText = text; lastAt = t;
      try { onResult(text); } catch (e) { /* un error del consumidor no debe frenar el escaneo */ void e; }
    };
    const tick = async () => {
      timer = 0;
      if (stopped) return;
      const t0 = Date.now();
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let text: string | null = null;
          if (native) {
            try {
              const codes = await native.detect(video);
              if (codes && codes.length && codes[0].rawValue) text = String(codes[0].rawValue);
            } catch { native = null; }          // el nativo falló en este dispositivo: seguimos con el propio
          }
          if (text === null && !native) text = jsDecode();
          if (text !== null && !stopped) emit(text);
        }
      } catch { /* un cuadro malo: se sigue con el próximo */ }
      if (!stopped) timer = window.setTimeout(tick, Math.max(30, interval - (Date.now() - t0)));
    };
    tick();
  };
  run();

  return { stop() { stopped = true; release(); } };
}

export const __internals = { rsCorrect, decodeMatrix, Matrix, binarize, findFinders, toGray };
