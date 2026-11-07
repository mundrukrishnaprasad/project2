# Runbook — build, deploy, fail over, clean up

> Assumes: Azure CLI (`az`), AWS CLI (`aws`), Docker, and `gh` are installed and logged in.
> Replace `example.com`, `rg-vegah`, and IDs with your own values.

## 0. Prerequisites

```bash
npm install
cp .env.example .env.local
# set DATABASE_URL (Neon pooled connection string)
npm run dev
curl localhost:3000/api/health
```

Create the shared database once:

```sql
-- automatically created by the app on first request
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 1. Azure App Service (primary)

```bash
RG=rg-vegah
APP=vegah-primary
PLAN=plan-vegah

az group create -n $RG -l centralindia
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1

az webapp create -g $RG -p $PLAN -n $APP \
  --runtime "NODE:22-lts"

az webapp config appsettings set -g $RG -n $APP --settings \
  APP_REGION=azure \
  APP_DEPLOYMENT=azure-app-service \
  APP_VERSION=1.0.0 \
  DATABASE_URL="postgresql://...@.../neondb?sslmode=require" \
  DATABASE_SSL=true \
  WEBSITES_PORT=8080 \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true

az webapp config set -g $RG -n $APP --always-on true
```

Deploy the artefact (see §5 for the CI path):

```bash
npm ci && npm run build
# Next.js standalone output — zip the standalone folder for a manual smoke deploy
```

Test: `curl https://$APP.azurewebsites.net/api/health` → `"region":"azure"`.

---

## 2. AWS App Runner (secondary)

```bash
AWS_REGION=ap-south-1
ECR=vegah-secondary
aws ecr create-repository --repository-name $ECR --region $AWS_REGION

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.$AWS_REGION.amazonaws.com

docker build -t $ECR .
docker tag $ECR:latest <account-id>.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR:latest
docker push <account-id>.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR:latest
```

Create the App Runner service from that image (console or CLI), with environment variables:

```
APP_REGION=aws
APP_DEPLOYMENT=aws-app-runner
APP_VERSION=1.0.0
DATABASE_URL=<same Neon URL>
DATABASE_SSL=true
PORT=8080
```

Health check path: `/api/health`, interval 10s, timeout 5s, unhealthy threshold 3.

Test: `curl https://<service-id>.<region>.awsapprunner.com/api/health` → `"region":"aws"`.

---

## 3. Traffic Manager (single hostname + failover)

```bash
TM=vegah-tm
az network traffic-manager profile create -g $RG -n $TM \
  --routing-method Priority --unique-dns-name vegah-demo \
  --ttl 30 --protocol HTTP --port 80 --path /api/health \
  --interval 10 --timeout 5 --max-failures 3

# Azure endpoint (priority 1)
az network traffic-manager endpoint create -g $RG --profile-name $TM \
  -n azure-primary --type azureEndpoints \
  --target-resource-id $(az webapp show -g $RG -n $APP --query id -o tsv) \
  --priority 1

# AWS endpoint (priority 2) — external endpoint, HTTPS
az network traffic-manager endpoint create -g $RG --profile-name $TM \
  -n aws-secondary --type externalEndpoints \
  --target "<service-id>.<region>.awsapprunner.com" \
  --endpoint-status Enabled --priority 2
```

Custom domain: add a CNAME `app.example.com → vegah-demo.trafficmanager.net` at your DNS
provider. Enable HTTPS on both origins; Traffic Manager is DNS-only and does not terminate TLS.

---

## 4. Failover test and evidence

```bash
while true; do
  printf "%s  " "$(date -u +%H:%M:%S)"
  curl -s https://app.example.com/api/health | jq -c '{region,status,database}'
  sleep 10
done
```

1. Start the loop → expect `azure`.
2. `az webapp stop -g $RG -n $APP` → record the timestamp.
3. Watch the loop flip to `aws` → record the timestamp. **Elapsed = failover time**.
4. Open the UI through the same hostname and submit a message → confirm it appears.
5. Save screenshots and a screen recording in `docs/evidence/`.
6. Restart Azure: `az webapp start -g $RG -n $APP` → traffic returns to priority 1.

Record the measured time in `docs/TIME_LOG.md`.

---

## 5. GitHub Actions OIDC

**Azure** — app registration + federated credential:

```bash
az ad app create --display-name gh-vegah
az ad sp create --id <appId>
az role assignment create --assignee <appId> --role Contributor \
  --scope /subscriptions/<sub>/resourceGroups/rg-vegah

az ad app federated-credential create --id <appId> --parameters '{
  "name":"github-main",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:<owner>/project2:ref:refs/heads/main",
  "audiences":["api://AzureADTokenExchange"]
}'
```

Repository secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

**AWS** — OIDC provider + role trusting `repo:<owner>/project2:ref:refs/heads/main`,
permissions: `ecr:*` (scoped), `apprunner:*` (scoped), `iam:PassRole`.

Repository secret: `AWS_DEPLOY_ROLE_ARN`.

Enable deploys: repository **variable** `ENABLE_DEPLOY=true`.

---

## 6. Rollback

- **Azure:** App Service deployment slots — deploy to `staging`, swap only after
  `/api/health` returns 200 on staging. Swap back = instant rollback.
- **AWS:** App Runner keeps previous revisions — redeploy the last healthy image tag.
- **Workflow:** the deploy job fails when the post-deploy health check fails, so a bad
  build never reaches users.

---

## 7. Cleanup (do this after the assessment)

```bash
az group delete -n rg-vegah --yes --no-wait
aws apprunner delete-service --service-arn <arn> --region ap-south-1
aws ecr delete-repository --repository-name vegah-secondary --force --region ap-south-1
# Neon: delete the project from the console
```

Record the actual spend in `docs/TIME_LOG.md`.
