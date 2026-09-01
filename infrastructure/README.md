# HookTrap AWS Infrastructure

This directory contains AWS serverless deployment configurations for HookTrap.

## Architecture Options

### Option A: Fully Serverless (Lambda + API Gateway)

- **Compute**: AWS Lambda with Mangum adapter (FastAPI on Lambda)
- **API**: Amazon HTTP API Gateway
- **Database**: Aurora Serverless v2 (PostgreSQL 15)
- **Cache**: ElastiCache Serverless (Redis)
- **Template**: `template.yaml`

Best for: low-to-moderate traffic, cost optimization at low scale, zero idle compute cost.

### Option B: App Runner

- **Compute**: AWS App Runner (container-based)
- **Database**: Aurora Serverless v2 (PostgreSQL 15)
- **Cache**: ElastiCache Serverless (Redis)
- **Template**: `apprunner.yaml`

Best for: steady traffic, WebSocket support, simpler container model, no cold starts.

## Prerequisites

- **AWS CLI** v2 configured with appropriate credentials
- **AWS SAM CLI** >= 1.100.0
- **Docker** (for building container images)
- **Node.js** >= 18 (for frontend build)
- **Python** >= 3.12 (for backend)
- An AWS account with permissions for: Lambda, API Gateway, App Runner, RDS, ElastiCache, VPC, IAM, Secrets Manager, ECR, CloudFormation

## Quick Start

### Option A: Lambda (Fully Serverless)

```bash
cd infrastructure

# Deploy with defaults
./deploy.sh --option-a

# Deploy to staging
./deploy.sh --option-a --env staging

# Deploy and run migrations
./deploy.sh --option-a --migrate
```

### Option B: App Runner

```bash
cd infrastructure

# Deploy with defaults
./deploy.sh --option-b

# Deploy to a specific region
./deploy.sh --option-b --region eu-west-1
```

### Frontend (Amplify)

1. Connect your repository to AWS Amplify Console.
2. Amplify will auto-detect the `amplify.yml` build spec.
3. Set the following environment variables in Amplify Console:
   - `NEXT_PUBLIC_API_URL` - Your backend API URL (from stack outputs)
   - `NEXT_PUBLIC_WS_URL` - WebSocket URL (App Runner only)
   - `NEXT_PUBLIC_APP_NAME` - `HookTrap`

## Environment Variables

The SAM templates accept these parameters (set via `--parameter-overrides` or in `samconfig.toml`):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `Environment` | `production` | `production` or `staging` |
| `FrontendBaseUrl` | `https://mocklane.com` | Frontend URL (CORS) |
| `ApiBaseUrl` | `https://api.mocklane.com` | Backend API URL |
| `SendGridApiKey` | (empty) | SendGrid API key |
| `SendGridFromEmail` | `noreply@mocklane.com` | Sender email |
| `SentryDsn` | (empty) | Sentry DSN |
| `AuroraMinCapacity` | `0.5` | Min Aurora ACUs |
| `AuroraMaxCapacity` | `4` | Max Aurora ACUs |

App Runner additionally accepts:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `EcrImageUri` | (required) | ECR image URI |
| `AppRunnerCpu` | `1024` | CPU units (1024 = 1 vCPU) |
| `AppRunnerMemory` | `2048` | Memory in MB |

## Custom Domain Setup

### API (Option A - API Gateway)

1. Create an ACM certificate in the deployment region for your API domain.
2. Add a custom domain in API Gateway Console:
   ```bash
   aws apigatewayv2 create-domain-name \
       --domain-name api.mocklane.com \
       --domain-name-configurations CertificateArn=arn:aws:acm:...
   ```
3. Create an API mapping to your HTTP API stage.
4. Add a CNAME/ALIAS record in your DNS provider pointing to the API Gateway domain.

### API (Option B - App Runner)

1. Create an ACM certificate in `us-east-1` for your API domain.
2. Associate the custom domain in App Runner Console or via CLI:
   ```bash
   aws apprunner associate-custom-domain \
       --service-arn <service-arn> \
       --domain-name api.mocklane.com
   ```
3. Add the CNAME records provided by App Runner to your DNS.

### Frontend (Amplify)

1. In Amplify Console, go to Domain Management.
2. Add your domain and follow the DNS verification steps.

## CI/CD with CodeBuild

The `buildspec.yml` file configures AWS CodeBuild to:

1. Install Python and Node.js dependencies.
2. Run backend tests and frontend linting.
3. Build and push the Docker image to ECR.
4. Deploy the SAM stack.

To set up:

