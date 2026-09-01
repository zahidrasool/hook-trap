# ─────────────────────────────────────────────────────────────────────────────
# DNS.
#
# The domain is registered at GoDaddy. Two supported paths:
#
#   manage_dns = false  (default)
#       Keep DNS at GoDaddy. Terraform creates nothing here and instead prints
#       the exact records to add — see the `godaddy_dns_records` output.
#       Free, no nameserver migration.
#
#   manage_dns = true
#       Terraform creates a Route53 hosted zone and manages every record.
#       Costs $0.50/mo and requires repointing GoDaddy's nameservers, but the
#       records — including the MX that inbound mail depends on — are then
#       version-controlled and cannot drift.
#
# TLS does not depend on this choice: Caddy uses the HTTP-01 ACME challenge,
# which only needs the A records to resolve to this host.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_route53_zone" "main" {
  count = var.manage_dns && var.route53_zone_id == "" ? 1 : 0
  name  = var.domain_name

  tags = { Name = local.name }
}

locals {
  zone_id = var.manage_dns ? (
    var.route53_zone_id != "" ? var.route53_zone_id : aws_route53_zone.main[0].zone_id
  ) : ""

  # Records required for the app and for inbound mail. Rendered into an output
  # when DNS stays at GoDaddy, and created directly when it does not.
  dns_records = [
    {
      type     = "A"
      host     = "@"
      name     = var.domain_name
      value    = aws_eip.app.public_ip
      priority = null
      purpose  = "App"
    },
    {
      type     = "CNAME"
      host     = "www"
      name     = "www.${var.domain_name}"
      value    = var.domain_name
      priority = null
      purpose  = "App (www redirect)"
    },
    {
      type     = "A"
      host     = "api"
      name     = local.api_domain
      value    = aws_eip.app.public_ip
      priority = null
      purpose  = "API"
    },
    {
      type     = "A"
      host     = "inbox"
      name     = local.inbox_domain
      value    = aws_eip.app.public_ip
      priority = null
      purpose  = "Mail host (the server that answers on port 25)"
    },
    {
      type     = "MX"
      host     = "inbox"
      name     = local.inbox_domain
      value    = local.inbox_domain
      priority = 10
      purpose  = "Routes mail for *@inbox.<domain> here. Without this, senders get NXDOMAIN."
    },
    {
      type     = "TXT"
      host     = "inbox"
      name     = local.inbox_domain
      value    = "v=spf1 -all"
      priority = null
      purpose  = "Nothing legitimately sends as this subdomain; it only receives."
    },
  ]
}

# ── Route53 records (only when manage_dns = true) ────────────────────────────

resource "aws_route53_record" "apex" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

resource "aws_route53_record" "www" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}

resource "aws_route53_record" "api" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

resource "aws_route53_record" "inbox_a" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = local.inbox_domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

resource "aws_route53_record" "inbox_mx" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = local.inbox_domain
  type    = "MX"
  ttl     = 300
  records = ["10 ${local.inbox_domain}"]
}

resource "aws_route53_record" "inbox_spf" {
  count   = var.manage_dns ? 1 : 0
  zone_id = local.zone_id
  name    = local.inbox_domain
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 -all"]
}

# ─────────────────────────────────────────────────────────────────────────────
# Records inherited from GoDaddy.
#
# Captured from the live zone before delegation. These are NOT part of MockLane
# — they belong to Zoho Mail, which serves business email at @mocklane.com.
# Delegating the domain to Route53 without them would bounce that mail.
#
# Verify against GoDaddy before applying:
#   dig +short MX  mocklane.com
#   dig +short TXT mocklane.com
#   dig +short TXT zmail._domainkey.mocklane.com
# ─────────────────────────────────────────────────────────────────────────────

# Apex MX -> Zoho.
# Distinct from the inbox MX above: this is where *your* mail is delivered,
# that one is where sandbox mail is delivered. Both coexist.
resource "aws_route53_record" "zoho_mx" {
  count   = var.manage_dns && var.preserve_zoho_email ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 3600
  records = [
    "10 mx.zoho.com",
    "20 mx2.zoho.com",
    "50 mx3.zoho.com",
  ]
}

# Apex TXT: Zoho's SPF (delegated to a macro subdomain) plus its ownership
# verification token. Both must live in the same record set — Route53 allows
# only one TXT record per name.
resource "aws_route53_record" "apex_txt" {
  count   = var.manage_dns && var.preserve_zoho_email ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 3600
  records = [
    "v=spf1 include:dc-8e814c8572._spfm.mocklane.com ~all",
    "zoho-verification=zb03188290.zmverify.zoho.com",
  ]
}

# The macro subdomain the apex SPF includes.
resource "aws_route53_record" "zoho_spf_macro" {
  count   = var.manage_dns && var.preserve_zoho_email ? 1 : 0
  zone_id = local.zone_id
  name    = "dc-8e814c8572._spfm.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:zohomail.com ~all"]
}

# Zoho DKIM signing key. Without it, outbound mail from Zoho fails DKIM and is
# far more likely to be filtered as spam.
resource "aws_route53_record" "zoho_dkim" {
  count   = var.manage_dns && var.preserve_zoho_email ? 1 : 0
  zone_id = local.zone_id
  name    = "zmail._domainkey.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDI/GA7YOHR14y7+4beBqKRJEyG6xQKQ5Zs4TNmzTdlk7zFBN/rSYJTovaQiHY0h3zYy/ADqhnJDPSRmLzSynTIEXCa7sZOgOjNpeSCxvjl9yVAngO9RpVx/bQ99J2EyFkCEnplRIRRvjet4Tey1sio1tHQqjhdOjUHMGayP4BabwIDAQAB"]
}

# NOTE: the apex A record currently points at 13.248.243.5 (GoDaddy parking via
# AWS Global Accelerator). It is deliberately NOT reproduced — the apex A
# record defined above repoints the domain at this deployment.

# ── Outbound (SendGrid) ──────────────────────────────────────────────────────
# Magic-link email for MockLane is sent from the apex domain via SendGrid's API.
# Run "Sender Authentication" in the SendGrid dashboard and add the three CNAMEs
# it issues (per-account, so they cannot be hardcoded here).
#
# Careful: SendGrid will also propose an SPF change. The apex SPF above already
# belongs to Zoho — merge, do not replace, or Zoho mail starts failing SPF.
# A combined record looks like:
#   v=spf1 include:dc-8e814c8572._spfm.mocklane.com include:sendgrid.net ~all
