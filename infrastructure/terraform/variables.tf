variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name; used as a suffix on every resource."
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Apex domain. App served here, API at api.<domain>, mail received at inbox.<domain>."
  type        = string
  default     = "mocklane.com"
}

variable "manage_dns" {
  description = <<-EOT
    Whether Terraform manages DNS in Route53.
      true (default) - create a Route53 hosted zone and manage every record,
                       including the MX that inbound mail depends on. $0.50/mo,
                       and GoDaddy's nameservers must be repointed once.
      false          - keep DNS at GoDaddy; Terraform creates nothing and prints
                       the records to add via the `godaddy_dns_records` output.
    TLS is unaffected either way: Caddy uses the HTTP-01 ACME challenge.
  EOT
  type        = bool
  default     = true
}

variable "route53_zone_id" {
  description = "Existing Route53 hosted zone ID. Only used when manage_dns = true; leave empty to have Terraform create the zone."
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

# ── Instance ─────────────────────────────────────────────────────────────────

variable "instance_type" {
  description = <<-EOT
    EC2 instance type. Defaults to Graviton (ARM) which is ~20% cheaper.
    Approx monthly on-demand, us-east-1:
      t4g.small  2 vCPU /  2 GB  ~$12   (fine for launch; needs the swap file)
      t4g.medium 2 vCPU /  4 GB  ~$25   (comfortable for in-place image builds)
      t4g.large  2 vCPU /  8 GB  ~$49
    Use a t3.* type if you would rather build x86 images.
  EOT
  type        = string
  default     = "t4g.small"
}

variable "cpu_architecture" {
  description = "Must match instance_type: arm64 for t4g.*, x86_64 for t3.*/t2.*."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.cpu_architecture)
    error_message = "cpu_architecture must be arm64 or x86_64."
  }
}

variable "root_volume_size" {
  description = "Root EBS volume in GB (gp3). Holds the OS, Docker images, and the Postgres volume."
  type        = number
  default     = 30
}

variable "use_spot_instance" {
  description = "Run as a persistent Spot instance for ~60-70% off. Cheap, but AWS can reclaim it with a 2-minute warning; not advised once you have paying users."
  type        = bool
  default     = false
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach port 22. Defaults to none — use SSM Session Manager instead (no open port, no key to lose)."
  type        = list(string)
  default     = []
}

variable "ssh_key_name" {
  description = "Existing EC2 key pair name for SSH. Optional; leave empty to rely on SSM Session Manager."
  type        = string
  default     = ""
}

# ── Application ──────────────────────────────────────────────────────────────

variable "app_repo_url" {
  description = "Git URL the instance clones to build images. For a private repo use an HTTPS URL with a token, or attach a deploy key (see README)."
  type        = string
  default     = ""
}

variable "sendgrid_from_email" {
  description = "Verified SendGrid sender address for magic-link email."
  type        = string
  default     = "info@mocklane.com"
}

variable "postgres_password" {
  description = "Password for the containerised Postgres. Leave empty to have Terraform generate one and store it in SSM."
  type        = string
  default     = ""
  sensitive   = true
}

# ── Backups ──────────────────────────────────────────────────────────────────

variable "backup_retention_days" {
  description = "Days to keep nightly pg_dump files in S3 before expiry."
  type        = number
  default     = 30
}

variable "alarm_email" {
  description = "Address subscribed to CloudWatch alarms. Empty disables notifications."
  type        = string
  default     = ""
}

variable "preserve_zoho_email" {
  description = <<-EOT
    Recreate the Zoho Mail records (apex MX, SPF, DKIM, verification) that exist
    at GoDaddy today, so business email at @<domain> keeps working after
    delegating to Route53. Only set false if you have retired Zoho.
  EOT
  type        = bool
  default     = true
}

# ── Account safety ───────────────────────────────────────────────────────────

variable "aws_profile" {
  description = <<-EOT
    Named AWS CLI profile to deploy with (from ~/.aws/credentials). Strongly
    recommended: relying on the default profile is how this stack once landed in
    a shared company account. Empty falls back to the default credential chain.
  EOT
  type        = string
  default     = ""
}

variable "allowed_account_ids" {
  description = <<-EOT
    Account IDs this configuration is permitted to touch. Terraform aborts
    before creating anything if the resolved credentials belong to a different
    account. Set this to your own account ID.
  EOT
  type        = list(string)
  default     = []
}