1. Create a CodeBuild project pointing to your repository.
2. Use the `aws/codebuild/amazonlinux2-x86_64-standard:5.0` image.
3. Enable Docker (privileged mode) for container builds.
4. Set the `ENVIRONMENT` environment variable.
5. Ensure the CodeBuild service role has permissions for ECR, SAM, CloudFormation, and all resources in the templates.

## Monitoring

### CloudWatch

- Lambda logs: `/aws/lambda/hooktrap-{environment}-api` (30-day retention)
- App Runner logs: Available in App Runner Console
- Aurora metrics: CPU, connections, ACU utilization in CloudWatch
- Redis metrics: Available via ElastiCache CloudWatch metrics

### Recommended Alarms

```bash
# Lambda errors
aws cloudwatch put-metric-alarm \
    --alarm-name hooktrap-lambda-errors \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value=hooktrap-production-api \
    --evaluation-periods 1

# Aurora CPU
aws cloudwatch put-metric-alarm \
    --alarm-name hooktrap-aurora-cpu \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBClusterIdentifier,Value=hooktrap-production-cluster \
    --evaluation-periods 2
```

### Sentry

Set the `SentryDsn` parameter to enable error tracking. The FastAPI app already integrates with `sentry-sdk[fastapi]`.

## Cost Optimization

### Option A (Lambda)

- **Lambda**: Pay only for invocations. Free tier includes 1M requests/month.
- **API Gateway**: $1/million requests for HTTP APIs.
- **Aurora**: Set `AuroraMinCapacity` to `0.5` (pauses after inactivity on v2). ~$43/month at minimum.
- **ElastiCache Serverless**: Scales to zero data storage charges when empty.
- **NAT Gateway**: ~$32/month + data transfer. This is often the largest fixed cost. Consider VPC endpoints for AWS services to reduce NAT traffic.

**Estimated monthly cost at low traffic**: $80-120/month (dominated by NAT Gateway + Aurora minimum).

### Option B (App Runner)

- **App Runner**: Minimum 1 instance (~$7/month at 0.25 vCPU provisioned). Active instances ~$40/month at 1 vCPU/2 GB.
- **Aurora + ElastiCache**: Same as Option A.
- **No NAT Gateway needed** for outbound internet (App Runner handles it), but VPC connector egress still uses NAT for private subnet resources.

**Estimated monthly cost at low traffic**: $90-140/month.

### Tips

- Use `staging` environment with lower ACU limits for dev/test.
- Enable Aurora auto-pause if traffic has predictable idle periods.
- Monitor and right-size App Runner CPU/memory after observing real usage.
- Use CloudWatch Logs Insights instead of third-party log aggregators.
- Consider reserved capacity for Aurora if running 24/7 in production.

## Scaling Considerations

### Lambda Limits

- Default concurrent executions: 1,000 per region (request increase if needed).
- Payload size: 6 MB (request) / 6 MB (response) for API Gateway.
- Timeout: 30 seconds (configurable up to 15 minutes, but API Gateway has a 30-second hard limit).
- Cold starts: ~1-3 seconds for Python. Use provisioned concurrency for latency-sensitive workloads.

### App Runner Scaling

- Auto-scales 1-25 instances by default (configurable).
- Scale based on concurrent requests per instance (default: 100).
- No cold start penalty for warm instances.

### Aurora Serverless v2

- Scales in 0.5 ACU increments.
- Scale-up is fast (~30 seconds); scale-down is gradual.
- Connection pooling recommended (use PgBouncer or RDS Proxy for high-concurrency Lambda).

### WebSocket Support

- **Option A (Lambda)**: HTTP API Gateway supports WebSocket via a separate WebSocket API. Requires additional configuration not included in this template.
- **Option B (App Runner)**: Supports WebSocket natively. Preferred if your app relies heavily on real-time features.

## Database Migrations

The FastAPI lifespan handler runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on startup. For more complex migrations:

1. Use a bastion host or AWS Systems Manager Session Manager to connect to the VPC.
2. Run Alembic migrations from within the VPC:
   ```bash
   # From a bastion host with VPC access
   cd backend
   DATABASE_URL="postgresql+asyncpg://user:pass@aurora-endpoint:5432/hooktrap" \
       alembic upgrade head
   ```

## File Reference

| File | Purpose |
|------|---------|
| `template.yaml` | SAM template for Option A (Lambda) |
| `apprunner.yaml` | SAM template for Option B (App Runner) |
| `deploy.sh` | Deployment script with CLI flags |
| `buildspec.yml` | AWS CodeBuild CI/CD spec |
| `amplify.yml` | AWS Amplify build spec for Next.js frontend |
