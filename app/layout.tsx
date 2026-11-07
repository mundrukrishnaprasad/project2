import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "VEGAH Round 2 — Cloud Failover Assessment",
  description: "Next.js + PostgreSQL on Azure (primary) with AWS (secondary) and automated failover.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0b1020",
          color: "#e8ecf6",
        }}
      >
        {children}
      </body>
    </html>
  );
}
