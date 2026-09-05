/** Small shared helpers — no business logic lives here. */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

let seq = 1000;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtD(ts: number | string): string {
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtShort(ts: number | string): string {
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDT(ts: number): string {
  return `${fmtShort(ts)}, ${fmtTime(ts)}`;
}

export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtD(ts);
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T23:59:59").getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ageFrom(dob: string): number {
  const b = new Date(dob); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join("");
}

/** Deterministic pseudo-QR matrix for the RAKSHA ID card (demo visual). */
export function qrMatrix(text: string, size = 21): boolean[][] {
  let seed = hashStr(text);
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const g: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => rnd() > 0.52));
  const finder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const ring = i === 0 || i === 6 || j === 0 || j === 6;
      const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      g[r + i]![c + j] = ring || core;
    }
    for (let i = -1; i < 8; i++) for (let j = -1; j < 8; j++) {
      const rr = r + i, cc = c + j;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size && (i === -1 || i === 7 || j === -1 || j === 7)) g[rr]![cc] = false;
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  return g;
}

/** Fake JWT for the prototype — structured like a real token, clearly demo-grade. */
export function makeToken(userId: string, role: string): string {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  const header = enc({ alg: "HS256", typ: "JWT", note: "demo-token" });
  const payload = enc({ sub: userId, role, iat: Date.now(), exp: Date.now() + 12 * 3600000 });
  const sig = hashStr(header + payload).toString(36);
  return `${header}.${payload}.${sig}`;
}
