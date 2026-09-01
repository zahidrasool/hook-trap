# MockLane — AWS deployment (Terraform)

Single-instance deployment optimised for low cost. Everything runs as Docker
containers on one EC2 host: Caddy (TLS), the Next.js frontend, the FastAPI
backend with its SMTP listener, Postgres, and Redis.

## Cost

| Item | Monthly (us-east-1) |
| --- | --- |
| EC2 `t4g.small` on-demand | ~$12.26 |
| EBS 30 GB gp3 | ~$2.40 |
| Public IPv4 address | ~$3.65 |
| Route53 hosted zone | $0.50 |
| S3 backups + requests | ~$0.50 |
| SSM Parameter Store (standard) | $0.00 |
| **Total** | **~$19.30/mo** |

Set `use_spot_instance = true` to drop the compute line to ~$4 (~$11/mo total).
Spot suits pre-launch validation; AWS can reclaim the instance with two minutes'
notice, so switch it off before you take paying customers.

For comparison, the managed equivalent (ALB + NLB + NAT Gateway + 2× Fargate +
RDS + ElastiCache) runs about **$121/mo**. See *Scaling up* below for when that
becomes worth paying.

### Why not App Runner or Lambda

Both expose exactly one HTTP port. The sandbox inbox needs to accept raw TCP on
port 25 from external mail servers, which neither supports — the feature would
be dead on arrival. The pre-existing `apprunner.yaml` and `template.yaml` in the
parent directory are superseded by this stack.

## What gets created

- VPC with a single public subnet (no NAT Gateway — saves ~$33/mo)
- One EC2 instance with an Elastic IP, encrypted gp3 root volume, IMDSv2 enforced
- Security group opening 80, 443 and 25; SSH closed by default
- SSM Parameter Store entries for all configuration
- S3 bucket for nightly `pg_dump`, versioned, IA after 7 days, expiring at 30
- IAM role granting only SSM read, S3 backup write, and Session Manager
- Route53 hosted zone and all records: apex, `www`, `api`, `inbox`, the SPF TXT,
  and — critically — the **`MX` for `inbox.<domain>`**, which is what makes
  inbound email work. Requires delegating from GoDaddy; see step 1.

TLS certificates are issued automatically by Caddy via Let's Encrypt, so there
is no ACM certificate and no load balancer to pay for.

## Prerequisites

- Terraform >= 1.5, AWS CLI configured with credentials
- `mocklane.com` registered at GoDaddy, with access to change its nameservers
- A verified SendGrid sender and API key

## Deploy

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform plan      # review carefully — this creates billable resources
terraform apply
```

### 1. Delegate DNS from GoDaddy to Route53

Terraform created the hosted zone and every record — apex, `www`, `api`, the
`inbox` A record, the **MX** that inbound mail depends on, and the SPF TXT.
They will not take effect until GoDaddy delegates to Route53.

> **Check this first.** Delegation moves *all* DNS for `mocklane.com` to
> Route53. Any record that exists at GoDaddy but not in this Terraform will
> stop resolving — most importantly, **if you receive business email at
> `@mocklane.com`** (Microsoft 365, Google Workspace, GoDaddy email), its MX
> and verification records must be added here first or that mail will bounce.
> Review the current zone at GoDaddy before switching. Note the apex MX for
> your business mail is a different record from the `inbox` MX this stack
> creates; both can coexist.

Get the four nameservers:

```bash
terraform output nameservers
```

In GoDaddy: **My Products → Domain → Domain Settings → Nameservers → Change →
"I'll use my own nameservers"**, then enter all four. Drop any trailing dot.

Verify delegation has taken effect (usually minutes, occasionally up to 48h):

```bash
dig +short NS mocklane.com          # should return the awsdns servers
dig +short MX inbox.mocklane.com    # should return "10 inbox.mocklane.com"
```

Wait for that before hitting the site. Caddy requests certificates on first
request, and if the name does not yet resolve, Let's Encrypt rate-limits the
failure and backs off.

**Adding records later** — put them in `dns.tf` and re-apply, rather than
clicking them into the console, so the zone stays reproducible. The SendGrid
DKIM CNAMEs from step 2 are the first ones you will need.

**Fallback:** set `manage_dns = false` to keep DNS at GoDaddy instead;
`terraform output godaddy_dns_records` then prints the six records to enter by
hand. Saves $0.50/mo at the cost of hand-maintaining the MX record.

### 2. Populate secrets

Terraform seeds placeholders so nothing real is stored in state or git. Replace
them (the exact commands are printed by `terraform output set_secrets_commands`):

```bash
aws ssm put-parameter --name /mocklane-production/SENDGRID_API_KEY \
  --value 'SG.xxxx' --type SecureString --overwrite --region us-east-1
