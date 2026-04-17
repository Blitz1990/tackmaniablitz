'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;
const WRITE_URL = '/api/write';
const LOCAL_TRACKS_KEY = 'trackmania-custom-tracks-v1';
const DEFAULT_PLAYERS = ['Marc', 'Oli', 'Schaller', 'Nico', 'Manu', 'test'];
const DEFAULT_CATEGORIES = ['1mpi', '2mpi', '3mpi', '4mpi'];

const AVATARS: Record<string, string> = {
  Marc: '',
  Oli: '',
  Schaller: '',
  Nico: '',
  Manu: '',
  test: '',
};

type Run = {
  id: string;
  category: string;
  map: string;
  track: string;
  player: string;
  timeText: string;
  timeMs: number;
  source: string;
};

type RankingRow = {
  player: string;
  points: number;
  records: number;
  entries: number;
  avgGap: number;
  podiums: number;
  winRate: number;
  elo: number;
  eloDelta: number;
};

type TrackOption = {
  category: string;
  map: string;
  track: string;
  source?: string;
};

type SubmitState = {
  player: string;
  category: string;
  map: string;
  time: string;
  note: string;
};

type NewTrackState = {
  category: string;
  map: string;
  note: string;
};

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
  return headers.findIndex((h) => candidates.includes(normalizeHeader(h)));
}

function parseNumber(value: string): number {
  const v = (value || '').trim().replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeTimeInput(value: string): string {
  const normalized = value.trim().replace(',', '.');
  const n = parseNumber(normalized);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Bitte eine gültige Zeit eingeben, z. B. 17.603');
  }

  return normalized;
}

function toMs(value: string): number {
  const v = (value || '').trim().replace(',', '.');
  if (!v) return Number.POSITIVE_INFINITY;

  if (/^\d+(\.\d+)?$/.test(v)) {
    return Math.round(parseFloat(v) * 1000);
  }

  const parts = v.split(':').map((p) => p.trim());
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) {
      return Math.round(mins * 60000 + secs * 1000);
    }
  }

  return Number.POSITIVE_INFINITY;
}

function formatGap(ms: number) {
  if (!Number.isFinite(ms)) return '-';
  return ms === 0 ? 'WR' : `+${(ms / 1000).toFixed(3)}s`;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function buildTrack(category: string, map: string) {
  return `${category} #${map}`;
}

function buildKey(category: string, map: string, player: string) {
  return `${category.trim()}|${map.trim()}|${player.trim()}`;
}

function trackExists(trackOptions: TrackOption[], category: string, map: string) {
  return trackOptions.some(
    (track) =>
      track.category.trim().toLowerCase() === category.trim().toLowerCase() &&
      track.map.trim().toLowerCase() === map.trim().toLowerCase()
  );
}

function loadLocalTracks(): TrackOption[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_TRACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.category === 'string' && typeof item.map === 'string')
      .map((item) => ({
        category: item.category.trim(),
        map: item.map.trim(),
        track: buildTrack(item.category, item.map),
        source: 'Local',
      }));
  } catch {
    return [];
  }
}

function saveLocalTracks(tracks: TrackOption[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_TRACKS_KEY, JSON.stringify(tracks));
}

function Avatar({ name }: { name: string }) {
  const url = AVATARS[name];
  if (url) return <img src={url} alt={name} className="avatar" />;
  return <div className="avatar fallback">{initials(name)}</div>;
}

function parseRunsFromCsv(csv: string): Run[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const categoryIdx = firstMatch(headers, ['kategorie']);
  const mapIdx = firstMatch(headers, ['map']);
  const playerIdx = firstMatch(headers, ['spieler']);
  const timeIdx = firstMatch(headers, ['zeit']);
  const sourceIdx = firstMatch(headers, ['quelle']);

  return rows
    .slice(1)
    .map((row, i) => {
      const category = (categoryIdx >= 0 ? row[categoryIdx] : '').trim();
      const map = (mapIdx >= 0 ? row[mapIdx] : '').trim();
      const player = (playerIdx >= 0 ? row[playerIdx] : '').trim();
      const timeText = (timeIdx >= 0 ? row[timeIdx] : '').trim();
      const source = (sourceIdx >= 0 ? row[sourceIdx] : '').trim();

      return {
        id: `${i}-${category}-${map}-${player}-${timeText}`,
        category,
        map,
        track: buildTrack(category, map),
        player,
        timeText,
        timeMs: toMs(timeText),
        source,
      };
    })
    .filter(
      (run) =>
        !!run.category &&
        !!run.map &&
        !!run.player &&
        Number.isFinite(run.timeMs) &&
        run.timeMs < Number.POSITIVE_INFINITY
    );
}

