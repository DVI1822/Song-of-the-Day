// The dashboard's own look: plain, neutral and dense, apart from the app's.
export const ADMIN_CSS = `
.adm {
  --bg: #f6f6f4; --card: #fcfcfb; --line: #e4e3df; --grid: #ecebe7;
  --ink: #0b0b0b; --ink2: #52514e; --ink3: #8a8984;
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a;
  --good: #0f7a3d; --bad: #c43b3b;
  --heat: 42, 120, 214;
  position: relative; z-index: 1; min-height: 100vh; background: var(--bg); color: var(--ink);
  font: 14px/1.45 var(--font-sans), system-ui, sans-serif; padding: 24px 16px 64px;
  touch-action: auto; color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  .adm {
    --bg: #111110; --card: #1a1a19; --line: #2c2c2a; --grid: #252523;
    --ink: #f0efec; --ink2: #c3c2b7; --ink3: #8d8c85;
    --s1: #3987e5; --s2: #d95926; --s3: #199e70;
    --good: #4cc27a; --bad: #ef7676; --heat: 57, 135, 229;
    color-scheme: dark;
  }
}
.adm * { box-sizing: border-box; }
.adm main, .adm .top { max-width: 1240px; margin: 0 auto; }
.adm .top { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: end; justify-content: space-between; margin-bottom: 20px; }
.adm h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
.adm h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink2); font-weight: 600; margin: 32px 0 10px; }
.adm h3 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
.adm .muted { color: var(--ink3); font-weight: 400; }
.adm .small { font-size: 12px; margin: -4px 0 10px; }
.adm .foot { max-width: 1240px; margin: 24px auto 0; }
.adm a { color: inherit; text-decoration: none; }

.adm .seg { display: inline-flex; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 3px; }
.adm .seg a { padding: 6px 12px; border-radius: 6px; color: var(--ink2); font-weight: 600; font-size: 13px; }
.adm .seg a[aria-current] { background: var(--ink); color: var(--bg); }

.adm .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px; min-width: 0; }
.adm .grid { display: grid; gap: 12px; margin-top: 12px; }
.adm .grid.two { grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); }
.adm .grid.three { grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.adm section.card { margin-top: 12px; }

.adm .kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.adm .kpi { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
.adm .kpi-label { color: var(--ink2); font-size: 12px; font-weight: 600; }
.adm .kpi-value { font-size: 30px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
.adm .sub { color: var(--ink3); font-size: 12px; }
.adm .delta { font-size: 12px; font-weight: 600; }
.adm .delta.up { color: var(--good); }
.adm .delta.down { color: var(--bad); }
.adm .delta.flat { color: var(--ink3); }

.adm .chart { position: relative; }
.adm .plot { position: relative; }
.adm .plot svg { display: block; width: 100%; height: auto; overflow: visible; touch-action: pan-y; }
.adm .axes text, .adm .axes-text { fill: var(--ink3); font-size: 11px; font-variant-numeric: tabular-nums; }
.adm line.grid { stroke: var(--grid); stroke-width: 1; }
.adm line.baseline { stroke: var(--line); stroke-width: 1; }
.adm line.cross { stroke: var(--ink3); stroke-width: 1; stroke-dasharray: 3 3; }
.adm circle.ring { stroke: var(--card); stroke-width: 2; }
.adm .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ink2); margin-bottom: 6px; }
.adm .legend span, .adm .tip span { display: inline-flex; align-items: center; gap: 6px; }
.adm .legend i, .adm .tip i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.adm .tip { position: absolute; pointer-events: none; background: var(--card); border: 1px solid var(--line); border-radius: 8px;
  padding: 8px 10px; font-size: 12px; display: flex; flex-direction: column; gap: 2px; white-space: nowrap;
  box-shadow: 0 4px 16px rgba(0,0,0,.08); z-index: 2; }
.adm .tip em { font-style: normal; font-weight: 600; margin-left: auto; padding-left: 8px; font-variant-numeric: tabular-nums; }

.adm .multiples { display: grid; gap: 12px; margin-top: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.adm .mini { padding: 12px 14px; }
.adm .mini-head { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink2); font-weight: 600; }
.adm .mini-head b { color: var(--ink); font-size: 16px; font-variant-numeric: tabular-nums; }
.adm .spark svg { width: 100%; height: 44px; display: block; margin-top: 6px; }
.adm .spark-tip { font-size: 11px; color: var(--ink3); height: 16px; }

.adm .hbars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.adm .hbars li { display: grid; grid-template-columns: minmax(90px, 40%) 1fr auto; gap: 10px; align-items: center; font-size: 13px; }
.adm .hb-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm .hb-label small { color: var(--ink3); margin-left: 6px; }
.adm .hb-track { height: 10px; }
.adm .hb-bar { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.adm .hb-val { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 2.5em; text-align: right; }

.adm .facts { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; font-size: 13px; color: var(--ink2); }
.adm .facts b { color: var(--ink); font-variant-numeric: tabular-nums; }
.adm .facts.big { margin-top: 0; gap: 10px; }
.adm .facts.big b { font-size: 20px; margin-right: 4px; }

.adm .songs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.adm .songs li { display: flex; align-items: center; gap: 10px; min-width: 0; }
.adm .songs img, .adm .noart { width: 36px; height: 36px; border-radius: 4px; flex: none; object-fit: cover; background: var(--grid); }
.adm .song { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.adm .song b, .adm .song small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm .song b { font-weight: 600; font-size: 13px; }
.adm .song small { color: var(--ink3); font-size: 12px; }
.adm .val { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }

.adm .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.adm table { width: 100%; border-collapse: collapse; font-size: 13px; }
.adm th { text-align: left; font-size: 12px; color: var(--ink2); font-weight: 600; border-bottom: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; }
.adm th button { all: unset; cursor: pointer; }
.adm td { padding: 8px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
.adm .num { text-align: right; font-variant-numeric: tabular-nums; }
.adm .who { display: flex; flex-direction: column; }
.adm .who small { color: var(--ink3); font-size: 12px; }
.adm .who:hover b { text-decoration: underline; }
.adm table.cohort td, .adm table.cohort th { padding: 6px; }
.adm td.heat { background: rgba(var(--heat), calc(0.08 + var(--v) * 0.85)); border: 2px solid var(--card); border-radius: 4px; }
.adm td.heat.on-dark { color: #fff; }
.adm .table-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px; }
.adm .table-tools input { flex: 1; min-width: 180px; max-width: 320px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; }
.adm .table-tools button, .adm .more { margin-left: auto; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; }
.adm .more { display: block; margin: 12px auto 0; }
`;