```

Repeat for `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET`.

### 3. Deploy the application

If you set `app_repo_url`, the host cloned and built on first boot. Otherwise:

```bash
aws ssm start-session --target $(terraform output -raw instance_id)

sudo git clone <your-repo> /opt/mocklane/src
sudo cp /opt/mocklane/src/docker-compose.prod.yml /opt/mocklane/
sudo mocklane-env          # pull config from SSM into /opt/mocklane/.env
sudo systemctl start mocklane
```

To ship a new version afterwards:

```bash
cd /opt/mocklane/src && sudo git pull
sudo systemctl restart mocklane
```

### 4. Verify

```bash
curl -I https://mocklane.com
curl https://api.mocklane.com/health

# Inbound mail — the check that matters for sandbox inboxes
dig +short MX inbox.mocklane.com
nc -zv inbox.mocklane.com 25
```

Then create a sandbox in the dashboard and send it a message from a real Gmail
account. It should appear in the inbox within seconds.

## Email notes

**Inbound (sandbox inboxes)** works out of the box. AWS restricts *outbound*
port 25, not inbound, so no support ticket is required.

**Outbound (magic links)** goes through the SendGrid HTTP API, which also
sidesteps the port 25 restriction entirely. Complete SendGrid's *Sender
Authentication* flow and add the DKIM CNAMEs it gives you — there is a
commented placeholder in `dns.tf`. Without them, login emails land in spam.

An SPF record of `v=spf1 -all` is published for `inbox.<domain>` because nothing
should ever send *as* that subdomain; it only receives.

## Operations

```bash
# Shell in (no SSH port, no key)
aws ssm start-session --target $(terraform output -raw instance_id)

# Logs
sudo docker compose -f /opt/mocklane/docker-compose.prod.yml logs -f backend

# Manual backup
sudo /usr/local/bin/mocklane-backup

# Restore
aws s3 cp s3://<bucket>/postgres/mocklane-<stamp>.sql.gz .
gunzip -c mocklane-<stamp>.sql.gz | \
  sudo docker exec -i mocklane-postgres psql -U mocklane mocklane
```

Backups run nightly at 03:30 UTC via cron. **Test a restore before you rely on
it** — an untested backup is not a backup.

## Trade-offs you are accepting

This is a deliberate cost-first design. Be clear-eyed about what it gives up:

- **Single point of failure.** Instance or AZ loss means downtime until it is
  replaced. Data survives on the EBS volume (`delete_on_termination = false`).
- **Brief downtime on deploy.** `systemctl restart` stops and starts containers;
  expect a few seconds. No blue/green.
- **Self-managed Postgres.** No automated failover or point-in-time recovery —
  only the nightly dump. Recovery point objective is up to 24 hours.
- **Builds on the host.** `next build` on a 2 GB instance relies on the 2 GB
  swap file the bootstrap creates. Move to `t4g.medium` if builds are slow.

All are reasonable pre-revenue. None are reasonable at scale.

## Scaling up

Roughly in the order the pain arrives:

1. **Managed Postgres** — move to RDS (~$12/mo) for automated backups and PITR.
   This is the first thing worth paying for; it removes the scariest failure mode.
2. **Bigger instance** — `t4g.medium`/`large` handles a lot of traffic. Vertical
   scaling is far cheaper than going distributed.
3. **ALB + multiple app instances** — once uptime during deploys matters. Keep
   SMTP on a dedicated instance with the Elastic IP, since mail reputation is
   tied to the IP.
4. **Split SMTP from HTTP** — only when email volume justifies its own host.

Do not start at step 3. The single instance will carry you further than expected.
