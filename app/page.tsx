import { listMessages, type Message } from "@/lib/db";
import { createMessage } from "./actions";

export const dynamic = "force-dynamic";

const region = process.env.APP_REGION ?? "local";
const regionColor =
  region === "azure" ? "#0ea5e9" : region === "aws" ? "#f59e0b" : "#64748b";

export default async function HomePage() {
  let messages: Message[] = [];
  let dbError: string | null = null;

  try {
    messages = await listMessages(10);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Unknown database error";
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px" }}>
      <div
        style={{
          display: "inline-block",
          padding: "6px 14px",
          borderRadius: 999,
          background: regionColor,
          color: "#08111f",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        served from: {region}
      </div>

      <h1 style={{ fontSize: 32, margin: "18px 0 8px" }}>Cloud Failover Demo</h1>
      <p style={{ color: "#9aa7c2", marginTop: 0, lineHeight: 1.6 }}>
        Next.js + PostgreSQL. Azure App Service is primary; AWS is the secondary region. The badge
        above tells you which deployment answered this request.
      </p>

      <section
        style={{
          marginTop: 28,
          padding: 22,
          borderRadius: 14,
          background: "#121a33",
          border: "1px solid #1f2a4a",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Write a message</h2>
        <p style={{ color: "#9aa7c2", fontSize: 14 }}>
          This writes to PostgreSQL, so it must still work after a failover.
        </p>
        <form action={createMessage} style={{ display: "grid", gap: 10 }}>
          <input
            name="name"
            placeholder="Your name"
            required
            maxLength={80}
            style={inputStyle}
          />
          <textarea
            name="body"
            placeholder="Your message"
            required
            maxLength={500}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <button
            type="submit"
            style={{
              justifySelf: "start",
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#3b82f6",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save to database
          </button>
        </form>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>Latest messages</h2>

        {dbError ? (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: "#3b1220",
              border: "1px solid #7f1d3a",
              color: "#fecdd3",
              fontSize: 14,
            }}
          >
            Database not reachable: {dbError}
            <br />
            Set <code>DATABASE_URL</code> in .env.local (see README).
          </div>
        ) : messages.length === 0 ? (
          <p style={{ color: "#9aa7c2" }}>No messages yet — add the first one.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {messages.map((message) => (
              <li
                key={message.id}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: "#121a33",
                  border: "1px solid #1f2a4a",
                }}
              >
                <div style={{ fontWeight: 600 }}>{message.name}</div>
                <div style={{ color: "#c7d2e5", marginTop: 4 }}>{message.body}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                  {new Date(message.created_at).toISOString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ marginTop: 40, fontSize: 13, color: "#64748b" }}>
        Health check: <a href="/api/health" style={{ color: "#60a5fa" }}>/api/health</a>
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2b3a61",
  background: "#0b1226",
  color: "#e8ecf6",
  fontSize: 14,
  boxSizing: "border-box",
};
