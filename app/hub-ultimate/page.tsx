'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbyhOps49-_YQTKIFAQ49qKGDafcW1v-XkvrkAk6te9q7U6NewGM8Bud_F5adVxxRiYhSw/exec';

type Run = { id: string; category: string; map: string; track: string; player: string; timeText: string; timeMs: number; source: string };
type RankingRow = { player: string; points: number; records: number; entries: number; avgGap: number; bestMs: number; podiums: number };

type H2HRow = { playerA: string; playerB: string; winsA: number; winsB: number; ties: number; tracks: number };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (char === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeHeader(v: string) { return v.toLowerCase().trim(); }
function firstMatch(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(normalizeHeader(header)));
}
function parseNumber(value: string): number {
  const v = (value || '').trim().replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}
function toMs(value: string): number {
  const v = (value || '').trim().replace(',', '.');
  if (!v) return Number.POSITIVE_INFINITY;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 1000);
  const parts = v.split(':').map((p) => p.trim());
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) return Math.round(mins * 60000 + secs * 1000);
  }
  return Number.POSITIVE_INFINITY;
}
function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return '-';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms3 = ms % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`;
}
function formatGap(ms: number) {
  if (!Number.isFinite(ms)) return '-';
  return ms === 0 ? 'WR' : `+${(ms / 1000).toFixed(3)}s`;
}

function parseRunsFromCsv(csv: string): Run[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const categoryIdx = firstMatch(headers, ['kategorie', 'category']);
  const mapIdx = firstMatch(headers, ['map']);
  const playerIdx = firstMatch(headers, ['spieler', 'player']);
  const timeIdx = firstMatch(headers, ['zeit', 'time']);
  const sourceIdx = firstMatch(headers, ['quelle', 'source']);
  return rows.slice(1).map((row, i) => {
    const category = (categoryIdx >= 0 ? row[categoryIdx] : '').trim();
    const map = (mapIdx >= 0 ? row[mapIdx] : '').trim();
    const player = (playerIdx >= 0 ? row[playerIdx] : '').trim();
    const timeText = (timeIdx >= 0 ? row[timeIdx] : '').trim();
    const source = (sourceIdx >= 0 ? row[sourceIdx] : '').trim();
    const numeric = parseNumber(timeText);
    const track = `${category} #${map}`;
    return { id: `${i}-${category}-${map}-${player}`, category, map, track, player, timeText, timeMs: toMs(timeText), source };
  }).filter((run) => {
    const validTime = Number.isFinite(parseNumber(run.timeText));
    return !!run.category && !!run.map && !!run.player && validTime;
  });
}

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="tm-backdrop" onClick={onClose}><div className="tm-modal" onClick={(e) => e.stopPropagation()}><div className="tm-row tm-space"><div><div className="tm-eyebrow">TRACKMANIA ULTIMATE</div><h3>{title}</h3></div><button className="tm-btn tm-btn-ghost" onClick={onClose}>Schließen</button></div>{children}</div></div>;
}

