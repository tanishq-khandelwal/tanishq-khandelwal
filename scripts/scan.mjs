// Renders assets/scan-{dark,light}.svg: the last year of contributions as a
// proctoring-HUD scan — a sweep line, a lock box on the busiest day, telemetry.
// Run: GITHUB_TOKEN=... node scripts/scan.mjs   (no dependencies, Node 20+)
import { writeFileSync } from "node:fs";

const LOGIN = "tanishq-khandelwal";
const query = `{user(login:"${LOGIN}"){contributionsCollection{contributionCalendar{
  totalContributions weeks{contributionDays{date contributionCount weekday}}}}}}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": LOGIN },
  body: JSON.stringify({ query }),
});
const json = await res.json();
if (!json.data) throw new Error(JSON.stringify(json));
const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const days = weeks.flat();

// Telemetry
const peak = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a));
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount) current++;
  else if (i === days.length - 1) continue; // today may not have activity yet
  else break;
}
const byWeekday = Array(7).fill(0);
for (const d of days) byWeekday[d.weekday] += d.contributionCount;
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const busiest = WD[byWeekday.indexOf(Math.max(...byWeekday))];
const active = days.filter((d) => d.contributionCount).length;

// Levels by quartile of non-zero days, like GitHub's own graph.
const nz = days.map((d) => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
const q = [0.25, 0.5, 0.75].map((p) => nz[Math.floor(p * (nz.length - 1))] ?? 1);
const level = (n) => (!n ? 0 : n <= q[0] ? 1 : n <= q[1] ? 2 : n <= q[2] ? 3 : 4);

const fmt = (n) => n.toLocaleString("en-US");
const date = (s) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).toUpperCase();

const CELL = 15, GAP = 4, X0 = 60, Y0 = 110, SWEEP = 7; // seconds per sweep
const W = 1200, H = 330;
const gridW = weeks.length * (CELL + GAP);

function svg({ bg, fg, muted, border, accent }) {
  const fill = [border, fg, fg, fg, fg];
  const op = [0.55, 0.22, 0.45, 0.7, 1];
  let cells = "", peakXY;
  weeks.forEach((w, x) => {
    // SMIL, not CSS: GitHub shows SVGs through <img>, where CSS animations stay frozen.
    const f = x / weeks.length, t = (n) => Math.min(n, 0.999).toFixed(4);
    cells += `<g><animate attributeName="opacity" values="1;1;0.3;1;1" keyTimes="0;${t(f)};${t(f + 0.004)};${t(f + 0.03)};1" dur="${SWEEP}s" repeatCount="indefinite"/>`;
    for (const d of w) {
      const l = level(d.contributionCount);
      const cx = X0 + x * (CELL + GAP), cy = Y0 + d.weekday * (CELL + GAP);
      if (d.date === peak.date) peakXY = [cx, cy];
      cells += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="1" fill="${fill[l]}" fill-opacity="${op[l]}"><title>${d.date}: ${d.contributionCount}</title></rect>`;
    }
    cells += `</g>`;
  });

  // Lock box: brackets around the peak cell, label flipped left near the right edge.
  const [px, py] = peakXY, b = 7, s = 6;
  const L = px - b, T = py - b, R = px + CELL + b, B = py + CELL + b;
  const br = (d) => `<path d="${d}" fill="none" stroke="${accent}" stroke-width="2"/>`;
  const flip = px > X0 + gridW - 300;
  const label = `PEAK · ${peak.contributionCount} · ${date(peak.date)}`;
  const lx = flip ? L - 10 : R + 10;

  const stats = [
    ["TOTAL", fmt(cal.totalContributions)],
    ["ACTIVE DAYS", `${active}/${days.length}`],
    ["LONGEST STREAK", `${longest}D`],
    ["CURRENT STREAK", `${current}D`],
    ["BUSIEST DAY", busiest],
  ];
  const colW = (W - 120) / stats.length;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fmt(cal.totalContributions)} GitHub contributions in the last year; peak ${peak.contributionCount} on ${peak.date}">
  <style>
    .m { font: 500 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 2.2px; }
    .v { font: 600 26px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; letter-spacing: -0.8px; }
  </style>
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${["M20 44 V20 H44", "M1156 20 H1180 V44", "M20 286 V310 H44", "M1156 310 H1180 V286"].map((d) => br(d).replace(accent, fg)).join("")}
  <text x="${X0}" y="62" class="m" fill="${muted}"><tspan fill="${fg}">[01]</tspan>  ACTIVITY SCAN · LAST 12 MONTHS · @${LOGIN.toUpperCase()}</text>
  <circle cx="1068" cy="57" r="5" fill="${accent}"><animate attributeName="opacity" values="1;0" dur="1.2s" calcMode="discrete" repeatCount="indefinite"/></circle>
  <text x="1140" y="62" class="m" fill="${accent}" text-anchor="end">LIVE</text>
  <line x1="${X0}" y1="80" x2="${W - 60}" y2="80" stroke="${border}"/>
  ${cells}
  <g><animateTransform attributeName="transform" type="translate" from="0 0" to="${gridW} 0" dur="${SWEEP}s" repeatCount="indefinite"/><rect x="${X0 - 3}" y="${Y0 - 10}" width="2" height="${7 * (CELL + GAP) + 16}" fill="${accent}"/></g>
  <g opacity="0">
    <animate attributeName="opacity" values="0;0;1;0;1;1" keyTimes="0;0.86;0.88;0.9;0.92;1" dur="${SWEEP}s" calcMode="discrete" repeatCount="indefinite"/>
    ${br(`M${L} ${T + s} V${T} H${L + s}`)}${br(`M${R - s} ${T} H${R} V${T + s}`)}${br(`M${L} ${B - s} V${B} H${L + s}`)}${br(`M${R - s} ${B} H${R} V${B - s}`)}
    <text x="${lx}" y="${T - 4}" class="m" fill="${accent}" text-anchor="${flip ? "end" : "start"}">${label}</text>
  </g>
  <line x1="${X0}" y1="${Y0 + 7 * (CELL + GAP) + 18}" x2="${W - 60}" y2="${Y0 + 7 * (CELL + GAP) + 18}" stroke="${border}"/>
  ${stats.map(([k, v], i) => `<text x="${X0 + i * colW}" y="${H - 58}" class="m" fill="${muted}">${k}</text><text x="${X0 + i * colW}" y="${H - 26}" class="v" fill="${fg}">${v}</text>`).join("")}
</svg>
`;
}

writeFileSync("assets/scan-dark.svg", svg({ bg: "#0b0b0c", fg: "#ececea", muted: "#7c7c77", border: "#242427", accent: "#ff4a2b" }));
writeFileSync("assets/scan-light.svg", svg({ bg: "#f3f3f1", fg: "#0d0d0d", muted: "#6f6f6a", border: "#d6d6d1", accent: "#ff3b1f" }));
console.log(`total ${cal.totalContributions}, peak ${peak.contributionCount} on ${peak.date}, streaks ${current}/${longest}, busiest ${busiest}`);
