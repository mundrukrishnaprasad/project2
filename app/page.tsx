import { listMessages, type Message } from "@/lib/db";
import { createMessage } from "./actions";

export const dynamic = "force-dynamic";

const region = process.env.APP_REGION ?? "local";
const deployment = process.env.APP_DEPLOYMENT ?? "local";
const version = process.env.APP_VERSION ?? "dev";

function regionLabel(value: string): string {
  if (value === "azure") return "Azure App Service";
  if (value === "aws") return "AWS App Runner";
  return "Local development";
}

function formatDate(value: string): string {
  return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function HomePage() {
  let messages: Message[] = [];
  let dbError: string | null = null;

  try {
    messages = await listMessages(10);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Unknown database error";
  }

  return (
    <main className="page">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            CF
          </span>
          <span className="brand-name">Cloud Failover</span>
        </div>
        <span className="header-note">Azure / AWS</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Technical assessment — Round 2</p>
        <h1>
          One application.
          <br />
          Two clouds.
        </h1>
        <p className="lede">
          A small Next.js application backed by PostgreSQL, deployed to Azure App Service
          with AWS App Runner as the secondary region. Traffic Manager keeps a single
          hostname and redirects traffic when a health check fails.
        </p>

        <dl className="meta">
          <div className="meta-item">
            <dt>Served from</dt>
            <dd>
              <span className={`region region-${region}`}>{regionLabel(region)}</span>
            </dd>
          </div>
          <div className="meta-item">
            <dt>Database</dt>
            <dd>{dbError ? "Unavailable" : "PostgreSQL connected"}</dd>
          </div>
          <div className="meta-item">
            <dt>Health</dt>
            <dd>
              <a href="/api/health">/api/health</a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="block" aria-labelledby="write-heading">
        <div className="block-heading">
          <h2 id="write-heading">Write an entry</h2>
          <p>Stored in PostgreSQL so it survives a failover.</p>
        </div>

        <form action={createMessage} className="form">
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              placeholder="Your name"
              required
              maxLength={80}
              autoComplete="name"
            />
          </div>

          <div className="field">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              name="body"
              placeholder="Write something brief"
              required
              maxLength={500}
              rows={4}
            />
          </div>

          <div className="form-footer">
            <button type="submit">Save entry</button>
            <span className="form-note">Up to 500 characters</span>
          </div>
        </form>
      </section>

      <section className="block" aria-labelledby="entries-heading">
        <div className="block-heading">
          <h2 id="entries-heading">Recent entries</h2>
          <p>
            {messages.length} of the latest 10, newest first.
          </p>
        </div>

        {dbError ? (
          <div className="notice">
            <strong>Database unavailable.</strong> {dbError}
          </div>
        ) : messages.length === 0 ? (
          <p className="empty">No entries yet.</p>
        ) : (
          <ul className="entries">
            {messages.map((message) => (
              <li key={message.id} className="entry">
                <div className="entry-head">
                  <span className="entry-name">{message.name}</span>
                  <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                </div>
                <p className="entry-body">{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="site-footer">
        <span>
          {deployment} · v{version}
        </span>
        <span>Single hostname, priority routing, 30s DNS TTL.</span>
      </footer>
    </main>
  );
}
