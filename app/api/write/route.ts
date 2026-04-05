const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhOps49-_YQTKIFAQ49qKGDafcW1v-XkvrkAk6te9q7U6NewGM8Bud_F5adVxxRiYhSw/exec';

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json),
    });

    const text = await response.text();

    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500 }
    );
  }
}