export default function Home() {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?usp=sharing";

  const embedUrl =
    "https://docs.google.com/spreadsheets/d/1usH7uwODTUGOq4EsI3QKJ5L4Hjcf7M90tzemwZk5JWc/edit?rm=minimal";

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        background: "#0b0f19",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Interaktive Tabelle</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          Google-Sheet als Web-App eingebunden.
        </p>

        <div style={{ marginBottom: 16 }}>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Tabelle direkt öffnen
          </a>
        </div>

        <div
          style={{
            width: "100%",
            height: "80vh",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#111827",
          }}
        >
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            allowFullScreen
          />
        </div>
      </div>
    </main>
  );
}
