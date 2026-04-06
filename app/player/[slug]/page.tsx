'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;

const PLAYER_PROFILES: Record<string, { name: string; title: string; color: string; description: string; signature: string; legacy: string; roast: string; hardRoast: string; avatar?: string; }> = {
  schaller: {
    name: 'Schaller',
    title: 'Der Linien-Gott',
    color: '#3b82f6',
    description: 'Fährt sauber wie ein Tutorial-Run, maximale Effizienz auf der Strecke.',
    signature: 'Redet 5 Minuten über eine Strecke, fährt sie dann First-Try.',
    legacy: 'Hat mehr Lines analysiert als gefahren.',
    roast: 'Wenn Trophäen Punkte gäben, wär er WR #1.',
    hardRoast: 'Hat jede Ideallinie im Kopf – schade, dass der Run nicht mitkommt.',
  },
  olli: {
    name: 'Olli',
    title: 'Der Risikospieler',
    color: '#ef4444',
    description: 'Geht an Limits, findet Cuts, die eigentlich nicht existieren sollten.',
    signature: 'Entweder Shortcut des Jahrhunderts oder kompletter Totalschaden.',
    legacy: '70% seiner Runs sind Experimente.',
    roast: '50% WR-Pace, 50% Totalschaden.',
    hardRoast: 'Wenn Chaos/Shortcuts ein Fahrstil wäre, hätte Olli WR… vielleicht.',
  },
  marc: {
    name: 'Marc',
    title: 'Der Restart-König',
    color: '#a855f7',
    description: 'Verbessert sich pro Run, baut TOP-PEAK Strecken.',
    signature: 'Restart → Fail → Give Up.',
    legacy: 'Hat mehr Zeit im Restart als im Ziel verbracht.',
    roast: 'Spielt 3 Stunden für „war eigentlich kein guter Run“ und nennt das Fortschritt.',
    hardRoast: 'Spielt nicht Trackmania, sondern Excel mit Autos.',
  },
  nico: {
    name: 'Nico',
    title: 'Der NPC-Endboss',
    color: '#9ca3af',
    description: 'Die konstante Maschine. Zum Fürchten gut.',
    signature: 'Fährt IMMER solide… kaum Fehler, extrem konstant.',
    legacy: 'Fährt langweilig gut, aber halt immer oben dabei.',
    roast: 'Fährt wie ein Bot – leider ein verdammt guter.',
    hardRoast: 'Kein Highlight, kein Fail – einfach da. Immer. Unnötig gut.',
  },
  manu: {
    name: 'Manu',
    title: 'Der Flow-Fahrer',
    color: '#22c55e',
    description: 'Gutes Gefühl für Tempo, Drifts und Rhythmus.',
    signature: 'Sieht langsam aus, ist aber schneller als gedacht.',
    legacy: 'Macht Speed ohne Stress sichtbar.',
    roast: 'Konstant Top, aber nix halbes nix ganzes.',
    hardRoast: 'Fährt entspannt WR-Pace, während andere schwitzen, aber kommt nie ran.',
  },
  philipp: {
    name: 'Philipp',
    title: 'Der Wallbanger aus dem Nichts',
    color: '#f97316',
    description: 'Liefert plötzlich Bestzeiten, taucht auf und testet jede Wand persönlich.',
    signature: 'Ballert ungeahnt per Wallbang durchs Ziel.',
    legacy: 'Klaut dir Records, wenn du denkst, du bist safe.',
    roast: 'Fährt Müll-Runs… bis plötzlich Personal Best.',
    hardRoast: 'Sein bester Skill ist schlechtes Fahren… bis er plötzlich nicht mehr schlecht fährt.',
  },
};

type Run = { id: string; category: string; map: string; track: string; player: string; timeText: string; timeMs: number; source: string };

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
function initials(name: string) { return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }

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

function PlayerAvatar({ profile }: { profile: { name: string; avatar?: string } }) {
  if (profile.avatar) return <img src={profile.avatar} alt={profile.name} className="avatar big" />;
  return <div className="avatar fallback big">{initials(profile.name)}</div>;
}

