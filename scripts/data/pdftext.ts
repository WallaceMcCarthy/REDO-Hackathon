// Minimal PDF text extractor (Flate streams, simple-encoded fonts) using only Node built-ins.
import { inflateSync } from "node:zlib";
export type Item = { x: number; y: number; t: string };
export function pdfPages(buf: Buffer): Item[][] {
  const out: Item[][] = [];
  pdfLines(buf, out);
  return out;
}
export function pdfLines(buf: Buffer, raw?: Item[][]): string[] {
  const s = buf.toString("latin1"); const re = /stream\r?\n/g; let m; const pages: string[][] = [];
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length, en = s.indexOf("endstream", st); let d: string;
    try { d = inflateSync(buf.subarray(st, en)).toString("latin1"); } catch { continue; }
    if (!/BT/.test(d) || !/T[jJ]/.test(d)) continue;
    const items: { x: number; y: number; t: string }[] = [];
    let x = 0, y = 0, lx = 0, ly = 0, lead = 0;
    const tok = /\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.)*)\)\s*Tj|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+(Td|TD)|\bBT\b/g;
    let k; let cur = "", cx = 0, cy = 0;
    const flush = () => { if (cur.trim()) items.push({ x: cx, y: cy, t: cur }); cur = ""; };
    const unesc = (q: string) => q.replace(/\\([nrtbf()\\]|\d{1,3})/g, (_, c) => /\d/.test(c) ? String.fromCharCode(parseInt(c, 8)) : ({ n: "\n", r: "", t: " ", b: "", f: "" } as any)[c] ?? c);
    while ((k = tok.exec(d))) {
      if (k[3] !== undefined) { flush(); x = lx = +k[7]; y = ly = +k[8]; }
      else if (k[9] !== undefined) { flush(); lx += +k[9]; ly += +k[10]; x = lx; y = ly; if (k[11] === "TD") lead = -+k[10]; }
      else if (k[1] !== undefined || k[2] !== undefined) {
        if (!cur) { cx = lx; cy = ly; }
        if (k[1] !== undefined) {
          const parts = [...k[1].matchAll(/\(((?:[^()\\]|\\.)*)\)|(-?[\d.]+)/g)];
          for (const p of parts) { if (p[1] !== undefined) cur += unesc(p[1]); else if (+p[2] < -200) cur += " "; }
        } else cur += unesc(k[2]);
      } else { flush(); lx = ly = 0; }
    }
    flush(); void lead; void x; void y;
    raw?.push(items);
    // group into lines
    const byY = new Map<number, typeof items>();
    for (const it of items) { const key = Math.round(it.y / 2) * 2; (byY.get(key) ?? byY.set(key, []).get(key)!).push(it); }
    pages.push([...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v.sort((a, b) => a.x - b.x).map((i) => i.t.trim()).filter(Boolean).join("\t")));
  }
  return pages.map((p) => p.join("\n")).join("\n=====PAGE=====\n").split("\n");
}
