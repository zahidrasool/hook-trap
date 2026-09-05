# ─────────────────────────────────────────────────────────────────────────────
# Amazon SES for transactional email (magic-link sign-in).
#
# Chosen over a third-party provider for two reasons:
#   - cost: $0.10 per 1,000 emails with no monthly minimum
#   - credentials: the instance sends through its IAM role, so there is no API
#     key to store, rotate, or leak. Nothing lands in SSM.
#
# Production access was granted 2026-09-05: the account is out of the sandbox
# in us-east-1 and may send to any recipient (50,000/day at 14/sec). A NEW
# account starts in the sandbox and may only send to verified addresses —
# request production access in the SES console before expecting signup to work.
#
# Still missing: bounce and complaint handling. AWS asks for it explicitly on
# approval, and reputation damage accrues quietly. Wire an SNS topic to the
# identity's event destination before real signup volume arrives.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_sesv2_email_identity" "domain" {
  count          = var.enable_ses ? 1 : 0
  email_identity = var.domain_name

  dkim_signing_attributes {
    # Easy DKIM: AWS generates the key pair and publishes the public half via
    # the three CNAMEs below.
    next_signing_key_length = "RSA_2048_BIT"
  }

  tags = { Name = "${local.name}-ses" }
}

# DKIM verification. SES will not leave "pending" until these resolve, and
# unsigned mail is far more likely to be filtered as spam.
resource "aws_route53_record" "ses_dkim" {
  count = var.enable_ses && var.manage_dns ? 3 : 0

  zone_id = local.zone_id
  name    = "${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain[0].dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# Custom MAIL FROM gives SPF alignment on the envelope sender, which materially
# improves deliverability. Uses a subdomain so it cannot disturb the apex
# records that Zoho relies on.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  count = var.enable_ses ? 1 : 0

  email_identity         = aws_sesv2_email_identity.domain[0].email_identity
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  count = var.enable_ses && var.manage_dns ? 1 : 0

  zone_id = local.zone_id
  name    = "mail.${var.domain_name}"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  count = var.enable_ses && var.manage_dns ? 1 : 0

  zone_id = local.zone_id
  name    = "mail.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# ─────────────────────────────────────────────────────────────────────────────
# DMARC.
#
# SPF and DKIM both pass and both align already (the custom MAIL FROM above
# gives envelope alignment; Easy DKIM signs as d=mocklane.com). DMARC was the
# only authentication record missing, and its absence is weighted against a
# sender — Gmail and Yahoo have required it of bulk senders since Feb 2024.
#
# p=none ON PURPOSE. This zone also carries Zoho records for a real business
# mailbox, and an enforcing policy that is wrong takes that mail down, not just
# MockLane's. p=none publishes the record and asks for reports while enforcing
# nothing, which is the whole benefit here: the trust signal costs nothing and
# risks nothing. Move to p=quarantine only after the aggregate reports show
# every legitimate source passing — Zoho included.
#
# Gated on manage_dns rather than enable_ses: the policy covers the domain, not
# one sender.
resource "aws_route53_record" "dmarc" {
  count = var.manage_dns ? 1 : 0

  zone_id = local.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [
    var.dmarc_report_email == ""
    ? "v=DMARC1; p=none;"
    : "v=DMARC1; p=none; rua=mailto:${var.dmarc_report_email}; fo=1"
  ]
}
