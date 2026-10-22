const nf = new Intl.NumberFormat("en-US");
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const df = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

export const num = (n) => (n == null ? "—" : nf.format(n));
export const shortAddress = (a) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—");
export const date = (iso) => (iso ? df.format(new Date(iso)) : "—");

export function ago(iso) {
  if (!iso) return "—";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps = [[60, "second"], [3600, "minute"], [86400, "hour"], [604800, "day"], [2629800, "week"], [31557600, "month"], [Infinity, "year"]];
  const units = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  for (const [limit, unit] of steps) if (Math.abs(s) < limit) return rtf.format(Math.round(s / units[unit]), unit);
  return "—";
}
