import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-panel">
        <p className="eyebrow">GuitarCanvas</p>
        <h1>AI Guitar Pickguard Visualizer</h1>
        <p>
          Upload your guitar photo, try custom pickguard designs, and export
          printable design files.
        </p>
        <Link className="primary-link" href="/pickguard-visualizer">
          Open visualizer
        </Link>
      </section>
    </main>
  );
}
