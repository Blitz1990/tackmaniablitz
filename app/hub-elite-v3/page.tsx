'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;

const AVATARS: Record<string, string> = { Marc: '', Oli: '', Schaller: '', Nico: '', Manu: '', test: '' };

type Run = { id: string; category: string; map: string; track: string; player: string; timeText: string; timeMs: number };
type RankingRow = { player: string; points: number; records: number; entries: number; avgGap: number; bestMs: number; podiums: number; winRate: number };

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"') { if (inQuotes && next === '"') { cell += '"'; i++; } else { inQuotes = !inQuotes; } continue; }
    if (char === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !inQuotes) { if (char === '\r' && next === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
function normalizeHeader(v: string) { return v.toLowerCase().trim(); }
function firstMatch(headers: string[], candidates: string[]) { return headers.findIndex((h) => candidates.includes(normalizeHeader(h))); }
function parseNumber(value: string): number { const v = (value || '').trim().replace(',', '.'); const n = parseFloat(v); return Number.isFinite(n) ? n : NaN; }
function toMs(value: string): number { const v = (value || '').trim().replace(',', '.'); if (!v) return Number.POSITIVE_INFINITY; if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 1000); const parts = v.split(':').map((p) => p.trim()); if (parts.length === 2) { const mins = parseInt(parts[0], 10); const secs = parseFloat(parts[1]); if (Number.isFinite(mins) && Number.isFinite(secs)) return Math.round(mins * 60000 + secs * 1000); } return Number.POSITIVE_INFINITY; }
function formatGap(ms: number) { if (!Number.isFinite(ms)) return '-'; return ms === 0 ? 'WR' : `+${(ms / 1000).toFixed(3)}s`; }
function initials(name: string) { return name.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase(); }

function Avatar({ name }: { name: string }) {
  const url = AVATARS[name];
  if (url) return <img src={url} alt={name} className="avatar" />;
  return <div className="avatar fallback">{initials(name)}</div>;
}

function parseRunsFromCsv(csv: string): Run[] {
  const rows = parseCsv(csv); if (rows.length < 2) return [];
  const headers = rows[0];
  const categoryIdx = firstMatch(headers, ['kategorie']);
  const mapIdx = firstMatch(headers, ['map']);
  const playerIdx = firstMatch(headers, ['spieler']);
  const timeIdx = firstMatch(headers, ['zeit']);
  return rows.slice(1).map((row, i) => {
    const category = (categoryIdx >= 0 ? row[categoryIdx] : '').trim();
    const map = (mapIdx >= 0 ? row[mapIdx] : '').trim();
    const player = (playerIdx >= 0 ? row[playerIdx] : '').trim();
    const timeText = (timeIdx >= 0 ? row[timeIdx] : '').trim();
    return { id: `${i}-${category}-${map}-${player}`, category, map, track: `${category} #${map}`, player, timeText, timeMs: toMs(timeText) };
  }).filter((run) => !!run.category && !!run.map && !!run.player && Number.isFinite(parseNumber(run.timeText)));
}

export default function Page() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      const txt = await res.text();
      setRuns(parseRunsFromCsv(txt));
    };
    load();
  }, []);

  const groupedByTrack = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of runs) { const arr = map.get(run.track) || []; arr.push(run); map.set(run.track, arr); }
    for (const [track, arr] of Array.from(map.entries())) { arr.sort((a,b)=>a.timeMs-b.timeMs); map.set(track, arr); }
    return map;
  }, [runs]);

  const ranking = useMemo<RankingRow[]>(() => {
    const score = new Map<string, RankingRow>();
    const pointTable = [25,18,15,12,10,8,6,4,2,1];
    groupedByTrack.forEach((arr) => {
      const wr = arr[0]?.timeMs ?? Infinity;
      arr.forEach((run, idx) => {
        const row = score.get(run.player) || { player: run.player, points: 0, records: 0, entries: 0, avgGap: 0, bestMs: run.timeMs, podiums: 0, winRate: 0 };
        row.entries += 1; row.bestMs = Math.min(row.bestMs, run.timeMs); row.avgGap += (run.timeMs - wr);
        if (idx === 0) row.records += 1; if (idx < 3) row.podiums += 1; row.points += pointTable[idx] || 0;
        score.set(run.player, row);
      });
    });
    return Array.from(score.values()).map((row) => ({ ...row, avgGap: row.entries ? row.avgGap / row.entries : Infinity, winRate: row.entries ? (row.records / row.entries) * 100 : 0 })).sort((a,b)=>b.points-a.points || b.records-a.records || a.avgGap-b.avgGap);
  }, [groupedByTrack]);

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">GLOBAL RANKING</div>
          <h1>Punktesystem pro Strecke</h1>
          <p className="sub">Gleiche Struktur wie vorher, aber jeder Wert ist jetzt direkt erklärt.</p>
        </div>
        <a className="btn ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Sheet öffnen</a>
      </section>

      <section className="cards">
        {ranking.map((row, idx) => (
          <div className="rankCard" key={row.player}>
            <div className="place">#{idx + 1}</div>
            <div className="playerLine">
              <Avatar name={row.player} />
              <div className="playerName">{row.player}</div>
            </div>

            <div className="statBlock">
              <div className="value">{row.points}</div>
              <div className="label">Punkte</div>
              <div className="desc">Gesamtwertung</div>
            </div>

            <div className="statBlock">
              <div className="value">{row.records}</div>
              <div className="label">WRs</div>
              <div className="desc">#1 Platzierungen</div>
            </div>

            <div className="statBlock">
              <div className="value">{row.podiums}</div>
              <div className="label">Podien</div>
              <div className="desc">Top 3</div>
            </div>

            <div className="statBlock">
              <div className="value">{formatGap(row.avgGap)}</div>
              <div className="label">Ø Gap</div>
              <div className="desc">Abstand zum WR</div>
            </div>

            <div className="statBlock">
              <div className="value">{row.winRate.toFixed(1)}%</div>
              <div className="label">Win-Rate</div>
              <div className="desc">Wie oft #1</div>
            </div>
          </div>
        ))}
      </section>

      <style jsx global>{`
        :root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,Arial,sans-serif;background:radial-gradient(circle at top, rgba(26,80,255,.22), transparent 26%),radial-gradient(circle at right, rgba(0,224,255,.16), transparent 20%),linear-gradient(180deg,#050816 0%,#07101f 100%);color:#f5f7ff}a{text-decoration:none;color:inherit}.shell{width:min(1100px,calc(100% - 24px));margin:0 auto;padding:24px 0 56px}.hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:24px;border:1px solid rgba(255,255,255,.08);background:rgba(10,15,32,.78);backdrop-filter:blur(16px);box-shadow:0 18px 50px rgba(0,0,0,.32);border-radius:28px}.eyebrow{margin:0 0 8px;color:#75b7ff;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;font-size:clamp(34px,6vw,58px);line-height:.96;letter-spacing:-.04em}.sub{color:#c6d0f5;line-height:1.6;max-width:680px}.btn{border-radius:14px;padding:14px 18px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#dbe4ff;white-space:nowrap}.cards{display:grid;gap:18px;margin-top:20px}.rankCard{padding:22px;border:1px solid rgba(255,255,255,.08);background:rgba(10,15,32,.78);backdrop-filter:blur(16px);box-shadow:0 18px 50px rgba(0,0,0,.32);border-radius:28px}.place{font-size:28px;font-weight:800;margin-bottom:14px}.playerLine{display:flex;align-items:center;gap:14px;margin-bottom:18px}.avatar{width:66px;height:66px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.16)}.avatar.fallback{display:grid;place-items:center;background:linear-gradient(135deg,#1d4dff,#00cfff);font-size:32px;font-weight:900}.playerName{font-size:24px;font-weight:700}.statBlock{padding:14px 0;border-top:1px solid rgba(255,255,255,.08)}.statBlock:first-of-type{border-top:0}.value{font-size:28px;font-weight:800;line-height:1.1}.label{margin-top:4px;font-size:19px;font-weight:700}.desc{margin-top:2px;color:#aeb8d8;font-size:15px}@media (max-width:780px){.hero{flex-direction:column}.rankCard{padding:18px;border-radius:22px}.value{font-size:26px}.label{font-size:18px}.desc{font-size:14px}}
      `}</style>
    </main>
  );
}
