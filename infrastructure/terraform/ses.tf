# ─────────────────────────────────────────────────────────────────────────────
# Amazon SES for transactional email (magic-link sign-in).
#
# Chosen over a third-party provider for two reasons:
#   - cost: $0.10 per 1,000 emails with no monthly minimum
#   - credentials: the instance sends through its IAM role, so there is no API
#     key to store, rotate, or leak. Nothing lands in SSM.
#
# NOTE: a new SES account starts in the sandbox and may only send to verified
# addresses. Request production access in the SES console (free, usually granted
# within a day). Until then, verify your own address to test — see the
# ses_status output.
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
