/** Minimal grayscale PNG encoder for QR codes (e-mail clients do not render SVG). */
import { qrMatrix } from "../../assets/js/payment.mjs";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n) => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
function chunk(type, data) {
  const typed = [...type].map((c) => c.charCodeAt(0));
  const body = new Uint8Array([...typed, ...data]);
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}
async function deflate(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function qrPng(text, scale = 6, margin = 4) {
  const matrix = qrMatrix(text);
  const size = (matrix.length + margin * 2) * scale;
  const raw = new Uint8Array(size * (size + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0; // filter: none
    const my = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - margin;
      const dark = matrix[my]?.[mx];
      raw[y * (size + 1) + 1 + x] = dark ? 0 : 255;
    }
  }
  const header = [...u32(size), ...u32(size), 8, 0, 0, 0, 0];
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk("IHDR", header),
    ...chunk("IDAT", [...(await deflate(raw))]),
    ...chunk("IEND", []),
  ]);
}
