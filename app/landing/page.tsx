'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <main
      onClick={() => router.push('/hub-elite-esports')}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#000',
      }}
    >
      <img
        src="/3d9d279a-1acc-4f73-bf80-6ead3019e17f.jpeg"
        alt="Zosch Racing"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </main>
  );
}