export default function Page() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trackSearch, setTrackSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [detailTrack, setDetailTrack] = useState('');
  const [timeModal, setTimeModal] = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [newTime, setNewTime] = useState({ player: '', track: '', time: '', note: '' });
  const [newPlayer, setNewPlayer] = useState({ name: '', clan: '', note: '' });

  const loadRuns = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      const txt = await res.text();
      const parsed = parseRunsFromCsv(txt);
      setRuns(parsed);
      if (!detailTrack && parsed[0]) setDetailTrack(parsed[0].track);
      if (!newTime.player && parsed[0]) setNewTime((v) => ({ ...v, player: parsed[0].player }));
    } catch {
      setError('Live-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRuns(); }, []);

  const players = useMemo(() => Array.from(new Set(runs.map((r) => r.player))).sort((a, b) => a.localeCompare(b)), [runs]);
  const tracks = useMemo(() => Array.from(new Set(runs.map((r) => r.track))).sort((a, b) => a.localeCompare(b)), [runs]);

  const groupedByTrack = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of runs) {
      const arr = map.get(run.track) || [];
      arr.push(run);
      map.set(run.track, arr);
    }
    for (const [track, arr] of map.entries()) {
      arr.sort((a, b) => a.timeMs - b.timeMs);
      map.set(track, arr);
    }
    return map;
  }, [runs]);

  const recordsByTrack = useMemo(() => Array.from(groupedByTrack.entries()).map(([track, arr]) => arr[0]).sort((a, b) => a.track.localeCompare(b.track)), [groupedByTrack]);

  const ranking = useMemo<RankingRow[]>(() => {
    const score = new Map<string, RankingRow>();
    const pointTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    groupedByTrack.forEach((arr) => {
      const wr = arr[0]?.timeMs ?? Infinity;
      arr.forEach((run, idx) => {
        const row = score.get(run.player) || { player: run.player, points: 0, records: 0, entries: 0, avgGap: 0, bestMs: run.timeMs, podiums: 0 };
        row.entries += 1;
        row.bestMs = Math.min(row.bestMs, run.timeMs);
        row.avgGap += (run.timeMs - wr);
        if (idx === 0) row.records += 1;
        if (idx < 3) row.podiums += 1;
        row.points += pointTable[idx] || 0;
        score.set(run.player, row);
      });
    });
    return Array.from(score.values())
      .map((row) => ({ ...row, avgGap: row.entries ? row.avgGap / row.entries : Infinity }))
      .sort((a, b) => b.points - a.points || b.records - a.records || a.avgGap - b.avgGap);
  }, [groupedByTrack]);

  const headToHead = useMemo<H2HRow[]>(() => {
    const rows: H2HRow[] = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
        let winsA = 0, winsB = 0, ties = 0, tracks = 0;
        groupedByTrack.forEach((arr) => {
          const runA = arr.find((r) => r.player === a);
          const runB = arr.find((r) => r.player === b);
          if (runA && runB) {
            tracks += 1;
            if (runA.timeMs < runB.timeMs) winsA += 1;
            else if (runB.timeMs < runA.timeMs) winsB += 1;
            else ties += 1;
          }
        });
        if (tracks > 0) rows.push({ playerA: a, playerB: b, winsA, winsB, ties, tracks });
      }
    }
    return rows.sort((a, b) => b.tracks - a.tracks || Math.abs(b.winsA - b.winsB) - Math.abs(a.winsA - a.winsB));
  }, [players, groupedByTrack]);

  const dominance = useMemo(() => {
    const total = recordsByTrack.length || 1;
    return ranking.map((row) => ({ ...row, share: (row.records / total) * 100 })).sort((a, b) => b.share - a.share);
  }, [ranking, recordsByTrack.length]);

  const filteredRecords = useMemo(() => recordsByTrack.filter((r) => (!trackSearch || r.track.toLowerCase().includes(trackSearch.toLowerCase())) && (!playerFilter || r.player === playerFilter)), [recordsByTrack, trackSearch, playerFilter]);

  const trackDetailRuns = useMemo(() => (detailTrack ? (groupedByTrack.get(detailTrack) || []) : []), [groupedByTrack, detailTrack]);

  const submitTime = async () => {
    if (!newTime.player || !newTime.track || !newTime.time) { setError('Bitte Spieler, Strecke und Zeit ausfüllen.'); return; }
    try {
      setSaving(true); setError(''); setSuccess('');
      const res = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'time', payload: newTime }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Write failed');
      setSuccess('Zeit gespeichert. Daten werden neu geladen…');
      setTimeModal(false);
      setNewTime((v) => ({ ...v, track: '', time: '', note: '' }));
      setTimeout(() => loadRuns(), 900);
    } catch (err: any) { setError(`Speichern fehlgeschlagen: ${String(err?.message || err)}`); }
    finally { setSaving(false); }
  };

  const submitPlayer = async () => {
    if (!newPlayer.name) { setError('Bitte Spielernamen eingeben.'); return; }
    try {
      setSaving(true); setError(''); setSuccess('');
      const res = await fetch(WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'player', payload: newPlayer }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Write failed');
      setSuccess('Spieler gespeichert.');
      setPlayerModal(false);
      setNewPlayer({ name: '', clan: '', note: '' });
    } catch (err: any) { setError(`Speichern fehlgeschlagen: ${String(err?.message || err)}`); }
    finally { setSaving(false); }
  };

  return (
    <main className="tm-shell">
      <section className="tm-hero">
        <div>
          <div className="tm-eyebrow">TRACKMANIA ULTIMATE ANALYTICS</div>
          <h1>Ranking, Head-to-Head, Dominanz und Track Details</h1>
          <p className="tm-sub">Die Seite berechnet alles direkt aus <strong>Stammdaten_Pro</strong>: Punkte-Ranking, Rekorde, Podien, direkte Fahrerduelle und Detailansichten pro Strecke.</p>
          <div className="tm-actions">
            <button className="tm-btn tm-btn-primary" onClick={() => setTimeModal(true)}>➕ Neue Zeit</button>
            <button className="tm-btn tm-btn-secondary" onClick={() => setPlayerModal(true)}>👤 Spieler hinzufügen</button>
            <button className="tm-btn tm-btn-ghost" onClick={loadRuns}>{loading ? 'lädt…' : 'Neu laden'}</button>
            <a className="tm-btn tm-btn-ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Sheet öffnen</a>
          </div>
          <div className="tm-stats">
            <div className="tm-stat"><span>Spieler</span><strong>{players.length}</strong><small>aktive Fahrer</small></div>
            <div className="tm-stat"><span>Strecken</span><strong>{recordsByTrack.length}</strong><small>mit Record</small></div>
            <div className="tm-stat"><span>Einträge</span><strong>{runs.length}</strong><small>valide Zeiten</small></div>
            <div className="tm-stat"><span>Top Fahrer</span><strong>{ranking[0]?.player || '-'}</strong><small>{ranking[0]?.points || 0} Punkte</small></div>
          </div>
          {error ? <div className="tm-warning tm-error">{error}</div> : null}
          {success ? <div className="tm-warning tm-success">{success}</div> : null}
        </div>
        <div className="tm-card">
          <div className="tm-row tm-space"><span className="tm-pill">TOP RANKING</span><small>live berechnet</small></div>
          <div className="tm-list">
            {ranking.slice(0, 6).map((row, idx) => (
              <div className="tm-player" key={row.player}>
                <div className="tm-rank">#{idx + 1}</div>
                <div className="tm-grow"><strong>{row.player}</strong><span>{row.records} WRs · {row.podiums} Podien</span></div>
                <div className="tm-right"><strong>{row.points}</strong><small>{formatGap(row.avgGap)}</small></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-grid two-wide">
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">GLOBAL RANKING</div><h2>Punktesystem pro Strecke</h2></div></div>
          <div className="tm-table-head six"><span>#</span><span>Spieler</span><span>Punkte</span><span>WRs</span><span>Podien</span><span>Ø Gap</span></div>
          {ranking.map((row, idx) => <div className="tm-table-row six" key={row.player}><span>#{idx + 1}</span><span>{row.player}</span><strong>{row.points}</strong><span>{row.records}</span><span>{row.podiums}</span><span>{formatGap(row.avgGap)}</span></div>)}
        </div>
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">DOMINANZ</div><h2>Anteil an allen Streckenrekorden</h2></div></div>
          <div className="tm-mini-list">
            {dominance.map((row) => <div className="tm-run-card" key={row.player}><div className="tm-row tm-space"><strong>{row.player}</strong><strong>{row.share.toFixed(1)}%</strong></div><small>{row.records} von {recordsByTrack.length} WRs · beste Zeit {formatMs(row.bestMs)}</small><div className="bar"><div style={{ width: `${row.share}%` }} /></div></div>)}
          </div>
        </div>
      </section>

      <section className="tm-grid two-wide">
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">RECORD MAP</div><h2>Wer hält wo den Rekord?</h2></div></div>
          <div className="tm-filter-row"><input value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} placeholder="Strecke suchen…" /><select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)}><option value="">Alle Spieler</option>{players.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="tm-table-head four"><span>Strecke</span><span>Record Fahrer</span><span>Zeit</span><span>Kategorie</span></div>
          {filteredRecords.map((record) => <button className="tm-table-row four tm-click" key={record.track} onClick={() => setDetailTrack(record.track)}><span>{record.track}</span><span>{record.player}</span><strong>{record.timeText}</strong><span className="tm-pill tm-pill-soft">{record.category}</span></button>)}
        </div>
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">TRACK DETAIL</div><h2>{detailTrack || 'Strecke wählen'}</h2></div></div>
          <div className="tm-table-head five"><span>#</span><span>Spieler</span><span>Zeit</span><span>Gap</span><span>Quelle</span></div>
          {trackDetailRuns.map((run, idx) => <div className="tm-table-row five" key={run.id}><span>#{idx + 1}</span><span>{run.player}</span><strong>{run.timeText}</strong><span>{formatGap(run.timeMs - (trackDetailRuns[0]?.timeMs || run.timeMs))}</span><span>{run.source || '-'}</span></div>)}
        </div>
      </section>

      <section className="tm-panel tm-panel-large">
        <div className="tm-row tm-space"><div><div className="tm-eyebrow">HEAD TO HEAD</div><h2>Direkte Fahrerduelle auf gemeinsamen Strecken</h2></div></div>
        <div className="tm-table-head six"><span>Spieler A</span><span>Spieler B</span><span>Siege A</span><span>Siege B</span><span>Unentschieden</span><span>Tracks</span></div>
        {headToHead.map((row) => <div className="tm-table-row six" key={`${row.playerA}-${row.playerB}`}><span>{row.playerA}</span><span>{row.playerB}</span><strong>{row.winsA}</strong><strong>{row.winsB}</strong><span>{row.ties}</span><span>{row.tracks}</span></div>)}
      </section>

      <Modal open={timeModal} title="Neue Zeit speichern" onClose={() => setTimeModal(false)}>
        <div className="tm-form">
          <label><span>Spieler</span><select value={newTime.player} onChange={(e) => setNewTime((v) => ({ ...v, player: e.target.value }))}>{players.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label><span>Strecke</span><input list="track-list-ultimate" value={newTime.track} onChange={(e) => setNewTime((v) => ({ ...v, track: e.target.value }))} placeholder="Strecke wählen oder neue eingeben" /><datalist id="track-list-ultimate">{tracks.map((t) => <option key={t} value={t} />)}</datalist></label>
          <label><span>Zeit</span><input value={newTime.time} onChange={(e) => setNewTime((v) => ({ ...v, time: e.target.value }))} placeholder="17,603 oder 00:17.603" /></label>
          <label className="full"><span>Notiz</span><textarea value={newTime.note} onChange={(e) => setNewTime((v) => ({ ...v, note: e.target.value }))} placeholder="PB, safe run, risky line ..." /></label>
        </div>
        <div className="tm-actions"><button className="tm-btn tm-btn-primary" onClick={submitTime} disabled={saving}>{saving ? 'speichert…' : 'Direkt speichern'}</button></div>
      </Modal>

      <Modal open={playerModal} title="Spieler hinzufügen" onClose={() => setPlayerModal(false)}>
        <div className="tm-form">
          <label><span>Spielername</span><input value={newPlayer.name} onChange={(e) => setNewPlayer((v) => ({ ...v, name: e.target.value }))} placeholder="z. B. Marc" /></label>
          <label><span>Clan / Tag</span><input value={newPlayer.clan} onChange={(e) => setNewPlayer((v) => ({ ...v, clan: e.target.value }))} placeholder="z. B. ZR" /></label>
          <label className="full"><span>Notiz</span><textarea value={newPlayer.note} onChange={(e) => setNewPlayer((v) => ({ ...v, note: e.target.value }))} placeholder="Rolle oder Zusatzinfo" /></label>
        </div>
        <div className="tm-actions"><button className="tm-btn tm-btn-primary" onClick={submitPlayer} disabled={saving}>{saving ? 'speichert…' : 'Direkt speichern'}</button></div>
      </Modal>

      <style jsx global>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; font-family: Inter, Arial, sans-serif; background: radial-gradient(circle at top, rgba(26,80,255,.22), transparent 26%), radial-gradient(circle at right, rgba(0,224,255,.16), transparent 20%), linear-gradient(180deg, #050816 0%, #07101f 100%); color: #f5f7ff; }
        a { color: inherit; text-decoration: none; }
        button, input, textarea, select { font: inherit; }
        .tm-shell { width: min(1480px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
        .tm-hero, .tm-panel, .tm-modal { border: 1px solid rgba(255,255,255,.08); background: rgba(10,15,32,.78); backdrop-filter: blur(16px); box-shadow: 0 18px 50px rgba(0,0,0,.32); }
        .tm-hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; border-radius: 28px; padding: 28px; }
        .tm-eyebrow { margin: 0 0 8px; color: #75b7ff; font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        h1 { margin: 0; font-size: clamp(38px, 6vw, 68px); line-height: .96; letter-spacing: -.04em; }
        h2, h3 { margin: 4px 0 0; }
        .tm-sub { max-width: 740px; color: #c6d0f5; font-size: 18px; line-height: 1.6; margin: 18px 0 0; }
        .tm-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        .tm-btn { border-radius: 14px; padding: 14px 18px; border: 0; cursor: pointer; transition: .18s ease; }
        .tm-btn:hover, .tm-click:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .tm-btn-primary { background: linear-gradient(135deg, #0077ff, #00d4ff); color: white; font-weight: 800; }
        .tm-btn-secondary { background: rgba(255,255,255,.08); color: white; font-weight: 700; border: 1px solid rgba(255,255,255,.14); }
        .tm-btn-ghost { color: #dbe4ff; background: transparent; border: 1px solid rgba(255,255,255,.12); }
        .tm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 28px; }
        .tm-stat, .tm-card, .tm-run-card, .tm-table-row, .tm-modal { border-radius: 18px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .tm-stat { padding: 18px; }
        .tm-stat span, .tm-stat small, .tm-player span, .tm-right small, .tm-run-card small { color: #aeb8d8; }
        .tm-stat strong { display: block; font-size: 30px; margin: 8px 0 4px; letter-spacing: -.04em; }
        .tm-warning { margin-top: 14px; padding: 12px 14px; border-radius: 14px; }
        .tm-error { background: rgba(255,70,70,.12); border: 1px solid rgba(255,70,70,.2); color: #ffb4b4; }
        .tm-success { background: rgba(0,212,120,.12); border: 1px solid rgba(0,212,120,.2); color: #b8ffd8; }
        .tm-card { padding: 20px; background: linear-gradient(180deg, rgba(0,119,255,.16), rgba(255,255,255,.04)), rgba(255,255,255,.02); }
        .tm-row { display: flex; align-items: center; gap: 12px; }
        .tm-space { justify-content: space-between; }
        .tm-list, .tm-mini-list { display: grid; gap: 12px; margin-top: 18px; }
        .tm-player { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
        .tm-rank { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(135deg, #1d4dff, #00cfff); font-weight: 900; }
        .tm-grow { display: grid; flex: 1; }
        .tm-right { display: grid; text-align: right; font-weight: 700; }
        .tm-grid { display: grid; gap: 20px; margin-top: 20px; }
        .two-wide { grid-template-columns: 1fr 1fr; }
        .tm-panel { border-radius: 26px; padding: 22px; }
        .tm-filter-row { display: grid; grid-template-columns: 1fr 240px; gap: 12px; margin: 16px 0 12px; }
        .tm-filter-row input, .tm-filter-row select, .tm-form input, .tm-form textarea, .tm-form select { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: white; border-radius: 14px; padding: 14px; outline: none; }
        .tm-table-head, .tm-table-row { display: grid; gap: 12px; align-items: center; }
        .tm-table-head { color: #9aa8d1; font-size: 13px; padding: 0 8px; text-transform: uppercase; letter-spacing: .08em; }
        .tm-table-row { padding: 14px 12px; margin-top: 10px; text-align: left; color: inherit; }
        .four { grid-template-columns: 1.8fr 1fr 1fr .8fr; }
        .five { grid-template-columns: .6fr 1fr 1fr .9fr .9fr; }
        .six { grid-template-columns: .5fr 1.2fr .8fr .8fr .8fr .9fr; }
        .tm-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.09); color: white; }
        .tm-pill-soft { background: rgba(0,212,255,.14); color: #8fe7ff; width: fit-content; }
        .tm-run-card { padding: 14px; }
        .bar { width: 100%; height: 10px; border-radius: 999px; background: rgba(255,255,255,.08); margin-top: 10px; overflow: hidden; }
        .bar > div { height: 100%; background: linear-gradient(90deg, #0077ff, #00d4ff); border-radius: 999px; }
        .tm-panel-large { margin-top: 20px; }
        .tm-backdrop { position: fixed; inset: 0; padding: 22px; background: rgba(3,5,15,.74); display: grid; place-items: center; z-index: 1000; }
        .tm-modal { width: min(820px, 100%); padding: 22px; background: #0c1227; box-shadow: 0 30px 90px rgba(0,0,0,.48); }
        .tm-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
        .tm-form label { display: grid; gap: 8px; color: #d8e0ff; font-weight: 600; }
        .tm-form .full { grid-column: 1 / -1; }
        .tm-form textarea { min-height: 120px; resize: vertical; }
        @media (max-width: 1180px) { .tm-hero, .two-wide, .tm-form, .tm-stats { grid-template-columns: 1fr; } }
        @media (max-width: 780px) { .tm-shell { width: min(100% - 18px, 100%); padding-top: 18px; } .tm-hero, .tm-panel { padding: 18px; border-radius: 22px; } h1 { font-size: 42px; } .tm-filter-row { grid-template-columns: 1fr; } .tm-table-head { display: none; } .tm-table-row, .four, .five, .six { grid-template-columns: 1fr; gap: 8px; } }
      `}</style>
    </main>
  );
}
