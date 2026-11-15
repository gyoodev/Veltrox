/**
 * Lightweight zero-dependency ISO-18004 QR Code (EC Level L, Byte mode)
 * encoder returning raw matrix booleans and an inline vector SVG markup string.
 * Supports URLs up to 134 UTF-8 bytes (Versions 1 through 6).
 */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[((GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)) % 255] ?? 0;
}

function computeRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i] ?? 1;
    for (let j = 0; j < poly.length; j += 1) {
      const coeff = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ coeff;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(coeff, root);
    }
    poly = next;
  }
  return poly;
}

function encodeRsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = computeRsGenerator(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i += 1) {
    const factor = (data[i] ?? 0) ^ (rem[0] ?? 0);
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j += 1) {
      rem[j] = (rem[j] ?? 0) ^ gfMul(gen[j + 1] ?? 0, factor);
    }
  }
  return rem;
}

interface VersionSpec {
  version: number;
  size: number;
  blocks: number;
  dataPerBlock: number;
  ecPerBlock: number;
  remBits: number;
}

// Level L specifications for QR Versions 1..6 (exact ISO 18004 capacity table)
const VERSION_SPECS: VersionSpec[] = [
  { version: 1, size: 21, blocks: 1, dataPerBlock: 19, ecPerBlock: 7, remBits: 0 },
  { version: 2, size: 25, blocks: 1, dataPerBlock: 34, ecPerBlock: 10, remBits: 7 },
  { version: 3, size: 29, blocks: 1, dataPerBlock: 55, ecPerBlock: 15, remBits: 7 },
  { version: 4, size: 33, blocks: 1, dataPerBlock: 80, ecPerBlock: 20, remBits: 7 },
  { version: 5, size: 37, blocks: 1, dataPerBlock: 108, ecPerBlock: 26, remBits: 7 },
  { version: 6, size: 41, blocks: 2, dataPerBlock: 68, ecPerBlock: 18, remBits: 7 },
];

// Format info bits for EC Level L (01) and masks 0..7 (pre-XORed with 0x5412)
const FORMAT_BITS_L = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
];

function buildQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec =
    VERSION_SPECS.find(
      (s) => s.blocks * s.dataPerBlock >= bytes.length + 2
    ) ?? VERSION_SPECS[VERSION_SPECS.length - 1]!;

  const maxPayload = spec.blocks * spec.dataPerBlock - 2;
  const payload = bytes.slice(0, Math.max(0, maxPayload));
  const totalData = spec.blocks * spec.dataPerBlock;

  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i -= 1) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, 8);
  for (const b of payload) {
    pushBits(b, 8);
  }
  const terminatorLen = Math.min(4, totalData * 8 - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(totalData);
  for (let i = 0; i < bits.length / 8; i += 1) {
    let val = 0;
    for (let j = 0; j < 8; j += 1) {
      val = (val << 1) | (bits[i * 8 + j] ?? 0);
    }
    dataBytes[i] = val;
  }

  const pads = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bits.length / 8; i < totalData; i += 1) {
    dataBytes[i] = pads[padIdx % 2] ?? 0xec;
    padIdx += 1;
  }

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b += 1) {
    const start = b * spec.dataPerBlock;
    const chunk = dataBytes.slice(start, start + spec.dataPerBlock);
    dataBlocks.push(chunk);
    ecBlocks.push(encodeRsRemainder(chunk, spec.ecPerBlock));
  }

  const interleaved: number[] = [];
  for (let i = 0; i < spec.dataPerBlock; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      interleaved.push(dataBlocks[b]?.[i] ?? 0);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) {
      interleaved.push(ecBlocks[b]?.[i] ?? 0);
    }
  }

  const n = spec.size;
  const grid: boolean[][] = Array.from({ length: n }, () =>
    Array<boolean>(n).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: n }, () =>
    Array<boolean>(n).fill(false)
  );

  const setFixed = (r: number, c: number, dark: boolean) => {
    const row = grid[r];
    const rRow = reserved[r];
    if (row && rRow && c >= 0 && c < n) {
      row[c] = dark;
      rRow[c] = true;
    }
  };

  const placeFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const inOuter =
          dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFixed(r, c, inOuter || inCore);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, n - 7);
  placeFinder(n - 7, 0);

  if (spec.version >= 2) {
    const center = n - 7;
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const dark =
          Math.abs(dr) === 2 ||
          Math.abs(dc) === 2 ||
          (dr === 0 && dc === 0);
        setFixed(center + dr, center + dc, dark);
      }
    }
  }

  for (let i = 8; i < n - 8; i += 1) {
    setFixed(6, i, i % 2 === 0);
    setFixed(i, 6, i % 2 === 0);
  }

  // Reserve format info coordinates + Dark Module
  setFixed(n - 8, 8, true);
  for (let i = 0; i <= 8; i += 1) {
    if (!(reserved[8]?.[i])) setFixed(8, i, false);
    if (!(reserved[i]?.[8])) setFixed(i, 8, false);
  }
  for (let i = n - 8; i < n; i += 1) {
    if (!(reserved[8]?.[i])) setFixed(8, i, false);
    if (!(reserved[i]?.[8])) setFixed(i, 8, false);
  }

  const streamBits: number[] = [];
  for (const byte of interleaved) {
    for (let b = 7; b >= 0; b -= 1) {
      streamBits.push((byte >> b) & 1);
    }
  }
  for (let r = 0; r < spec.remBits; r += 1) streamBits.push(0);

  let bitIdx = 0;
  let upward = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < n; step += 1) {
      const r = upward ? n - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (!reserved[r]?.[c]) {
          const val = (streamBits[bitIdx] ?? 0) === 1;
          bitIdx += 1;
          // Apply Mask 0 ((r + c) % 2 === 0)
          const masked = (r + c) % 2 === 0 ? !val : val;
          const row = grid[r];
          if (row) row[c] = masked;
        }
      }
    }
    upward = !upward;
  }

  // Write Format Information for Level L, Mask 0
  const fmt = FORMAT_BITS_L[0] ?? 0x77c4;
  const fmtBit = (idx: number) => ((fmt >> idx) & 1) === 1;
  // Copy 1: top-left finder perimeter
  for (let c = 0; c <= 5; c += 1) setFixed(8, c, fmtBit(14 - c));
  setFixed(8, 7, fmtBit(8));
  setFixed(8, 8, fmtBit(7));
  setFixed(7, 8, fmtBit(6));
  for (let r = 0; r <= 5; r += 1) setFixed(5 - r, 8, fmtBit(5 - r));
  // Copy 2: bottom-left vertical (14..8) & top-right horizontal (7..0)
  for (let k = 0; k < 7; k += 1) setFixed(n - 1 - k, 8, fmtBit(14 - k));
  for (let k = 0; k < 8; k += 1) setFixed(8, n - 8 + k, fmtBit(7 - k));

  return grid;
}

export function generateQrSvgString(text: string, margin = 2): string {
  const matrix = buildQrMatrix(text);
  const size = matrix.length + margin * 2;
  const rects: string[] = [];

  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      if (row[c]) {
        rects.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#0a0e1a">${rects.join("")}</g></svg>`;
}

export function getQrMatrix(text: string): boolean[][] {
  return buildQrMatrix(text);
}
