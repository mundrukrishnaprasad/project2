# Architecture

## 1. Goal

Demonstrate independent delivery of a multi-cloud web application with automated
failover, measurable recovery time, and CI/CD — in the smallest honest implementation.

## 2. Components

| Component | Choice | Why |
|---|---|---|
| Frontend + backend | Next.js (App Router) | One deployable unit; Node runtime satisfies "Node.js backend"; server actions remove the need for a separate API layer |
| Database | PostgreSQL (Neon) | Managed, TLS, free tier; accessible from both clouds |
| Primary | Azure App Service (Linux, Node 22) | Explicitly required |
| Secondary | AWS App Runner | Container-based, no cluster to manage, equivalent to App Service |
| Traffic | Azure Traffic Manager, priority routing | One hostname, health-probe driven, works across clouds |
| CI/CD | GitHub Actions + OIDC | No long-lived cloud secrets |

## 3. Request flow

1. Browser hits `https://app.example.com`.
2. Traffic Manager resolves the hostname to the highest-priority healthy endpoint.
3. Azure App Service serves the request, `APP_REGION=azure` renders in the badge.
4. Server action writes to PostgreSQL; the page re-reads the latest rows.

## 4. Failover design

```
Traffic Manager profile (priority)
  endpoint 1: azure-app.azurewebsites.net      priority 1   probe /api/health (10s, 3 fails)
  endpoint 2: aws-apprunner.example.com        priority 2   probe /api/health
```

- Probe: HTTP GET `/api/health`, expecting `200`.
- `interval = 10s`, `timeout = 5s`, `tolerated failures = 3` → detection in ~30s.
- DNS TTL = 30s → client re-resolution within half a minute.
- Measured target: **< 2 minutes** end-to-end, hard budget **< 5 minutes**.

Traffic Manager is used instead of a load balancer because it needs no cross-cloud
network peering, no BGP, and no shared VPC — only DNS.

## 5. Database trade-off

Both deployments use the **same** PostgreSQL instance.

- **Pro:** writes survive failover, no replication lag, one schema, trivially consistent.
- **Con:** the database is a single point of failure. If the DB region fails, both clouds fail.
- **Mitigation:** document the limitation, note that managed Postgres offers PITR and
  automated backups, and propose (do not implement) read replicas plus a promotion step.

This is explicitly acceptable per the assessment: *"Database replication is optional;
document any limitations."*

## 6. Failure modes

| Failure | Behaviour |
|---|---|
| Azure app stopped / crashed | Traffic Manager probe fails → traffic to AWS in < 2 min |
| Azure region outage | Same as above (probe fails) |
| AWS down while Azure healthy | No impact — AWS is priority 2 |
| Database down | Both deployments return `503` from `/api/health`; Traffic Manager sees unhealthy and has no healthy endpoint |
| Bad deploy to Azure | GitHub Actions health check fails → job fails → previous slot/release restored (see RUNBOOK §6) |

## 7. Security

- No secrets in the repo; `.env*` ignored.
- Azure: federated credential (OIDC) for the GitHub repo, scoped to the resource group.
- AWS: GitHub OIDC provider + IAM role trust limited to `repo:<owner>/<repo>:ref:refs/heads/main`.
- TLS everywhere; DB connections use `sslmode=require`.
- No authentication on the demo form — out of scope, called out in the presentation.