export default function Page() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [trackSearch, setTrackSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [status, setStatus] = useState('');
  const [trackStatus, setTrackStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTrack, setIsCreatingTrack] = useState(false);
  const [localTracks, setLocalTracks] = useState<TrackOption[]>([]);
  const [newTime, setNewTime] = useState<SubmitState>({
    player: '',
    category: '',
    map: '',
    time: '',
    note: '',
  });
  const [newTrack, setNewTrack] = useState<NewTrackState>({
    category: '',
    map: '',
    note: '',
  });

  const loadRuns = async () => {
    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      const txt = await res.text();
      const parsed = parseRunsFromCsv(txt);
      setRuns(parsed);

      setNewTime((v) => ({
        ...v,
        player: v.player || parsed[0]?.player || DEFAULT_PLAYERS[0],
        category: v.category || parsed[0]?.category || DEFAULT_CATEGORIES[0],
      }));
    } catch {
      setNewTime((v) => ({
        ...v,
        player: v.player || DEFAULT_PLAYERS[0],
        category: v.category || DEFAULT_CATEGORIES[0],
      }));
    }
  };

  useEffect(() => {
    setLocalTracks(loadLocalTracks());
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const players = useMemo(() => {
    const values = new Set([...DEFAULT_PLAYERS, ...runs.map((r) => r.player).filter(Boolean)]);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [runs]);

  const trackOptions = useMemo<TrackOption[]>(() => {
    const combined = new Map<string, TrackOption>();

    runs.forEach((r) => {
      combined.set(buildTrack(r.category, r.map), {
        category: r.category,
        map: r.map,
        track: buildTrack(r.category, r.map),
        source: r.source || 'Sheet',
      });
    });

    localTracks.forEach((track) => {
      if (!combined.has(track.track)) {
        combined.set(track.track, track);
      }
    });

    return Array.from(combined.values()).sort((a, b) => a.track.localeCompare(b.track));
  }, [runs, localTracks]);

  const categories = useMemo(() => {
    const values = new Set([...DEFAULT_CATEGORIES, ...trackOptions.map((t) => t.category).filter(Boolean)]);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [trackOptions]);

  const mapsForSelectedCategory = useMemo(
    () =>
      trackOptions
        .filter((t) => !newTime.category || t.category === newTime.category)
        .map((t) => t.map),
    [trackOptions, newTime.category]
  );

  const bestRuns = useMemo(() => {
    const best = new Map<string, Run>();

    for (const run of runs) {
      const key = `${run.category}|${run.map}|${run.player}`;
      const current = best.get(key);

      if (!current || run.timeMs < current.timeMs) {
        best.set(key, run);
      }
    }

    return Array.from(best.values());
  }, [runs]);

  const groupedByTrack = useMemo(() => {
    const map = new Map<string, Run[]>();

    for (const run of bestRuns) {
      const arr = map.get(run.track) || [];
      arr.push(run);
      map.set(run.track, arr);
    }

    for (const [track, arr] of Array.from(map.entries())) {
      arr.sort((a, b) => a.timeMs - b.timeMs);
      map.set(track, arr);
    }

    return map;
  }, [bestRuns]);

  const podiumByTrack = useMemo(
    () =>
      Array.from(groupedByTrack.entries())
        .map(([track, arr]) => ({ track, top3: arr.slice(0, 3) }))
        .sort((a, b) => a.track.localeCompare(b.track)),
    [groupedByTrack]
  );

  const recordsByTrack = useMemo(
    () => podiumByTrack.map((p) => p.top3[0]).filter(Boolean),
    [podiumByTrack]
  );

  const eloMap = useMemo(() => {
    const ratings = new Map<string, number>();
    const deltas = new Map<string, number>();

    players.forEach((p) => {
      ratings.set(p, 1000);
      deltas.set(p, 0);
    });

    const K = 24;
    const orderedTracks = Array.from(groupedByTrack.keys()).sort((a, b) => a.localeCompare(b));

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
    const pointTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    groupedByTrack.forEach((arr) => {
      const wr = arr[0]?.timeMs ?? Infinity;

      arr.forEach((run, idx) => {
        const row =
          score.get(run.player) || {
            player: run.player,
            points: 0,
            records: 0,
            entries: 0,
            avgGap: 0,
            podiums: 0,
            winRate: 0,
            elo: 1000,
            eloDelta: 0,
          };

        row.entries += 1;
        row.avgGap += run.timeMs - wr;

        if (idx === 0) row.records += 1;
        if (idx < 3) row.podiums += 1;

        row.points += pointTable[idx] || 0;

        score.set(run.player, row);
      });
    });

    return Array.from(score.values())
      .map((row) => ({
        ...row,
        avgGap: row.entries ? row.avgGap / row.entries : Infinity,
        winRate: row.entries ? (row.records / row.entries) * 100 : 0,
        elo: Math.round(eloMap.ratings.get(row.player) || 1000),
        eloDelta: Math.round(eloMap.deltas.get(row.player) || 0),
      }))
      .sort((a, b) => b.points - a.points || b.elo - a.elo || b.records - a.records || a.avgGap - b.avgGap);
  }, [groupedByTrack, eloMap]);

  const filteredRecords = useMemo(
    () =>
      recordsByTrack.filter(
        (r) =>
          r &&
          (!trackSearch || r.track.toLowerCase().includes(trackSearch.toLowerCase())) &&
          (!playerFilter || r.player === playerFilter)
      ),
    [recordsByTrack, trackSearch, playerFilter]
  );

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 12),
    [runs]
  );

  const submitTime = async () => {
    try {
      if (!newTime.player || !newTime.category || !newTime.map || !newTime.time) {
        setStatus('Bitte Spieler, Kategorie, Map und Zeit ausfüllen.');
        return;
      }

      const normalizedTime = normalizeTimeInput(newTime.time);
      const track = buildTrack(newTime.category, newTime.map);

      setIsSaving(true);
      setStatus('Speichere Zeit…');

      const payload = {
        player: newTime.player.trim(),
        category: newTime.category.trim(),
        map: newTime.map.trim(),
        track,
        time: normalizedTime,
        key: buildKey(newTime.category, newTime.map, newTime.player),
        source: 'WebApp',
        note: newTime.note.trim(),
      };

      const res = await fetch(WRITE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'time', payload }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Speichern fehlgeschlagen.');
      }

      setStatus('Gespeichert. Daten werden neu geladen…');
      setNewTime((v) => ({ ...v, map: '', time: '', note: '' }));
      setTimeout(() => loadRuns(), 900);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitTrack = async () => {
    try {
      if (!newTrack.category || !newTrack.map) {
        setTrackStatus('Bitte Kategorie und Map für die neue Strecke ausfüllen.');
        return;
      }

      if (trackExists(trackOptions, newTrack.category, newTrack.map)) {
        setTrackStatus('Diese Strecke existiert bereits.');
        return;
      }

      setIsCreatingTrack(true);
      setTrackStatus('Lege neue Strecke an…');

      const createdTrack: TrackOption = {
        category: newTrack.category.trim(),
        map: newTrack.map.trim(),
        track: buildTrack(newTrack.category, newTrack.map),
        source: 'Local',
      };

      const nextLocalTracks = [...localTracks, createdTrack];
      setLocalTracks(nextLocalTracks);
      saveLocalTracks(nextLocalTracks);

      setNewTime((v) => ({
        ...v,
        category: createdTrack.category,
        map: createdTrack.map,
      }));

      let remoteSaved = false;

      try {
        const payload = {
          category: createdTrack.category,
          map: createdTrack.map,
          track: createdTrack.track,
          source: 'WebApp',
          note: newTrack.note.trim(),
        };

        const res = await fetch(WRITE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'track', payload }),
        });

        const data = await res.json().catch(() => ({}));
        remoteSaved = res.ok && data?.ok !== false;
      } catch {
        remoteSaved = false;
      }

      setTrackStatus(
        remoteSaved
          ? 'Neue Strecke angelegt und an den Server gesendet.'
          : 'Neue Strecke lokal angelegt. Falls sie bei anderen nicht erscheint, muss das Apps Script noch track-Einträge verarbeiten.'
      );

      setNewTrack({ category: '', map: '', note: '' });
      setTimeout(() => loadRuns(), 900);
    } catch (error) {
      setTrackStatus(error instanceof Error ? error.message : 'Strecke anlegen fehlgeschlagen.');
    } finally {
      setIsCreatingTrack(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero heroSingle">
        <div>
          <div className="eyebrow">TRACKMANIA ELITE E-SPORTS</div>
          <h1>Neue Zeiten und Strecken direkt auf der Seite</h1>
          <p className="sub">
            Kategorie, Spieler und Strecke funktionieren jetzt robust mit Vorschlagslisten und Fallback-Werten. Auch wenn das Sheet mal unvollständig lädt, kannst du weiterarbeiten.
          </p>

          <div className="dualForms">
            <div className="card formCard">
              <div className="eyebrow">ZEIT EINTRAGEN</div>
              <h2>Neue Zeit speichern</h2>
              <div className="actions compact">
                <input
                  list="category-list-time"
                  value={newTime.category}
                  onChange={(e) => setNewTime((v) => ({ ...v, category: e.target.value, map: '' }))}
                  placeholder="Kategorie wählen oder eingeben"
                />
                <datalist id="category-list-time">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>

                <input
                  list="map-list-elite-esports"
                  value={newTime.map}
                  onChange={(e) => setNewTime((v) => ({ ...v, map: e.target.value }))}
                  placeholder="Strecke / Map wählen oder eingeben"
                />
                <datalist id="map-list-elite-esports">
                  {mapsForSelectedCategory.map((map) => (
                    <option key={map} value={map} />
                  ))}
                </datalist>

                <input
                  list="player-list-time"
                  value={newTime.player}
                  onChange={(e) => setNewTime((v) => ({ ...v, player: e.target.value }))}
                  placeholder="Spieler wählen oder eingeben"
                />
                <datalist id="player-list-time">
                  {players.map((player) => (
                    <option key={player} value={player} />
                  ))}
                </datalist>

                <input
                  value={newTime.time}
                  onChange={(e) => setNewTime((v) => ({ ...v, time: e.target.value }))}
                  placeholder="Zeit z. B. 17.603"
                />

                <input
                  value={newTime.note}
                  onChange={(e) => setNewTime((v) => ({ ...v, note: e.target.value }))}
                  placeholder="Notiz optional"
                />

                <button className="btn primary" onClick={submitTime} disabled={isSaving}>
                  {isSaving ? 'Speichert…' : 'Neue Zeit speichern'}
                </button>
              </div>

              {status ? <div className="info">{status}</div> : null}
            </div>

            <div className="card formCard">
              <div className="eyebrow">STRECKE ANLEGEN</div>
              <h2>Neue Strecke hinzufügen</h2>
              <div className="actions compact">
                <input
                  list="category-list-track"
                  value={newTrack.category}
                  onChange={(e) => setNewTrack((v) => ({ ...v, category: e.target.value }))}
                  placeholder="Kategorie z. B. 1mpi"
                />
                <datalist id="category-list-track">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>

                <input
                  value={newTrack.map}
                  onChange={(e) => setNewTrack((v) => ({ ...v, map: e.target.value }))}
                  placeholder="Map z. B. 12"
                />

                <input
                  value={newTrack.note}
                  onChange={(e) => setNewTrack((v) => ({ ...v, note: e.target.value }))}
                  placeholder="Notiz optional"
                />

                <button className="btn primary" onClick={submitTrack} disabled={isCreatingTrack}>
                  {isCreatingTrack ? 'Legt an…' : 'Neue Strecke anlegen'}
                </button>

                <a className="btn ghost" href={SHEET_URL} target="_blank" rel="noreferrer">
                  Google Sheet öffnen
                </a>
              </div>

              {trackStatus ? <div className="info">{trackStatus}</div> : null}
            </div>
          </div>

          <div className="statsTop">
            <div className="stat"><span>Spieler</span><strong>{players.length}</strong><small>aktive Fahrer</small></div>
            <div className="stat"><span>Strecken</span><strong>{trackOptions.length}</strong><small>bekannte Tracks gesamt</small></div>
            <div className="stat"><span>Top ELO</span><strong>{ranking[0]?.elo || 1000}</strong><small>{ranking[0]?.player || '-'}</small></div>
            <div className="stat"><span>Top Fahrer</span><strong>{ranking[0]?.player || '-'}</strong><small>{ranking[0]?.points || 0} Punkte</small></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><div className="eyebrow">GLOBAL RANKING + ELO</div><h2>Punktesystem pro Strecke</h2></div></div>
        <div className="rankingCards">
          {ranking.map((p, index) => (
            <div className="rankCard" key={p.player}>
              <div className="rankHeader">
                <div className="rankNumber">#{index + 1}</div>
                <div className="playerWrap"><Avatar name={p.player} /><div><div className="playerName">{p.player}</div><div className="playerSub">Competitive Overview</div></div></div>
              </div>
              <div className="statsList">
                <div className="statLine"><span className="label">Punkte</span><span className="value">{p.points}</span><span className="desc">Gesamtwertung</span></div>
                <div className="statLine"><span className="label">ELO</span><span className="value">{p.elo}</span><span className="desc">Skill Rating</span></div>
                <div className="statLine"><span className={`value ${p.eloDelta >= 0 ? 'good' : 'bad'}`}>{p.eloDelta >= 0 ? `+${p.eloDelta}` : p.eloDelta}</span><span className="label">Δ ELO</span><span className="desc">Veränderung</span></div>
                <div className="statLine"><span className="value">{p.records}</span><span className="label">WRs</span><span className="desc">#1 Platzierungen</span></div>
                <div className="statLine"><span className="value">{p.podiums}</span><span className="label">Podien</span><span className="desc">Top 3</span></div>
                <div className="statLine"><span className="value">{formatGap(p.avgGap)}</span><span className="label">Ø Gap</span><span className="desc">Abstand zum WR</span></div>
                <div className="statLine"><span className="value">{p.winRate.toFixed(1)}%</span><span className="label">Win-Rate</span><span className="desc">Wie oft #1</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">WR MAP</div><h2>Rekorde mit Filter</h2></div></div>
          <div className="filters">
            <input value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} placeholder="Strecke suchen…" />
            <input list="player-filter-list" value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} placeholder="Spieler filtern" />
            <datalist id="player-filter-list">
              {players.map((player) => <option key={player} value={player} />)}
            </datalist>
          </div>
          <div className="table head four"><span>Strecke</span><span>WR Fahrer</span><span>Zeit</span><span>Kategorie</span></div>
          {filteredRecords.map((r) => r ? (
            <div className="table row four" key={r.track}>
              <span>{r.track}</span>
              <span className="playerCell"><Avatar name={r.player} /><span>{r.player}</span></span>
              <strong>{r.timeText}</strong>
              <span>{r.category}</span>
            </div>
          ) : null)}
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">LETZTE EINTRÄGE</div><h2>Zuletzt geladene Runs</h2></div></div>
          <div className="table head four"><span>Strecke</span><span>Spieler</span><span>Zeit</span><span>Quelle</span></div>
          {recentRuns.map((run) => (
            <div className="table row four" key={run.id}>
              <span>{run.track}</span>
              <span className="playerCell"><Avatar name={run.player} /><span>{run.player}</span></span>
              <strong>{run.timeText}</strong>
              <span>{run.source || '-'}</span>
            </div>
          ))}
        </div>
      </section>

      <style jsx global>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; font-family: Inter, Arial, sans-serif; background: radial-gradient(circle at top, rgba(26, 80, 255, 0.22), transparent 26%), radial-gradient(circle at right, rgba(0, 224, 255, 0.16), transparent 20%), linear-gradient(180deg, #050816 0%, #07101f 100%); color: #f5f7ff; }
        a { text-decoration: none; color: inherit; }
        button, input { font: inherit; }
        .shell { width: min(1500px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
        .hero, .panel, .card { border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 15, 32, 0.78); backdrop-filter: blur(16px); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32); border-radius: 28px; }
        .hero { display: grid; grid-template-columns: 1fr; gap: 24px; padding: 28px; }
        .dualForms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 22px; }
        .formCard { padding: 20px; }
        .eyebrow { margin: 0 0 8px; color: #75b7ff; font-size: 12px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
        h1 { margin: 0; font-size: clamp(38px, 6vw, 66px); line-height: 0.96; letter-spacing: -0.04em; }
        h2 { margin: 4px 0 0; }
        .sub { color: #c6d0f5; line-height: 1.6; }
        .actions, .filters { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 22px; }
        .actions.compact { margin-top: 16px; }
        .actions input, .filters input { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: white; border-radius: 14px; padding: 14px; outline: none; min-width: 190px; flex: 1 1 220px; }
        .btn { border-radius: 14px; padding: 14px 18px; border: 0; cursor: pointer; }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .primary { background: linear-gradient(135deg, #0077ff, #00d4ff); color: #fff; font-weight: 800; }
        .ghost { background: transparent; border: 1px solid rgba(255, 255, 255, 0.12); color: #dbe4ff; }
        .statsTop { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
        .stat { padding: 18px; border-radius: 18px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); }
        .stat span, .stat small { color: #aeb8d8; }
        .stat strong { display: block; font-size: 30px; margin: 8px 0 4px; }
        .panel { padding: 22px; margin-top: 20px; }
        .panel-head { display: flex; justify-content: space-between; align-items: center; }
        .rankingCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 18px; }
        .rankCard { padding: 18px; border-radius: 20px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); }
        .rankHeader { display: flex; flex-direction: column; gap: 14px; margin-bottom: 14px; }
        .rankNumber { font-size: 28px; font-weight: 900; }
        .playerWrap, .playerCell { display: flex; align-items: center; gap: 12px; }
        .playerName { font-size: 22px; font-weight: 800; }
        .playerSub { color: #aeb8d8; font-size: 13px; }
        .statsList { display: grid; gap: 10px; }
        .statLine { display: grid; grid-template-columns: 90px 1fr 1fr; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); }
        .statLine .label { color: #9fb0df; font-weight: 700; }
        .statLine .value { font-weight: 900; font-size: 20px; }
        .statLine .desc { color: #aeb8d8; font-size: 13px; text-align: right; }
        .table { display: grid; gap: 12px; align-items: center; }
        .table.head { color: #9aa8d1; font-size: 13px; padding: 0 8px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 14px; }
        .table.row { padding: 14px 12px; margin-top: 10px; border-radius: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); }
        .four { grid-template-columns: 1.8fr 1fr 1fr 0.8fr; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.16); }
        .avatar.fallback { display: grid; place-items: center; background: linear-gradient(135deg, #1d4dff, #00cfff); font-weight: 900; }
        .info { margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(0, 212, 120, 0.12); border: 1px solid rgba(0, 212, 120, 0.2); color: #b8ffd8; }
        .good { color: #8df2c7; }
        .bad { color: #ff9f9f; }
        @media (max-width: 1180px) { .grid, .statsTop, .dualForms { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .table.head { display: none; } .table.row, .four { grid-template-columns: 1fr; gap: 8px; } .statLine { grid-template-columns: 1fr; text-align: left; } .statLine .desc { text-align: left; } }
        @media (max-width: 780px) { .shell { width: min(100% - 18px, 100%); padding-top: 18px; } .hero, .panel, .card { padding: 18px; border-radius: 22px; } h1 { font-size: 42px; } }
      `}</style>
    </main>
  );
}
