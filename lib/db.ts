import { Pool } from "pg";

export type Message = {
  id: number;
  name: string;
  body: string;
  created_at: string;
};

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS messages (
           id BIGSERIAL PRIMARY KEY,
           name TEXT NOT NULL,
           body TEXT NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function listMessages(limit = 10): Promise<Message[]> {
  await ensureSchema();
  const { rows } = await getPool().query<Message>(
    `SELECT id, name, body, created_at
       FROM messages
      ORDER BY id DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function addMessage(name: string, body: string): Promise<void> {
  await ensureSchema();
  await getPool().query(`INSERT INTO messages (name, body) VALUES ($1, $2)`, [name, body]);
}

export async function pingDatabase(): Promise<boolean> {
  const { rows } = await getPool().query<{ ok: number }>("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
