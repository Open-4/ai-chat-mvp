export default function ChatPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#faf8f6",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", padding: "20px", gap: "16px",
    }}>
      <h1 style={{ fontSize: "24px", color: "#302d2a" }}>💬 Chat</h1>
      <p style={{ color: "#a3998e" }}>
        AI Companion chat — SSE streaming, emotion detection, KV persistence
      </p>
      <a href="/" style={{
        padding: "10px 24px", background: "#65c3a9", color: "#fff",
        borderRadius: "16px", textDecoration: "none",
      }}>← Home</a>
    </div>
  );
}
