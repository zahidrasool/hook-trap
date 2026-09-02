# ─────────────────────────────────────────────────────────────────────────────
# Configuration lives in SSM Parameter Store rather than Secrets Manager:
# standard parameters are free, Secrets Manager is $0.40 per secret per month.
#
# Terraform generates the values that belong to this stack. Third-party keys are
# seeded with a placeholder and then set out of band, so real credentials never
# enter Terraform state or version control.
# ─────────────────────────────────────────────────────────────────────────────

resource "random_password" "app_secret_key" {
  length  = 64
  special = false
}

resource "random_password" "postgres" {
  length           = 32
  special          = true
  override_special = "-_=+"
}

locals {
  postgres_password = var.postgres_password != "" ? var.postgres_password : random_password.postgres.result
}

resource "aws_ssm_parameter" "secret_key" {
  name  = "/${local.name}/SECRET_KEY"
  type  = "SecureString"
  value = random_password.app_secret_key.result
}

resource "aws_ssm_parameter" "postgres_password" {
  name  = "/${local.name}/POSTGRES_PASSWORD"
  type  = "SecureString"
  value = local.postgres_password
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${local.name}/DATABASE_URL"
  type  = "SecureString"
  value = "postgresql+asyncpg://mocklane:${urlencode(local.postgres_password)}@postgres:5432/mocklane"
}

# ── Third-party keys: populate with `aws ssm put-parameter --overwrite` ──────

locals {
  external_params = [
    "SENDGRID_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]
}

resource "aws_ssm_parameter" "external" {
  for_each = toset(local.external_params)

  name  = "/${local.name}/${each.value}"
  type  = "SecureString"
  value = "REPLACE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

# ── Non-secret settings ──────────────────────────────────────────────────────

resource "aws_ssm_parameter" "plain" {
  for_each = {
    ENVIRONMENT          = "production"
    API_BASE_URL         = "https://${local.api_domain}"
    FRONTEND_BASE_URL    = "https://${var.domain_name}"
    SMTP_SERVER_HOST     = "0.0.0.0"
    SMTP_SERVER_PORT     = "2525"
    SMTP_SERVER_HOSTNAME = local.inbox_domain
    SENDGRID_FROM_EMAIL  = var.sendgrid_from_email
    EMAIL_PROVIDER       = var.email_provider
    EMAIL_FROM_ADDRESS   = var.sendgrid_from_email
    AWS_REGION           = var.aws_region
    REDIS_URL            = "redis://redis:6379"
    RATE_LIMIT_ENABLED   = "true"
    NEXT_PUBLIC_API_URL  = "https://${local.api_domain}"
    NEXT_PUBLIC_APP_NAME = "MockLane"
  }

  name  = "/${local.name}/${each.key}"
  type  = "String"
  value = each.value
}
