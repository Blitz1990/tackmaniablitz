'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;
const WRITE_URL = '/api/write';

const AVATARS: Record<string, string> = {
  Marc: '',
  Oli: '',
  Schaller: '',
  Nico: '',
  Manu: '',
  test: '',
};

type Run = { id: string; category: string; map: string; track: string; player: string; timeText: string; timeMs: number; source: string };
type RankingRow = { player: string; points: number; records: number; entries: number; avgGap: number; bestMs: number; podiums: number; winRate: number; elo: number; eloDelta: number; h2hWins: number; h2hLosses: number };
type MatchupRow = { a: string; b: string; winsA: number; winsB: number; ties: number; maps: number };

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
function Avatar({ name }: { name: string }) { const url = AVATARS[name]; if (url) return <img src={url} alt={name} className="avatar" />; return <div className="avatar fallback">{initials(name)}</div>; }

function parseRunsFromCsv(csv: string): Run[] {
  const rows = parseCsv(csv); if (rows.length < 2) return [];
  const headers = rows[0];
  const categoryIdx = firstMatch(headers, ['kategorie']);
  const mapIdx = firstMatch(headers, ['map']);
  const playerIdx = firstMatch(headers, ['spieler']);
  const timeIdx = firstMatch(headers, ['zeit']);
  const sourceIdx = firstMatch(headers, ['quelle']);
  return rows.slice(1).map((row, i) => {
    const category = (categoryIdx >= 0 ? row[categoryIdx] : '').trim();
    const map = (mapIdx >= 0 ? row[mapIdx] : '').trim();
    const player = (playerIdx >= 0 ? row[playerIdx] : '').trim();
    const timeText = (timeIdx >= 0 ? row[timeIdx] : '').trim();
    const source = (sourceIdx >= 0 ? row[sourceIdx] : '').trim();
    return { id: `${i}-${category}-${map}-${player}`, category, map, track: `${category} #${map}`, player, timeText, timeMs: toMs(timeText), source };
  }).filter((run) => !!run.category && !!run.map && !!run.player && Number.isFinite(parseNumber(run.timeText)));
}

