'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbyhOps49-_YQTKIFAQ49qKGDafcW1v-XkvrkAk6te9q7U6NewGM8Bud_F5adVxxRiYhSw/exec';

type Run = {
  id: string;
  player: string;
  track: string;
  timeText: string;
  timeMs: number;
  note?: string;
  category?: string;
};

const FALLBACK_RUNS: Run[] = [
  { id: '1', player: 'Marc', track: '1mpi #29', timeText: '00:47.882', timeMs: 47882, category: '1mpi', note: 'PB' },
  { id: '2', player: 'Oli', track: 'Kurve #2', timeText: '00:48.114', timeMs: 48114, category: 'Kurve', note: 'Clean' },
  { id: '3', player: 'Nico', track: 'Dirt #1', timeText: '00:48.391', timeMs: 48391, category: 'Dirt', note: 'New' },
  { id: '4', player: 'Schaller', track: 'Kollegolas Maps #8', timeText: '00:48.774', timeMs: 48774, category: 'Kollegolas', note: 'Risky' },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeHeader(v: string) {
  return v.toLowerCase().trim();
}

function firstMatch(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(normalizeHeader(header)));
}

function parseTimeToMs(value: string): number {
  const v = (value || '').trim().replace(',', '.');
  if (!v) return Number.POSITIVE_INFINITY;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 1000);
  const parts = v.split(':').map((p) => p.trim());
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) return Math.round(mins * 60000 + secs * 1000);
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseFloat(parts[2]);
    if (Number.isFinite(hours) && Number.isFinite(mins) && Number.isFinite(secs)) return Math.round(hours * 3600000 + mins * 60000 + secs * 1000);
  }
  return Number.POSITIVE_INFINITY;
}

function categoryFromTrack(track: string) {
  const v = track.toLowerCase();
  if (v.includes('1mpi')) return '1mpi';
  if (v.includes('kollegolas')) return 'Kollegolas';
  if (v.includes('kurve')) return 'Kurve';
  if (v.includes('dirtbike')) return 'DirtBike';
  if (v.includes('dirt')) return 'Dirt';
  if (v.includes('gras')) return 'Gras';
  if (v.includes('stadium')) return 'Stadium';
  if (v.includes('wiggle')) return 'Wiggle';
  return 'Sonstige';
}

