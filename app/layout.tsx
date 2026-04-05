export const metadata = {
  title: "Google Sheet Web App",
  description: "Interaktive Tabelle als Webseite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
