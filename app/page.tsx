'use client';

import { useState } from 'react';

export default function Home() {
  const [players, setPlayers] = useState(['Schaller','Oli','Manu','Nico','Marc']);
  const [times, setTimes] = useState<any[]>([]);

  return (
    <main style={{
      minHeight:'100vh',
      background:'#050816',
      color:'white',
      fontFamily:'Arial',
      padding:20
    }}>
      <h1 style={{fontSize:40}}>🏁 Trackmania Leaderboard</h1>

      <button onClick={()=>alert('Hier kommt später Sheet Integration')}>
        ➕ Neue Zeit
      </button>

      <button onClick={()=>alert('Spieler hinzufügen kommt')}>
        ➕ Spieler
      </button>

      <h2>Spieler</h2>
      {players.map(p=>(
        <div key={p}>{p}</div>
      ))}

      <h2>Zeiten</h2>
      {times.length === 0 && <p>Noch keine Zeiten</p>}
    </main>
  );
}
