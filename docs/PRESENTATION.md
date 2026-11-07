# 5–10 minute presentation script (English)

**0:00–0:40 — Problem and scope**
"I built a small full-stack application — Next.js, a Node runtime, and PostgreSQL — and
deployed it to Azure as the primary and AWS as the secondary, behind one hostname, with
automated failover under five minutes and GitHub Actions CI/CD. The goal was to prove
independent execution, not to build a large product."

**0:40–2:00 — Architecture**
Show the diagram. "Traffic Manager answers DNS for `app.example.com`. It health-checks
`/api/health` on both origins every ten seconds and routes to priority 1 — Azure — while
healthy. The database is a single managed PostgreSQL instance shared by both clouds, so a
write before failover is visible after failover. That is a deliberate trade-off: it removes
replication complexity but makes the database a single point of failure; I document it
rather than hide it."

**2:00–3:00 — Application**
"The badge shows `served from: azure`. The form posts through a server action and inserts
into PostgreSQL; the list reads the latest ten rows. `/api/health` returns status, region,
deployment, database state, uptime, and latency."

**3:00–5:00 — Failover demo**
Play the recording. "I started a poll every ten seconds, stopped the Azure app, and the same
hostname began returning `region: aws` after __ seconds. Then I submitted a message through
the AWS deployment and confirmed the row was written to the shared database."

**5:00–6:30 — CI/CD**
"Two workflows: `ci.yml` typechecks and builds on every push; `deploy.yml` deploys Azure,
then AWS, then runs a post-deploy health check. Authentication uses OIDC, so there are no
long-lived cloud keys in the repository. If the health check fails, the job fails and the
previous release stays live — on Azure I use deployment slots and swap back."

**6:30–8:00 — Trade-offs and limitations**
"Known limitations: single database without cross-region replication; App Service cold start
is included in my failover measurement; the demo form has no authentication because it is
out of scope; AWS runs on App Runner rather than ECS to keep the operational surface small.
Next improvements: read replica with promotion, WAF in front of Traffic Manager, and
end-to-end tests in CI."

**8:00–9:00 — Q&A and live change**
Be ready to make a small live change (for example, change the page heading or add a field),
push it, and show the pipeline deploying it.