export default function Page() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [trackSearch, setTrackSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [status, setStatus] = useState('');
  const [newTime, setNewTime] = useState({ player: '', track: '', time: '', note: '' });

  const loadRuns = async () => {
    const res = await fetch(CSV_URL, { cache: 'no-store' });
    const txt = await res.text();
    const parsed = parseRunsFromCsv(txt);
    setRuns(parsed);
    if (!newTime.player && parsed[0]) setNewTime((v) => ({ ...v, player: parsed[0].player }));
  };

  useEffect(() => { loadRuns(); }, []);

  const players = useMemo(() => Array.from(new Set(runs.map((r) => r.player))).sort((a,b)=>a.localeCompare(b)), [runs]);
  const tracks = useMemo(() => Array.from(new Set(runs.map((r) => r.track))).sort((a,b)=>a.localeCompare(b)), [runs]);

  const groupedByTrack = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of runs) { const arr = map.get(run.track) || []; arr.push(run); map.set(run.track, arr); }
    for (const [track, arr] of Array.from(map.entries())) { arr.sort((a,b)=>a.timeMs-b.timeMs); map.set(track, arr); }
    return map;
  }, [runs]);

  const podiumByTrack = useMemo(() => Array.from(groupedByTrack.entries()).map(([track, arr]) => ({ track, top3: arr.slice(0,3) })).sort((a,b)=>a.track.localeCompare(b.track)), [groupedByTrack]);
  const recordsByTrack = useMemo(() => podiumByTrack.map((p) => p.top3[0]).filter(Boolean), [podiumByTrack]);

  const matchupRows = useMemo<MatchupRow[]>(() => {
    const rows: MatchupRow[] = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
        let winsA = 0, winsB = 0, ties = 0, maps = 0;
        groupedByTrack.forEach((arr) => {
          const runA = arr.find((r) => r.player === a);
          const runB = arr.find((r) => r.player === b);
          if (runA && runB) {
            maps += 1;
            if (runA.timeMs < runB.timeMs) winsA += 1;
            else if (runB.timeMs < runA.timeMs) winsB += 1;
            else ties += 1;
          }
        });
        if (maps > 0) rows.push({ a, b, winsA, winsB, ties, maps });
      }
    }
    return rows.sort((x,y)=>y.maps-x.maps || Math.abs((y.winsA-y.winsB)) - Math.abs((x.winsA-x.winsB)));
  }, [players, groupedByTrack]);

  const eloMap = useMemo(() => {
    const ratings = new Map<string, number>();
    const deltas = new Map<string, number>();
    players.forEach((p) => { ratings.set(p, 1000); deltas.set(p, 0); });
    const K = 24;
    const orderedTracks = Array.from(groupedByTrack.keys()).sort((a,b)=>a.localeCompare(b));
    orderedTracks.forEach((track) => {
      const arr = groupedByTrack.get(track) || [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i].player;
          const b = arr[j].player;
          const ra = ratings.get(a) || 1000;
          const rb = ratings.get(b) || 1000;
          const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
          const eb = 1 - ea;
          const sa = arr[i].timeMs < arr[j].timeMs ? 1 : arr[i].timeMs > arr[j].timeMs ? 0 : 0.5;
          const sb = 1 - sa;
          const newRa = ra + K * (sa - ea);
          const newRb = rb + K * (sb - eb);
          deltas.set(a, (deltas.get(a) || 0) + (newRa - ra));
          deltas.set(b, (deltas.get(b) || 0) + (newRb - rb));
          ratings.set(a, newRa);
          ratings.set(b, newRb);
        }
      }
    });
    return { ratings, deltas };
  }, [players, groupedByTrack]);

  const ranking = useMemo<RankingRow[]>(() => {
    const score = new Map<string, RankingRow>();
    const h2hAgg = new Map<string, { wins: number; losses: number }>();
    matchupRows.forEach((m) => {
      const a = h2hAgg.get(m.a) || { wins: 0, losses: 0 };
      const b = h2hAgg.get(m.b) || { wins: 0, losses: 0 };
      a.wins += m.winsA; a.losses += m.winsB;
      b.wins += m.winsB; b.losses += m.winsA;
      h2hAgg.set(m.a, a); h2hAgg.set(m.b, b);
    });
    const pointTable = [25,18,15,12,10,8,6,4,2,1];
    groupedByTrack.forEach((arr) => {
      const wr = arr[0]?.timeMs ?? Infinity;
      arr.forEach((run, idx) => {
        const row = score.get(run.player) || { player: run.player, points: 0, records: 0, entries: 0, avgGap: 0, bestMs: run.timeMs, podiums: 0, winRate: 0, elo: 1000, eloDelta: 0, h2hWins: 0, h2hLosses: 0 };
        row.entries += 1;
        row.bestMs = Math.min(row.bestMs, run.timeMs);
        row.avgGap += (run.timeMs - wr);
        if (idx === 0) row.records += 1;
        if (idx < 3) row.podiums += 1;
        row.points += pointTable[idx] || 0;
        score.set(run.player, row);
      });
    });
    return Array.from(score.values()).map((row) => {
      const h = h2hAgg.get(row.player) || { wins: 0, losses: 0 };
      return {
        ...row,
        avgGap: row.entries ? row.avgGap / row.entries : Infinity,
        winRate: row.entries ? (row.records / row.entries) * 100 : 0,
        elo: Math.round(eloMap.ratings.get(row.player) || 1000),
        eloDelta: Math.round(eloMap.deltas.get(row.player) || 0),
        h2hWins: h.wins,
        h2hLosses: h.losses,
      };
    }).sort((a,b)=>b.points-a.points || b.elo-a.elo || b.records-a.records || a.avgGap-b.avgGap);
  }, [groupedByTrack, matchupRows, eloMap]);

  const filteredRecords = useMemo(() => recordsByTrack.filter((r) => r && (!trackSearch || r.track.toLowerCase().includes(trackSearch.toLowerCase())) && (!playerFilter || r.player === playerFilter)), [recordsByTrack, trackSearch, playerFilter]);

  const submitTime = async () => {
    if (!newTime.player || !newTime.track || !newTime.time) return setStatus('Bitte Spieler, Strecke und Zeit ausfüllen.');
    const res = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'time', payload: newTime }) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok || data.ok === false) return setStatus('Speichern fehlgeschlagen.');
    setStatus('Gespeichert. Daten werden neu geladen…');
    setNewTime((v)=>({ ...v, track:'', time:'', note:'' }));
    setTimeout(() => loadRuns(), 900);
  };

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">TRACKMANIA ELITE E-SPORTS</div>
          <h1>Gleiche Basis, jetzt mit Skill-Layer</h1>
          <p className="sub">Basierend auf dem guten Stand von <strong>hub-elite</strong>, aber ergänzt um ELO, direkte Matchups und stärkere Competitive-Signale.</p>
          <div className="actions">
            <input list="track-list-elite-esports" value={newTime.track} onChange={(e)=>setNewTime((v)=>({ ...v, track:e.target.value }))} placeholder="Strecke wählen oder neue eingeben" />
            <datalist id="track-list-elite-esports">{tracks.map((t)=><option key={t} value={t} />)}</datalist>
            <select value={newTime.player} onChange={(e)=>setNewTime((v)=>({ ...v, player:e.target.value }))}><option value="">Spieler wählen</option>{players.map((p)=><option key={p} value={p}>{p}</option>)}</select>
            <input value={newTime.time} onChange={(e)=>setNewTime((v)=>({ ...v, time:e.target.value }))} placeholder="Zeit z. B. 17,603" />
            <button className="btn primary" onClick={submitTime}>Neue Zeit speichern</button>
            <a className="btn ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Google Sheet öffnen</a>
          </div>
          {status ? <div className="info">{status}</div> : null}
          <div className="stats">
            <div className="stat"><span>Spieler</span><strong>{players.length}</strong><small>aktive Fahrer</small></div>
            <div className="stat"><span>Strecken</span><strong>{recordsByTrack.length}</strong><small>mit gültigem WR</small></div>
            <div className="stat"><span>Top ELO</span><strong>{ranking[0]?.elo || 1000}</strong><small>{ranking[0]?.player || '-'}</small></div>
            <div className="stat"><span>Top Fahrer</span><strong>{ranking[0]?.player || '-'}</strong><small>{ranking[0]?.points || 0} Punkte</small></div>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">NEU DAZU</div>
          <h2>Was ergänzt wurde</h2>
          <div className="legend">
            <div><strong>ELO</strong><span>Skill-Rating aus direkten Vergleichen auf gemeinsamen Maps</span></div>
            <div><strong>Δ ELO</strong><span>Wie stark der Spieler durch Matchups profitiert oder verloren hat</span></div>
            <div><strong>H2H</strong><span>Direkte Siege und Niederlagen gegen andere Fahrer</span></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><div className="eyebrow">GLOBAL RANKING + ELO</div><h2>Punktesystem pro Strecke</h2></div></div>
        <div className="table head ten"><span>#</span><span>Spieler</span><span>Punkte</span><span>ELO</span><span>Δ</span><span>WRs</span><span>Podien</span><span>Ø Gap</span><span>Win-Rate</span><span>H2H</span></div>
        {ranking.map((row, idx) => (
          <div className="table row ten" key={row.player}>
            <span>#{idx + 1}</span>
            <span className="playerCell"><Avatar name={row.player} /> <span>{row.player}</span></span>
            <strong>{row.points}</strong>
            <strong>{row.elo}</strong>
            <span className={row.eloDelta >= 0 ? 'good' : 'bad'}>{row.eloDelta >= 0 ? `+${row.eloDelta}` : row.eloDelta}</span>
            <span>{row.records}</span>
            <span>{row.podiums}</span>
            <span>{formatGap(row.avgGap)}</span>
            <span>{row.winRate.toFixed(1)}%</span>
            <span>{row.h2hWins}:{row.h2hLosses}</span>
          </div>
        ))}
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">WR MAP</div><h2>Rekorde mit Filter</h2></div></div>
          <div className="filters">
            <input value={trackSearch} onChange={(e)=>setTrackSearch(e.target.value)} placeholder="Strecke suchen…" />
            <select value={playerFilter} onChange={(e)=>setPlayerFilter(e.target.value)}><option value="">Alle Spieler</option>{players.map((p)=><option key={p} value={p}>{p}</option>)}</select>
          </div>
          <div className="table head four"><span>Strecke</span><span>WR Fahrer</span><span>Zeit</span><span>Kategorie</span></div>
          {filteredRecords.map((r) => r ? <div className="table row four" key={r.track}><span>{r.track}</span><span className="playerCell"><Avatar name={r.player} /> <span>{r.player}</span></span><strong>{r.timeText}</strong><span>{r.category}</span></div> : null)}
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">HEAD TO HEAD</div><h2>Direkte Duelle</h2></div></div>
          <div className="table head five"><span>Spieler A</span><span>Spieler B</span><span>Siege A</span><span>Siege B</span><span>Maps</span></div>
          {matchupRows.slice(0, 18).map((m) => <div className="table row five" key={`${m.a}-${m.b}`}><span>{m.a}</span><span>{m.b}</span><strong>{m.winsA}</strong><strong>{m.winsB}</strong><span>{m.maps}</span></div>)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><div className="eyebrow">PODIUM PRO MAP</div><h2>Gold · Silber · Bronze</h2></div></div>
        <div className="podiums">
          {podiumByTrack.slice(0, 24).map((p) => (
            <div className="podiumCard" key={p.track}>
              <strong>{p.track}</strong>
              <div className="podiumRow gold"><span>🥇</span><span>{p.top3[0]?.player || '-'}</span><strong>{p.top3[0]?.timeText || '-'}</strong></div>
              <div className="podiumRow silver"><span>🥈</span><span>{p.top3[1]?.player || '-'}</span><strong>{p.top3[1]?.timeText || '-'}</strong></div>
              <div className="podiumRow bronze"><span>🥉</span><span>{p.top3[2]?.player || '-'}</span><strong>{p.top3[2]?.timeText || '-'}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <style jsx global>{`
        :root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,Arial,sans-serif;background:radial-gradient(circle at top, rgba(26,80,255,.22), transparent 26%),radial-gradient(circle at right, rgba(0,224,255,.16), transparent 20%),linear-gradient(180deg,#050816 0%,#07101f 100%);color:#f5f7ff}a{text-decoration:none;color:inherit}button,input,select{font:inherit}.shell{width:min(1500px,calc(100% - 32px));margin:0 auto;padding:28px 0 56px}.hero,.panel,.card{border:1px solid rgba(255,255,255,.08);background:rgba(10,15,32,.78);backdrop-filter:blur(16px);box-shadow:0 18px 50px rgba(0,0,0,.32);border-radius:28px}.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;padding:28px}.eyebrow{margin:0 0 8px;color:#75b7ff;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;font-size:clamp(38px,6vw,66px);line-height:.96;letter-spacing:-.04em}h2{margin:4px 0 0}.sub{color:#c6d0f5;line-height:1.6}.actions,.filters{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.actions input,.actions select,.filters input,.filters select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:white;border-radius:14px;padding:14px;outline:none}.btn{border-radius:14px;padding:14px 18px;border:0;cursor:pointer}.primary{background:linear-gradient(135deg,#0077ff,#00d4ff);color:#fff;font-weight:800}.ghost{background:transparent;border:1px solid rgba(255,255,255,.12);color:#dbe4ff}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:24px}.stat{padding:18px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.stat span,.stat small{color:#aeb8d8}.stat strong{display:block;font-size:30px;margin:8px 0 4px}.card{padding:20px}.legend{display:grid;gap:12px;margin-top:14px}.legend div{padding:14px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.legend strong{display:block;margin-bottom:4px}.panel{padding:22px;margin-top:20px}.panel-head{display:flex;justify-content:space-between;align-items:center}.table{display:grid;gap:12px;align-items:center}.table.head{color:#9aa8d1;font-size:13px;padding:0 8px;text-transform:uppercase;letter-spacing:.08em;margin-top:14px}.table.row{padding:14px 12px;margin-top:10px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.four{grid-template-columns:1.8fr 1fr 1fr .8fr}.five{grid-template-columns:1fr 1fr .8fr .8fr .8fr}.ten{grid-template-columns:.4fr 1.2fr .7fr .7fr .5fr .6fr .7fr .8fr .8fr .7fr}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}.playerCell{display:flex;align-items:center;gap:10px}.avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.16)}.avatar.fallback{display:grid;place-items:center;background:linear-gradient(135deg,#1d4dff,#00cfff);font-weight:900}.podiums{display:grid;gap:12px;max-height:960px;overflow:auto}.podiumCard{padding:14px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.podiumRow{display:grid;grid-template-columns:28px 1fr auto;gap:10px;padding:10px 0}.gold{color:#ffd76b}.silver{color:#d4ddf7}.bronze{color:#e0a97a}.info{margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(0,212,120,.12);border:1px solid rgba(0,212,120,.2);color:#b8ffd8}.good{color:#8df2c7}.bad{color:#ff9f9f}@media (max-width:1180px){.hero,.grid,.stats{grid-template-columns:1fr}}@media (max-width:900px){.table.head{display:none}.table.row,.four,.five,.ten{grid-template-columns:1fr;gap:8px}}@media (max-width:780px){.shell{width:min(100% - 18px,100%);padding-top:18px}.hero,.panel,.card{padding:18px;border-radius:22px}h1{font-size:42px}}
      `}</style>
    </main>
  );
}