export default function PlayerPage({ params }: { params: { slug: string } }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const profile = PLAYER_PROFILES[params.slug];

  useEffect(() => {
    const load = async () => {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      const txt = await res.text();
      setRuns(parseRunsFromCsv(txt));
    };
    load();
  }, []);

  const playerRuns = useMemo(() => runs.filter((r) => r.player.toLowerCase() === (profile?.name || '').toLowerCase()), [runs, profile]);

  const groupedByTrack = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const run of runs) {
      const arr = map.get(run.track) || [];
      arr.push(run);
      map.set(run.track, arr);
    }
    for (const [track, arr] of Array.from(map.entries())) {
      arr.sort((a, b) => a.timeMs - b.timeMs);
      map.set(track, arr);
    }
    return map;
  }, [runs]);

  const records = useMemo(() => {
    const wrs: Run[] = [];
    groupedByTrack.forEach((arr) => {
      if (arr[0] && arr[0].player.toLowerCase() === (profile?.name || '').toLowerCase()) wrs.push(arr[0]);
    });
    return wrs;
  }, [groupedByTrack, profile]);

  const stats = useMemo(() => {
    if (!profile) return null;
    let points = 0; let recordsCount = 0; let podiums = 0; let avgGapSum = 0;
    const pointTable = [25,18,15,12,10,8,6,4,2,1];
    groupedByTrack.forEach((arr) => {
      const wr = arr[0]?.timeMs ?? Infinity;
      arr.forEach((run, idx) => {
        if (run.player.toLowerCase() === profile.name.toLowerCase()) {
          points += pointTable[idx] || 0;
          avgGapSum += run.timeMs - wr;
          if (idx === 0) recordsCount += 1;
          if (idx < 3) podiums += 1;
        }
      });
    });
    return {
      points,
      records: recordsCount,
      podiums,
      runs: playerRuns.length,
      avgGap: playerRuns.length ? avgGapSum / playerRuns.length : Infinity,
      bestRun: playerRuns.length ? playerRuns.reduce((a,b)=>a.timeMs<b.timeMs?a:b) : null,
    };
  }, [profile, groupedByTrack, playerRuns]);

  if (!profile) return notFound();

  return (
    <main className="shell">
      <Link href="/hub-elite-esports" className="back">← Zurück zum Hub</Link>

      <section className="hero" style={{ borderColor: profile.color }}>
        <div className="heroLeft">
          <PlayerAvatar profile={profile} />
          <div>
            <div className="eyebrow">TEAM ZOSCH RACING</div>
            <h1>{profile.name}</h1>
            <div className="subtitle">{profile.title}</div>
            <p className="desc">{profile.description}</p>
          </div>
        </div>
        <div className="heroRight">
          <div className="quote"><strong>Signature Move:</strong> {profile.signature}</div>
          <div className="quote"><strong>Legacy:</strong> {profile.legacy}</div>
          <div className="roast"><strong>Roast:</strong> {profile.roast}</div>
          <div className="hard"><strong>Hard Roast:</strong> {profile.hardRoast}</div>
        </div>
      </section>

      <section className="statsGrid">
        <div className="statCard"><span>Punkte</span><strong>{stats?.points ?? 0}</strong></div>
        <div className="statCard"><span>WRs</span><strong>{stats?.records ?? 0}</strong></div>
        <div className="statCard"><span>Podien</span><strong>{stats?.podiums ?? 0}</strong></div>
        <div className="statCard"><span>Runs</span><strong>{stats?.runs ?? 0}</strong></div>
        <div className="statCard"><span>Ø Gap</span><strong>{formatGap(stats?.avgGap ?? Infinity)}</strong></div>
        <div className="statCard"><span>Best Run</span><strong>{stats?.bestRun?.timeText ?? '-'}</strong></div>
      </section>

      <section className="panel">
        <div className="panelHead"><div><div className="eyebrow">WR MAPS</div><h2>Strecken mit Platz 1</h2></div></div>
        <div className="table head three"><span>Strecke</span><span>Zeit</span><span>Kategorie</span></div>
        {records.length ? records.map((r) => <div className="table row three" key={r.track}><span>{r.track}</span><strong>{r.timeText}</strong><span>{r.category}</span></div>) : <div className="empty">Noch keine WR-Maps vorhanden.</div>}
      </section>

      <section className="panel">
        <div className="panelHead"><div><div className="eyebrow">RUN HISTORY</div><h2>Letzte Runs & Strecken</h2></div></div>
        <div className="table head four"><span>Strecke</span><span>Zeit</span><span>Kategorie</span><span>Quelle</span></div>
        {playerRuns.slice(0, 30).map((r) => <div className="table row four" key={r.id}><span>{r.track}</span><strong>{r.timeText}</strong><span>{r.category}</span><span>{r.source || '-'}</span></div>)}
      </section>

      <section className="panel uploadHint">
        <div className="panelHead"><div><div className="eyebrow">PROFILBILD UPLOAD</div><h2>Vorbereitet für echten Upload</h2></div></div>
        <p>Als nächster Schritt kann pro Spieler ein Upload-Flow angebunden werden, damit Avatare nicht mehr hart im Code gepflegt werden müssen.</p>
      </section>

      <style jsx global>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; font-family: Inter, Arial, sans-serif; background: radial-gradient(circle at top, rgba(26,80,255,.22), transparent 26%), radial-gradient(circle at right, rgba(0,224,255,.16), transparent 20%), linear-gradient(180deg, #050816 0%, #07101f 100%); color: #f5f7ff; }
        a { text-decoration: none; color: inherit; }
        .shell { width: min(1200px, calc(100% - 28px)); margin: 0 auto; padding: 28px 0 56px; }
        .back { display: inline-block; margin-bottom: 16px; color: #cfe0ff; }
        .hero, .panel, .statCard { border: 1px solid rgba(255,255,255,.08); background: rgba(10,15,32,.78); backdrop-filter: blur(16px); box-shadow: 0 18px 50px rgba(0,0,0,.32); border-radius: 28px; }
        .hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 22px; padding: 28px; }
        .heroLeft { display: flex; gap: 18px; align-items: center; }
        .heroRight { display: grid; gap: 12px; }
        .eyebrow { margin: 0 0 8px; color: #75b7ff; font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        h1 { margin: 0; font-size: clamp(38px, 6vw, 66px); line-height: .96; letter-spacing: -.04em; }
        h2 { margin: 4px 0 0; }
        .subtitle { color: #d8e2ff; font-size: 20px; font-weight: 700; margin-top: 8px; }
        .desc { color: #c6d0f5; line-height: 1.6; max-width: 680px; }
        .quote, .roast, .hard { padding: 14px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .roast { color: #ffb5b5; }
        .hard { color: #ff7c7c; font-weight: 700; }
        .avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,.16); }
        .avatar.big { width: 90px; height: 90px; font-size: 34px; }
        .avatar.fallback { display: grid; place-items: center; background: linear-gradient(135deg, #1d4dff, #00cfff); font-weight: 900; }
        .statsGrid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
        .statCard { padding: 18px; }
        .statCard span { color: #aeb8d8; display: block; }
        .statCard strong { display: block; font-size: 28px; margin-top: 8px; }
        .panel { padding: 22px; margin-top: 20px; }
        .panelHead { display: flex; justify-content: space-between; align-items: center; }
        .table { display: grid; gap: 12px; align-items: center; }
        .table.head { color: #9aa8d1; font-size: 13px; padding: 0 8px; text-transform: uppercase; letter-spacing: .08em; margin-top: 14px; }
        .table.row { padding: 14px 12px; margin-top: 10px; border-radius: 16px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .three { grid-template-columns: 1.8fr 1fr .8fr; }
        .four { grid-template-columns: 1.8fr 1fr .8fr .8fr; }
        .empty { margin-top: 14px; color: #b7c3e8; }
        .uploadHint p { color: #c6d0f5; line-height: 1.6; }
        @media (max-width: 1100px) { .hero, .statsGrid { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .table.head { display: none; } .table.row, .three, .four { grid-template-columns: 1fr; gap: 8px; } }
        @media (max-width: 780px) { .shell { width: min(100% - 18px, 100%); padding-top: 18px; } .hero, .panel, .statCard { padding: 18px; border-radius: 22px; } .heroLeft { align-items: flex-start; } h1 { font-size: 42px; } }
      `}</style>
    </main>
  );
}
