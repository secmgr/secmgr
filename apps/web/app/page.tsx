export default function HomePage() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: "var(--space-24)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ font: "var(--type-display)", letterSpacing: "var(--tracking-display)", margin: 0 }}>secmgr</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-12)" }}>
          The open source secret manager for teams.
        </p>
      </div>
    </main>
  );
}
