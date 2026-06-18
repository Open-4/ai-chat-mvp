export default function PricingPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#faf8f6",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", padding: "20px", gap: "16px",
    }}>
      <h1 style={{ fontSize: "24px", color: "#302d2a" }}>💳 Pricing</h1>
      <p style={{ color: "#a3998e" }}>Free & Pro plans — PayPal sandbox test</p>
      <a href="/" style={{
        padding: "10px 24px", background: "#65c3a9", color: "#fff",
        borderRadius: "16px", textDecoration: "none",
      }}>← Home</a>
    </div>
  );
}
