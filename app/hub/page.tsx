'use client';

import { useMemo, useState } from 'react';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?usp=sharing';
const EMBED_URL = 'https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?rm=minimal';

const PLAYERS = [
  { name: 'Marc', role: 'Hunt Specialist', best: '00:47.882', tag: 'ZR' },
  { name: 'Oliver', role: 'Consistency Driver', best: '00:48.114', tag: 'OKB' },
  { name: 'Nico', role: 'Tech Driver', best: '00:48.391', tag: 'NXS' },
  { name: 'Schaller', role: 'Risk Taker', best: '00:48.774', tag: 'SHR' },
];

const RUNS = [
  { track: 'A01 Desert Line', player: 'Marc', time: '00:47.882', status: 'PB' },
  { track: 'Tech Velocity', player: 'Oliver', time: '00:48.114', status: 'Clean' },
  { track: 'ZR Ice Shift', player: 'Nico', time: '00:48.391', status: 'New' },
  { track: 'Sunset Fullspeed', player: 'Schaller', time: '00:48.774', status: 'Risky' },
];

function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; }) {
  if (!open) return null;
  return (
    <div className="tm-backdrop" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-row tm-space">
          <div>
            <div className="tm-eyebrow">TRACKMANIA HUB</div>
            <h3>{title}</h3>
          </div>
          <button className="tm-btn tm-btn-ghost" onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HubPage() {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [player, setPlayer] = useState({ name: '', clan: '', note: '' });
  const [time, setTime] = useState({ player: PLAYERS[0].name, track: '', value: '', note: '' });

  const playerDraft = useMemo(() => `Neuer Spieler | Name: ${player.name || '-'} | Clan: ${player.clan || '-'} | Notiz: ${player.note || '-'}`,[player]);
  const timeDraft = useMemo(() => `Neue Zeit | Spieler: ${time.player} | Strecke: ${time.track || '-'} | Zeit: ${time.value || '-'} | Notiz: ${time.note || '-'}`,[time]);

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
          <div className="tm-eyebrow">LIVE RACING HUB</div>
          <h1>Trackmania Blitz Hub</h1>
          <p className="tm-sub">Coole Oberfläche für Spieler, Rekorde, neue Zeiten und die integrierte Google-Tabelle. Schnell, mobil und direkt auf Vercel nutzbar.</p>
          <div className="tm-actions">
            <button className="tm-btn tm-btn-primary" onClick={() => setTimeOpen(true)}>➕ Neue Zeit eintragen</button>
            <button className="tm-btn tm-btn-secondary" onClick={() => setPlayerOpen(true)}>👤 Spieler hinzufügen</button>
            <a className="tm-btn tm-btn-ghost" href={SHEET_URL} target="_blank" rel="noreferrer">Tabelle öffnen</a>
          </div>
          <div className="tm-stats">
            <div className="tm-stat"><span>Spieler</span><strong>{PLAYERS.length}</strong><small>aktive Fahrer</small></div>
            <div className="tm-stat"><span>Bestzeit</span><strong>00:47.882</strong><small>Marc auf A01</small></div>
            <div className="tm-stat"><span>Runs</span><strong>128</strong><small>aktuelles Sheet</small></div>
            <div className="tm-stat"><span>Status</span><strong>LIVE</strong><small>bereit für Updates</small></div>
          </div>
        </div>
        <div className="tm-card">
          <div className="tm-row tm-space"><span className="tm-pill">TOP DRIVERS</span><small>Übersicht</small></div>
          <div className="tm-list">
            {PLAYERS.map((p, i) => (
              <div className="tm-player" key={p.name}>
                <div className="tm-rank">#{i + 1}</div>
                <div className="tm-grow"><strong>{p.name}</strong><span>{p.role}</span></div>
                <div className="tm-right"><strong>{p.best}</strong><small>{p.tag}</small></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-grid">
        <div className="tm-panel">
          <div className="tm-row tm-space"><div><div className="tm-eyebrow">RECENT RUNS</div><h2>Letzte Zeiten</h2></div><a href={SHEET_URL} target="_blank" rel="noreferrer">Alles ansehen</a></div>
          <div className="tm-table-head"><span>Strecke</span><span>Spieler</span><span>Zeit</span><span>Status</span></div>
          {RUNS.map((r) => (
            <div className="tm-table-row" key={r.track + r.player}>
              <span>{r.track}</span><span>{r.player}</span><strong>{r.time}</strong><span className="tm-pill tm-pill-soft">{r.status}</span>
            </div>
          ))}
        </div>
        <div className="tm-panel">
          <div className="tm-eyebrow">QUICK ACTIONS</div>
          <h2>Management</h2>
          <div className="tm-quick">
            <button className="tm-quick-card" onClick={() => setPlayerOpen(true)}><strong>Spieler hinzufügen</strong><small>neuen Fahrer vorbereiten</small></button>
            <button className="tm-quick-card" onClick={() => setTimeOpen(true)}><strong>Zeit eintragen</strong><small>neuen Run vorbereiten</small></button>
            <a className="tm-quick-card" href={SHEET_URL} target="_blank" rel="noreferrer"><strong>Sheet bearbeiten</strong><small>direkt in Google Sheets öffnen</small></a>
          </div>
          <div className="tm-note"><strong>Hinweis</strong><p>Die Oberfläche ist fertig. Echtes Schreiben direkt ins Sheet folgt sauber über Google-Sheets-API oder ein Formular-Backend.</p></div>
        </div>
      </section>

      <section className="tm-panel tm-panel-large">
        <div className="tm-row tm-space"><div><div className="tm-eyebrow">INTEGRATED TABLE</div><h2>Google-Tabelle</h2></div><a href={SHEET_URL} target="_blank" rel="noreferrer">In neuem Tab öffnen</a></div>
        <div className="tm-frame"><iframe src={EMBED_URL} width="100%" height="100%" style={{ border: 'none' }} allowFullScreen title="Trackmania Sheet" /></div>
      </section>

      <Modal open={playerOpen} title="Spieler hinzufügen" onClose={() => setPlayerOpen(false)}>
        <div className="tm-form">
          <label><span>Spielername</span><input value={player.name} onChange={(e) => setPlayer((v) => ({ ...v, name: e.target.value }))} placeholder="z. B. Marc" /></label>
          <label><span>Clan / Tag</span><input value={player.clan} onChange={(e) => setPlayer((v) => ({ ...v, clan: e.target.value }))} placeholder="z. B. ZR" /></label>
          <label className="full"><span>Notiz</span><textarea value={player.note} onChange={(e) => setPlayer((v) => ({ ...v, note: e.target.value }))} placeholder="Rolle oder Zusatzinfo" /></label>
        </div>
        <div className="tm-note"><code>{playerDraft}</code></div>
        <div className="tm-actions"><button className="tm-btn tm-btn-secondary" onClick={() => copyText(playerDraft)}>Entwurf kopieren</button><a className="tm-btn tm-btn-primary" href={SHEET_URL} target="_blank" rel="noreferrer">Im Sheet eintragen</a></div>
      </Modal>

      <Modal open={timeOpen} title="Neue Zeit eintragen" onClose={() => setTimeOpen(false)}>
        <div className="tm-form">
          <label><span>Spieler</span><select value={time.player} onChange={(e) => setTime((v) => ({ ...v, player: e.target.value }))}>{PLAYERS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
          <label><span>Strecke</span><input value={time.track} onChange={(e) => setTime((v) => ({ ...v, track: e.target.value }))} placeholder="z. B. Tech Velocity" /></label>
          <label><span>Zeit</span><input value={time.value} onChange={(e) => setTime((v) => ({ ...v, value: e.target.value }))} placeholder="00:48.114" /></label>
          <label className="full"><span>Notiz</span><textarea value={time.note} onChange={(e) => setTime((v) => ({ ...v, note: e.target.value }))} placeholder="PB, safe run, risky line ..." /></label>
        </div>
        <div className="tm-note"><code>{timeDraft}</code></div>
        <div className="tm-actions"><button className="tm-btn tm-btn-secondary" onClick={() => copyText(timeDraft)}>Entwurf kopieren</button><a className="tm-btn tm-btn-primary" href={SHEET_URL} target="_blank" rel="noreferrer">Im Sheet eintragen</a></div>
      </Modal>

      <style jsx global>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; font-family: Inter, Arial, sans-serif; background: radial-gradient(circle at top, rgba(26,80,255,.22), transparent 26%), radial-gradient(circle at right, rgba(0,224,255,.16), transparent 20%), linear-gradient(180deg, #050816 0%, #07101f 100%); color: #f5f7ff; }
        a { color: inherit; text-decoration: none; }
        button, input, textarea, select { font: inherit; }
        .tm-shell { width: min(1440px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
        .tm-hero, .tm-panel, .tm-modal { border: 1px solid rgba(255,255,255,.08); background: rgba(10,15,32,.78); backdrop-filter: blur(16px); box-shadow: 0 18px 50px rgba(0,0,0,.32); }
        .tm-hero { display: grid; grid-template-columns: 1.35fr .95fr; gap: 24px; border-radius: 28px; padding: 28px; }
        .tm-eyebrow { margin: 0 0 8px; color: #75b7ff; font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        h1 { margin: 0; font-size: clamp(40px, 6vw, 76px); line-height: .96; letter-spacing: -.04em; }
        h2, h3 { margin: 4px 0 0; }
        .tm-sub { max-width: 720px; color: #c6d0f5; font-size: 18px; line-height: 1.6; margin: 18px 0 0; }
        .tm-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        .tm-btn { border-radius: 14px; padding: 14px 18px; border: 0; cursor: pointer; transition: .18s ease; }
        .tm-btn:hover, .tm-quick-card:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .tm-btn-primary { background: linear-gradient(135deg, #0077ff, #00d4ff); color: white; font-weight: 800; }
        .tm-btn-secondary { background: rgba(255,255,255,.08); color: white; font-weight: 700; border: 1px solid rgba(255,255,255,.14); }
        .tm-btn-ghost { color: #dbe4ff; background: transparent; border: 1px solid rgba(255,255,255,.12); }
        .tm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 28px; }
        .tm-stat, .tm-card, .tm-note, .tm-quick-card, .tm-table-row { border-radius: 18px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
        .tm-stat { padding: 18px; }
        .tm-stat span, .tm-stat small, .tm-player span, .tm-right small, .tm-row small { color: #aeb8d8; }
        .tm-stat strong { display: block; font-size: 30px; margin: 8px 0 4px; letter-spacing: -.04em; }
        .tm-card { padding: 20px; background: linear-gradient(180deg, rgba(0,119,255,.16), rgba(255,255,255,.04)), rgba(255,255,255,.02); }
        .tm-row { display: flex; align-items: center; gap: 12px; }
        .tm-space { justify-content: space-between; }
        .tm-list, .tm-quick { display: grid; gap: 12px; margin-top: 18px; }
        .tm-player { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
        .tm-rank { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(135deg, #1d4dff, #00cfff); font-weight: 900; }
        .tm-grow { display: grid; flex: 1; }
        .tm-right { display: grid; text-align: right; font-weight: 700; }
        .tm-grid { display: grid; grid-template-columns: 1.35fr .85fr; gap: 20px; margin-top: 20px; }
        .tm-panel { border-radius: 26px; padding: 22px; }
        .tm-table-head, .tm-table-row { display: grid; grid-template-columns: 2fr 1fr 1fr .8fr; gap: 12px; align-items: center; }
        .tm-table-head { color: #9aa8d1; font-size: 13px; padding: 0 8px; text-transform: uppercase; letter-spacing: .08em; }
        .tm-table-row { padding: 14px 12px; margin-top: 10px; }
        .tm-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 800; background: rgba(255,255,255,.09); color: white; }
        .tm-pill-soft { background: rgba(0,212,255,.14); color: #8fe7ff; width: fit-content; }
        .tm-quick-card { text-align: left; padding: 18px; color: white; }
        .tm-quick-card small { display: block; margin-top: 4px; }
        .tm-note { margin-top: 18px; padding: 18px; background: rgba(0,140,255,.1); border-color: rgba(125,207,255,.18); color: #dbe9ff; }
        .tm-panel-large { margin-top: 20px; }
        .tm-frame { margin-top: 16px; height: 78vh; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
        .tm-backdrop { position: fixed; inset: 0; padding: 22px; background: rgba(3,5,15,.74); display: grid; place-items: center; z-index: 1000; }
        .tm-modal { width: min(760px, 100%); border-radius: 24px; padding: 22px; background: #0c1227; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 90px rgba(0,0,0,.48); }
        .tm-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
        .tm-form label { display: grid; gap: 8px; color: #d8e0ff; font-weight: 600; }
        .tm-form .full { grid-column: 1 / -1; }
        .tm-form input, .tm-form textarea, .tm-form select { width: 100%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: white; border-radius: 14px; padding: 14px; outline: none; }
        .tm-form textarea { min-height: 120px; resize: vertical; }
        code { display: block; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.5; }
        @media (max-width: 1080px) { .tm-hero, .tm-grid { grid-template-columns: 1fr; } .tm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 720px) { .tm-shell { width: min(100% - 18px, 100%); padding-top: 18px; } .tm-hero, .tm-panel { padding: 18px; border-radius: 22px; } .tm-stats, .tm-form { grid-template-columns: 1fr; } h1 { font-size: 42px; } .tm-table-head { display: none; } .tm-table-row { grid-template-columns: 1fr; gap: 8px; } .tm-frame { height: 68vh; } }
      `}</style>
    </main>
  );
}
