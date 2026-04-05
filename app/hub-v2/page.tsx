'use client';

import { useMemo, useState } from 'react';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?usp=sharing';
const EMBED_URL = 'https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?rm=minimal';

const PLAYERS = ['Schaller', 'Oli', 'Manu', 'Nico', 'Marc', 'test'];
const TRACK_OPTIONS = [
  '1mpi #1','1mpi #2','1mpi #3','1mpi #4','1mpi #5','1mpi #6','1mpi #7','1mpi #8','1mpi #9','1mpi #10',
  '1mpi #11','1mpi #12','1mpi #13','1mpi #14','1mpi #15','1mpi #16','1mpi #17','1mpi #18','1mpi #19','1mpi #20',
  '1mpi #21','1mpi #22','1mpi #23','1mpi #24','1mpi #25','1mpi #26','1mpi #27','1mpi #28','1mpi #29','1mpi #30',
  'Kollegolas Maps #1','Kollegolas Maps #2','Kollegolas Maps #3','Kollegolas Maps #4','Kollegolas Maps #5','Kollegolas Maps #6',
  'Kollegolas Maps #7','Kollegolas Maps #8','Kollegolas Maps #9','Kollegolas Maps #10','Kollegolas Maps #11','Kollegolas Maps #20','Kollegolas Maps #88',
  'Dirt #1','DirtBike #1','Gras #1','Kurve #1','Kurve #2','Kurve #3','Stadium #4','Wiggle Maps + Kurven #99'
];

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; }) {
  if (!open) return null;
  return (
    <div className="tm-backdrop" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-row tm-space">
          <div>
            <div className="tm-eyebrow">TRACKMANIA HUB V2</div>
            <h3>{title}</h3>
          </div>
          <button className="tm-btn tm-btn-ghost" onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HubV2Page() {
  const [timeOpen, setTimeOpen] = useState(true);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [trackMode, setTrackMode] = useState<'existing' | 'new'>('existing');
  const [trackSearch, setTrackSearch] = useState('');
  const [newTrack, setNewTrack] = useState('');
  const [player, setPlayer] = useState('Marc');
  const [timeValue, setTimeValue] = useState('');
  const [note, setNote] = useState('');
  const [newPlayer, setNewPlayer] = useState({ name: '', clan: '', note: '' });

  const filteredTracks = useMemo(() => {
    const q = trackSearch.trim().toLowerCase();
    if (!q) return TRACK_OPTIONS;
    return TRACK_OPTIONS.filter((track) => track.toLowerCase().includes(q));
  }, [trackSearch]);

  const selectedTrack = trackMode === 'existing' ? trackSearch : newTrack;

  const timeDraft = useMemo(() => {
    return `Neue Zeit | Spieler: ${player} | Strecke: ${selectedTrack || '-'} | Zeit: ${timeValue || '-'} | Notiz: ${note || '-'}`;
  }, [player, selectedTrack, timeValue, note]);

  const playerDraft = useMemo(() => {
    return `Neuer Spieler | Name: ${newPlayer.name || '-'} | Clan: ${newPlayer.clan || '-'} | Notiz: ${newPlayer.note || '-'}`;
  }, [newPlayer]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      alert('In Zwischenablage kopiert');
    } catch {
      alert('Kopieren hat nicht geklappt');
    }
  };

  return (
    <main className="tm-shell">
      <section className="tm-hero">
        <div>
          <div className="tm-eyebrow">TRACKMANIA HUB V2</div>
          <h1>Intelligente Streckenwahl</h1>
          <p className="tm-sub">Du kannst jetzt eine bestehende Strecke aus der Tabellenstruktur suchen und auswählen oder eine komplett neue Strecke frei eintragen.</p>
          <div className="tm-actions">
            <button className="tm-btn tm-btn-primary" onClick={() => setTimeOpen(true)}>➕ Neue Zeit eintragen</button>
            <button className="tm-btn tm-btn-secondary" onClick={() => setPlayerOpen(true)}>👤 Spieler hinzufügen</button>
            <a className="tm-btn tm-btn-ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Tabelle öffnen</a>
          </div>
        </div>
        <div className="tm-card">
          <div className="tm-row tm-space"><span className="tm-pill">TRACK SOURCE</span><small>{TRACK_OPTIONS.length} vorhandene Strecken</small></div>
          <div className="tm-note" style={{marginTop:16}}>
            <strong>Aus der Tabelle erkannt</strong>
            <p>1mpi #1-#30, Kollegolas Maps #1-#11, #20 und #88, dazu Dirt #1, DirtBike #1, Gras #1, Kurve #1-#3, Stadium #4 und Wiggle Maps + Kurven #99.</p>
          </div>
        </div>
      </section>

      <section className="tm-panel tm-panel-large">
        <div className="tm-row tm-space"><div><div className="tm-eyebrow">INTEGRATED TABLE</div><h2>Google-Tabelle</h2></div><a href={SHEET_URL} target="_blank" rel="noreferrer">In neuem Tab öffnen</a></div>
        <div className="tm-frame"><iframe src={EMBED_URL} width="100%" height="100%" style={{ border: 'none' }} allowFullScreen title="Trackmania Sheet" /></div>
      </section>

      <Modal open={timeOpen} title="Neue Zeit eintragen" onClose={() => setTimeOpen(false)}>
        <div className="tm-form">
          <label>
            <span>Spieler</span>
            <select value={player} onChange={(e) => setPlayer(e.target.value)}>
              {PLAYERS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label>
            <span>Modus</span>
            <select value={trackMode} onChange={(e) => setTrackMode(e.target.value as 'existing' | 'new')}>
              <option value="existing">Bestehende Strecke suchen</option>
              <option value="new">Neue Strecke eintragen</option>
            </select>
          </label>

          {trackMode === 'existing' ? (
            <label className="full">
              <span>Strecke suchen / auswählen</span>
              <input
                list="track-options"
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                placeholder="z. B. 1mpi #29 oder Kurve #2"
              />
              <datalist id="track-options">
                {filteredTracks.map((track) => (
                  <option key={track} value={track} />
                ))}
              </datalist>
              <small className="tm-help">Suche nach Kategorie oder Nummer, z. B. 1mpi, Kollegolas, Kurve oder Dirt.</small>
            </label>
          ) : (
            <label className="full">
              <span>Neue Strecke frei eintragen</span>
              <input
                value={newTrack}
                onChange={(e) => setNewTrack(e.target.value)}
                placeholder="z. B. Neue Fullspeed Map #1"
              />
            </label>
          )}

          <label>
            <span>Zeit</span>
            <input value={timeValue} onChange={(e) => setTimeValue(e.target.value)} placeholder="00:48.114 oder 48.114" />
          </label>

          <label className="full">
            <span>Notiz</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="PB, safe run, risky line ..." />
          </label>
        </div>

        {trackMode === 'existing' && filteredTracks.length > 0 && (
          <div className="tm-track-list">
            {filteredTracks.slice(0, 12).map((track) => (
              <button key={track} className="tm-track-chip" onClick={() => setTrackSearch(track)}>
                {track}
              </button>
            ))}
          </div>
        )}

        <div className="tm-note"><code>{timeDraft}</code></div>
        <div className="tm-actions">
          <button className="tm-btn tm-btn-secondary" onClick={() => copyText(timeDraft)}>Entwurf kopieren</button>
          <a className="tm-btn tm-btn-primary" href={SHEET_URL} target="_blank" rel="noreferrer">Im Sheet eintragen</a>
        </div>
      </Modal>

      <Modal open={playerOpen} title="Spieler hinzufügen" onClose={() => setPlayerOpen(false)}>
        <div className="tm-form">
          <label><span>Spielername</span><input value={newPlayer.name} onChange={(e) => setNewPlayer((v) => ({ ...v, name: e.target.value }))} placeholder="z. B. Marc" /></label>
          <label><span>Clan / Tag</span><input value={newPlayer.clan} onChange={(e) => setNewPlayer((v) => ({ ...v, clan: e.target.value }))} placeholder="z. B. ZR" /></label>
          <label className="full"><span>Notiz</span><textarea value={newPlayer.note} onChange={(e) => setNewPlayer((v) => ({ ...v, note: e.target.value }))} placeholder="Rolle oder Zusatzinfo" /></label>
        </div>
        <div className="tm-note"><code>{playerDraft}</code></div>
        <div className="tm-actions">
          <button className="tm-btn tm-btn-secondary" onClick={() => copyText(playerDraft)}>Entwurf kopieren</button>
          <a className="tm-btn tm-btn-primary" href={SHEET_URL} target="_blank" rel="noreferrer">Im Sheet eintragen</a>
        </div>
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
        .tm-btn:hover, .tm-track-chip:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .tm-btn-primary { background: linear-gradient(135deg, #0077ff, #00d4ff); color: white; font-weight: 800; }
        .tm-btn-secondary { background: rgba(255,255,255,.08); color: white; font-weight: 700; border: 1px solid rgba(255,255,255,.14); }
        .tm-btn-ghost { color: #dbe4ff; background: transparent; border: 1px solid rgba(255,255,255,.12); }
        .tm-card, .tm-note, .tm-track-chip { border-radius: 18px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .tm-card { padding: 20px; background: linear-gradient(180deg, rgba(0,119,255,.16), rgba(255,255,255,.04)), rgba(255,255,255,.02); }
        .tm-row { display: flex; align-items: center; gap: 12px; }
        .tm-space { justify-content: space-between; }
        .tm-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.09); color: white; }
        .tm-panel { border-radius: 26px; padding: 22px; }
        .tm-panel-large { margin-top: 20px; }
        .tm-frame { margin-top: 16px; height: 78vh; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
        .tm-backdrop { position: fixed; inset: 0; padding: 22px; background: rgba(3,5,15,.74); display: grid; place-items: center; z-index: 1000; }
        .tm-modal { width: min(820px, 100%); border-radius: 24px; padding: 22px; background: #0c1227; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 90px rgba(0,0,0,.48); }
        .tm-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
        .tm-form label { display: grid; gap: 8px; color: #d8e0ff; font-weight: 600; }
        .tm-form .full { grid-column: 1 / -1; }
        .tm-form input, .tm-form textarea, .tm-form select { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: white; border-radius: 14px; padding: 14px; outline: none; }
        .tm-form textarea { min-height: 120px; resize: vertical; }
        .tm-help { color: #aeb8d8; font-size: 13px; font-weight: 500; }
        .tm-note { margin-top: 18px; padding: 18px; background: rgba(0,140,255,.1); border-color: rgba(125,207,255,.18); color: #dbe9ff; }
        .tm-track-list { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
        .tm-track-chip { padding: 10px 12px; color: white; cursor: pointer; }
        code { display: block; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.5; }
        @media (max-width: 900px) { .tm-hero, .tm-form { grid-template-columns: 1fr; } }
        @media (max-width: 720px) { .tm-shell { width: min(100% - 18px, 100%); padding-top: 18px; } .tm-hero, .tm-panel { padding: 18px; border-radius: 22px; } h1 { font-size: 42px; } .tm-frame { height: 68vh; } }
      `}</style>
    </main>
  );
}
