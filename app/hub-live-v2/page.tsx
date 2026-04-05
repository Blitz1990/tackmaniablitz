'use client';

import { useEffect, useMemo, useState } from 'react';

const SHEET_ID = '1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Stammdaten_Pro`;
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbyhOps49-_YQTKIFAQ49qKGDafcW1v-XkvrkAk6te9q7U6NewGM8Bud_F5adVxxRiYhSw/exec';

function parseCsv(text: string) {
  return text.split('\n').map(r => r.split(','));
}

function toMs(v: string) {
  if (!v) return Infinity;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? Infinity : n * 1000;
}

export default function Page() {
  const [data, setData] = useState<any[]>([]);

  const load = async () => {
    const res = await fetch(CSV_URL);
    const txt = await res.text();
    const rows = parseCsv(txt);

    const parsed = rows.slice(1).map((r: any, i: number) => {
      const category = r[0];
      const map = r[1];
      const player = r[2];
      const time = r[3];
      return {
        id: i,
        track: `${category} #${map}`,
        player,
        time,
        ms: toMs(time)
      };
    }).filter((r: any) => r.player && isFinite(r.ms));

    setData(parsed);
  };

  useEffect(() => { load(); }, []);

  const records = useMemo(() => {
    const map = new Map();
    data.forEach(r => {
      if (!map.has(r.track) || r.ms < map.get(r.track).ms) {
        map.set(r.track, r);
      }
    });
    return Array.from(map.values());
  }, [data]);

  return (
    <div style={{padding:20,color:'white'}}>
      <h1>LIVE FIXED</h1>
      {records.map((r:any)=> (
        <div key={r.id}>
          {r.track} → {r.player} → {r.time}
        </div>
      ))}
    </div>
  );
}
