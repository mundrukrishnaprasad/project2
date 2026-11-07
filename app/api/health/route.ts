import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database = "down";
  let databaseError: string | null = null;

  try {
    database = (await pingDatabase()) ? "up" : "down";
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "unknown error";
  }

  const healthy = database === "up";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      region: process.env.APP_REGION ?? "local",
      deployment: process.env.APP_DEPLOYMENT ?? "local",
      version: process.env.APP_VERSION ?? "dev",
      database,
      databaseError,
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
