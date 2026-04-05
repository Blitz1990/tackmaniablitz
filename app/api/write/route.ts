const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhOps49-_YQTKIFAQ49qKGDafcW1v-XkvrkAk6te9q7U6NewGM8Bud_F5adVxxRiYhSw/exec';

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body,
      redirect: 'follow',
    });

    const text = await response.text();

    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
