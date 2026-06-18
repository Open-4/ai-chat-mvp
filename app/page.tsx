export default function HomePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf8f6",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "20px",
    }}>
      <h1 style={{ fontSize: "28px", color: "#302d2a", marginBottom: "8px" }}>
        🌿 AI Companion
      </h1>
      <p style={{ color: "#a3998e", marginBottom: "40px" }}>
        Your gentle healing partner
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        maxWidth: "480px",
        width: "100%",
        marginBottom: "32px",
      }}>
        {[
          { emoji: "😊", label: "Happy", bg: "#f2faf7" },
          { emoji: "😌", label: "Calm", bg: "#f2f8fd" },
          { emoji: "😰", label: "Anxious", bg: "#fdf4f2" },
          { emoji: "😢", label: "Low", bg: "#f5f1ed" },
          { emoji: "😤", label: "Irritable", bg: "#f2faf7" },
          { emoji: "😶", label: "Confused", bg: "#e3f1fa" },
        ].map((e) => (
          <a
            key={e.label}
            href="/chat"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "20px 12px",
              background: e.bg,
              borderRadius: "16px",
              textDecoration: "none",
              color: "#302d2a",
              border: "1px solid #ebe4dd",
            }}
          >
            <span style={{ fontSize: "28px" }}>{e.emoji}</span>
            <span style={{ fontSize: "14px", fontWeight: 500 }}>{e.label}</span>
          </a>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        maxWidth: "480px",
        width: "100%",
      }}>
        {[
          { icon: "🌿", title: "Breathing", desc: "4-4-6 guide", href: "/tools" },
          { icon: "📝", title: "Journal", desc: "Daily reflection", href: "/journal" },
          { icon: "🧘", title: "Mindfulness", desc: "Be present", href: "/chat" },
        ].map((t) => (
          <a
            key={t.title}
            href={t.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px",
              background: "#fff",
              borderRadius: "16px",
              textDecoration: "none",
              color: "#302d2a",
              border: "1px solid #ebe4dd",
              boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
            }}
          >
            <span style={{ fontSize: "24px" }}>{t.icon}</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500 }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#a3998e" }}>{t.desc}</div>
            </div>
          </a>
        ))}
      </div>

      <nav style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid #ebe4dd",
        maxWidth: "480px",
        margin: "0 auto",
      }}>
        {[
          { label: "Chat", href: "/chat" },
          { label: "Tools", href: "/tools" },
          { label: "History", href: "/history" },
          { label: "Pricing", href: "/pricing" },
        ].map((n) => (
          <a
            key={n.label}
            href={n.href}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#a3998e",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            {n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