function parseRunsFromCsv(csv: string): Run[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const playerIdx = firstMatch(headers, ['spieler', 'player', 'fahrer', 'name']);
  const trackIdx = firstMatch(headers, ['strecke', 'track', 'map', 'streckenname']);
  const timeIdx = firstMatch(headers, ['zeit', 'time', 'bestzeit', 'record']);
  const noteIdx = firstMatch(headers, ['notiz', 'note', 'kommentar', 'comment']);
  const categoryIdx = firstMatch(headers, ['gruppe', 'group', 'kategorie', 'category']);
  if (playerIdx === -1 || trackIdx === -1 || timeIdx === -1) return [];

  return rows.slice(1).map((row, idx) => {
    const track = row[trackIdx]?.trim() || '';
    const timeText = row[timeIdx]?.trim() || '';
    return {
      id: `${idx}-${row[playerIdx] || ''}-${track}`,
      player: row[playerIdx]?.trim() || '-',
      track,
      timeText,
      timeMs: parseTimeToMs(timeText),
      note: noteIdx >= 0 ? row[noteIdx]?.trim() : '',
      category: categoryIdx >= 0 ? row[categoryIdx]?.trim() || categoryFromTrack(track) : categoryFromTrack(track),
    };
  }).filter((run) => run.track && run.player && Number.isFinite(run.timeMs));
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return '-';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; }) {
  if (!open) return null;
  return (
    <div className="tm-backdrop" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-row tm-space">
          <div>
            <div className="tm-eyebrow">TRACKMANIA HUB LIVE</div>
            <h3>{title}</h3>
          </div>
          <button className="tm-btn tm-btn-ghost" onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HubLivePage() {
  const [runs, setRuns] = useState<Run[]>(FALLBACK_RUNS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [playerModal, setPlayerModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', clan: '', note: '' });
  const [newTime, setNewTime] = useState({ player: '', track: '', time: '', note: '' });

  const loadRuns = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      const csv = await res.text();
      const parsed = parseRunsFromCsv(csv);
      if (parsed.length) {
        setRuns(parsed);
        setNewTime((v) => ({ ...v, player: v.player || parsed[0].player }));
      } else {
        setErrorText('Live-Daten konnten nicht gelesen werden. Fallback-Daten aktiv.');
      }
    } catch {
      setErrorText('Google-Sheet-Livezugriff fehlgeschlagen. Fallback-Daten aktiv.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const players = useMemo(() => Array.from(new Set(runs.map((run) => run.player))).sort((a, b) => a.localeCompare(b)), [runs]);
  const tracks = useMemo(() => Array.from(new Set(runs.map((run) => run.track))).sort((a, b) => a.localeCompare(b)), [runs]);

  useEffect(() => {
    if (!newTime.player && players.length) setNewTime((v) => ({ ...v, player: players[0] }));
  }, [players, newTime.player]);

  const recordsByTrack = useMemo(() => {
    const map = new Map<string, Run>();
    for (const run of runs) {
      const existing = map.get(run.track);
      if (!existing || run.timeMs < existing.timeMs) map.set(run.track, run);
    }
    return Array.from(map.values()).sort((a, b) => a.track.localeCompare(b.track));
  }, [runs]);

  const recordLeaders = useMemo(() => {
    const map = new Map<string, { player: string; totalRecords: number; bestMs: number }>();
    for (const record of recordsByTrack) {
      const current = map.get(record.player) || { player: record.player, totalRecords: 0, bestMs: record.timeMs };
      current.totalRecords += 1;
      current.bestMs = Math.min(current.bestMs, record.timeMs);
      map.set(record.player, current);
    }
    return Array.from(map.values()).sort((a, b) => b.totalRecords - a.totalRecords || a.bestMs - b.bestMs);
  }, [recordsByTrack]);

  const filteredRecords = useMemo(() => {
    return recordsByTrack.filter((record) => {
      const tOk = !trackFilter || record.track.toLowerCase().includes(trackFilter.toLowerCase());
      const pOk = !playerFilter || record.player === playerFilter;
      return tOk && pOk;
    });
  }, [recordsByTrack, trackFilter, playerFilter]);

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const tOk = !trackFilter || run.track.toLowerCase().includes(trackFilter.toLowerCase());
      const pOk = !playerFilter || run.player === playerFilter;
      return tOk && pOk;
    }).sort((a, b) => a.timeMs - b.timeMs);
  }, [runs, trackFilter, playerFilter]);

  const topRecord = useMemo(() => [...runs].sort((a, b) => a.timeMs - b.timeMs)[0], [runs]);

  const submitTime = async () => {
    if (!newTime.player || !newTime.track || !newTime.time) {
      setErrorText('Bitte Spieler, Strecke und Zeit ausfüllen.');
      return;
    }
    try {
      setSaving(true);
      setErrorText('');
      setSuccessText('');
      const res = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'time', payload: newTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Write failed');
      setSuccessText('Zeit gespeichert. Lade Daten neu…');
      setTimeModal(false);
      setNewTime((v) => ({ ...v, track: '', time: '', note: '' }));
      setTimeout(() => loadRuns(), 900);
    } catch (err: any) {
      setErrorText(`Speichern fehlgeschlagen: ${String(err?.message || err)}`);
    } finally {
      setSaving(false);
    }
  };

  const submitPlayer = async () => {
    if (!newPlayer.name) {
      setErrorText('Bitte mindestens einen Spielernamen eingeben.');
      return;
    }
    try {
      setSaving(true);
      setErrorText('');
      setSuccessText('');
      const res = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'player', payload: newPlayer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Write failed');
      setSuccessText('Spieler gespeichert.');
      setPlayerModal(false);
      setNewPlayer({ name: '', clan: '', note: '' });
    } catch (err: any) {
      setErrorText(`Speichern fehlgeschlagen: ${String(err?.message || err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="tm-shell">
      <section className="tm-hero">
        <div>
          <div className="tm-eyebrow">TRACKMANIA HUB LIVE</div>
          <h1>Echte Schreibverbindung aktiv</h1>
          <p className="tm-sub">Diese Version ist direkt mit deinem Google Apps Script verbunden. Zeiten und Spieler können jetzt direkt gespeichert werden, und die Rekordansicht lädt danach neu.</p>
          <div className="tm-actions">
            <button className="tm-btn tm-btn-primary" onClick={() => setTimeModal(true)}>➕ Neue Zeit</button>
            <button className="tm-btn tm-btn-secondary" onClick={() => setPlayerModal(true)}>👤 Spieler hinzufügen</button>
            <button className="tm-btn tm-btn-ghost" onClick={loadRuns}>{loading ? 'lädt…' : 'Daten neu laden'}</button>
            <a className="tm-btn tm-btn-ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Tabelle öffnen</a>
          </div>
          <div className="tm-stats">
            <div className="tm-stat"><span>Spieler</span><strong>{players.length}</strong><small>erkannte Fahrer</small></div>
            <div className="tm-stat"><span>Strecken</span><strong>{recordsByTrack.length}</strong><small>mit Record</small></div>
            <div className="tm-stat"><span>Top Record</span><strong>{topRecord ? topRecord.timeText : '-'}</strong><small>{topRecord ? `${topRecord.player} auf ${topRecord.track}` : 'keine Daten'}</small></div>
            <div className="tm-stat"><span>API</span><strong>LIVE</strong><small>Apps Script verbunden</small></div>
          </div>
          {errorText ? <div className="tm-warning tm-error">{errorText}</div> : null}
          {successText ? <div className="tm-warning tm-success">{successText}</div> : null}
        </div>
        <div className="tm-card">
          <div className="tm-row tm-space"><span className="tm-pill">RECORD LEADERS</span><small>wer hält wie viele Strecken</small></div>
          <div className="tm-list">
            {recordLeaders.slice(0, 8).map((entry, idx) => (
              <div className="tm-player" key={entry.player}>
                <div className="tm-rank">#{idx + 1}</div>
                <div className="tm-grow"><strong>{entry.player}</strong><span>{entry.totalRecords} Streckenrekorde</span></div>
                <div className="tm-right"><strong>{formatMs(entry.bestMs)}</strong><small>beste Einzelzeit</small></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-grid">
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">RECORDS PRO STRECKE</div><h2>Wer hält wo den Rekord?</h2></div></div>
          <div className="tm-filter-row">
            <input value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} placeholder="Strecke suchen…" />
            <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)}>
              <option value="">Alle Spieler</option>
              {players.map((player) => <option key={player} value={player}>{player}</option>)}
            </select>
          </div>
          <div className="tm-table-head"><span>Strecke</span><span>Record Fahrer</span><span>Bestzeit</span><span>Kategorie</span></div>
          {filteredRecords.map((record) => (
            <div className="tm-table-row" key={record.track}>
              <span>{record.track}</span>
              <span>{record.player}</span>
              <strong>{record.timeText}</strong>
              <span className="tm-pill tm-pill-soft">{record.category || categoryFromTrack(record.track)}</span>
            </div>
          ))}
        </div>

        <div className="tm-panel">
          <div className="tm-eyebrow">RUN FEED</div>
          <h2>Zeiten-Feed</h2>
          <div className="tm-mini-list">
            {filteredRuns.slice(0, 18).map((run) => (
              <div className="tm-run-card" key={run.id}>
                <strong>{run.track}</strong>
                <span>{run.player}</span>
                <div className="tm-row tm-space"><small>{run.note || 'ohne Notiz'}</small><strong>{run.timeText}</strong></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-panel tm-panel-large">
        <div className="tm-row tm-space"><div><div className="tm-eyebrow">GOOGLE SHEET</div><h2>Direkt eingebunden</h2></div><a href={SHEET_URL} target="_blank" rel="noreferrer">Im neuen Tab öffnen</a></div>
        <div className="tm-frame"><iframe src={SHEET_URL.replace('/edit?usp=sharing', '/edit?rm=minimal')} width="100%" height="100%" style={{ border: 'none' }} allowFullScreen title="Trackmania Sheet" /></div>
      </section>

      <Modal open={timeModal} title="Neue Zeit speichern" onClose={() => setTimeModal(false)}>
        <div className="tm-form">
          <label><span>Spieler</span><select value={newTime.player} onChange={(e) => setNewTime((v) => ({ ...v, player: e.target.value }))}>{players.map((player) => <option key={player} value={player}>{player}</option>)}</select></label>
          <label><span>Strecke</span><input list="tracks-live-write" value={newTime.track} onChange={(e) => setNewTime((v) => ({ ...v, track: e.target.value }))} placeholder="Strecke wählen oder neue eingeben" /><datalist id="tracks-live-write">{tracks.map((track) => <option key={track} value={track} />)}</datalist></label>
          <label><span>Zeit</span><input value={newTime.time} onChange={(e) => setNewTime((v) => ({ ...v, time: e.target.value }))} placeholder="00:48.114" /></label>
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
        .tm-shell { width: min(1440px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
        .tm-hero, .tm-panel, .tm-modal { border: 1px solid rgba(255,255,255,.08); background: rgba(10,15,32,.78); backdrop-filter: blur(16px); box-shadow: 0 18px 50px rgba(0,0,0,.32); }
        .tm-hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; border-radius: 28px; padding: 28px; }
        .tm-eyebrow { margin: 0 0 8px; color: #75b7ff; font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        h1 { margin: 0; font-size: clamp(38px, 6vw, 68px); line-height: .96; letter-spacing: -.04em; }
        h2, h3 { margin: 4px 0 0; }
        .tm-sub { max-width: 720px; color: #c6d0f5; font-size: 18px; line-height: 1.6; margin: 18px 0 0; }
        .tm-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        .tm-btn { border-radius: 14px; padding: 14px 18px; border: 0; cursor: pointer; transition: .18s ease; }
        .tm-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .tm-btn-primary { background: linear-gradient(135deg, #0077ff, #00d4ff); color: white; font-weight: 800; }
        .tm-btn-secondary { background: rgba(255,255,255,.08); color: white; font-weight: 700; border: 1px solid rgba(255,255,255,.14); }
        .tm-btn-ghost { color: #dbe4ff; background: transparent; border: 1px solid rgba(255,255,255,.12); }
        .tm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 28px; }
        .tm-stat, .tm-card, .tm-note, .tm-run-card, .tm-table-row { border-radius: 18px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .tm-stat { padding: 18px; }
        .tm-stat span, .tm-stat small, .tm-player span, .tm-right small, .tm-run-card span, .tm-run-card small { color: #aeb8d8; }
        .tm-stat strong { display: block; font-size: 30px; margin: 8px 0 4px; letter-spacing: -.04em; }
        .tm-warning { margin-top: 14px; padding: 12px 14px; border-radius: 14px; }
        .tm-error { background: rgba(255, 70, 70, .12); border: 1px solid rgba(255, 70, 70, .2); color: #ffb4b4; }
        .tm-success { background: rgba(0, 212, 120, .12); border: 1px solid rgba(0, 212, 120, .2); color: #b8ffd8; }
        .tm-card { padding: 20px; background: linear-gradient(180deg, rgba(0,119,255,.16), rgba(255,255,255,.04)), rgba(255,255,255,.02); }
        .tm-row { display: flex; align-items: center; gap: 12px; }
        .tm-space { justify-content: space-between; }
        .tm-list, .tm-mini-list { display: grid; gap: 12px; margin-top: 18px; }
        .tm-player { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
        .tm-rank { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(135deg, #1d4dff, #00cfff); font-weight: 900; }
        .tm-grow { display: grid; flex: 1; }
        .tm-right { display: grid; text-align: right; font-weight: 700; }
        .tm-grid { display: grid; grid-template-columns: 1.25fr .75fr; gap: 20px; margin-top: 20px; }
        .tm-panel { border-radius: 26px; padding: 22px; }
        .tm-filter-row { display: grid; grid-template-columns: 1fr 240px; gap: 12px; margin: 16px 0 12px; }
        .tm-filter-row input, .tm-filter-row select { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: white; border-radius: 14px; padding: 14px; outline: none; }
        .tm-table-head, .tm-table-row { display: grid; grid-template-columns: 1.8fr 1fr 1fr .8fr; gap: 12px; align-items: center; }
        .tm-table-head { color: #9aa8d1; font-size: 13px; padding: 0 8px; text-transform: uppercase; letter-spacing: .08em; }
        .tm-table-row { padding: 14px 12px; margin-top: 10px; }
        .tm-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.09); color: white; }
        .tm-pill-soft { background: rgba(0,212,255,.14); color: #8fe7ff; width: fit-content; }
        .tm-run-card { padding: 14px; }
        .tm-panel-large { margin-top: 20px; }
        .tm-frame { margin-top: 16px; height: 78vh; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
        .tm-backdrop { position: fixed; inset: 0; padding: 22px; background: rgba(3,5,15,.74); display: grid; place-items: center; z-index: 1000; }
        .tm-modal { width: min(820px, 100%); border-radius: 24px; padding: 22px; background: #0c1227; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 90px rgba(0,0,0,.48); }
        .tm-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
        .tm-form label { display: grid; gap: 8px; color: #d8e0ff; font-weight: 600; }
        .tm-form .full { grid-column: 1 / -1; }
        .tm-form input, .tm-form textarea, .tm-form select { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: white; border-radius: 14px; padding: 14px; outline: none; }
        .tm-form textarea { min-height: 120px; resize: vertical; }
        @media (max-width: 1080px) { .tm-hero, .tm-grid, .tm-form, .tm-stats { grid-template-columns: 1fr; } }
        @media (max-width: 720px) { .tm-shell { width: min(100% - 18px, 100%); padding-top: 18px; } .tm-hero, .tm-panel { padding: 18px; border-radius: 22px; } h1 { font-size: 42px; } .tm-filter-row { grid-template-columns: 1fr; } .tm-table-head { display: none; } .tm-table-row { grid-template-columns: 1fr; gap: 8px; } .tm-frame { height: 68vh; } }
      `}</style>
    </main>
  );
}
