output "public_ip" {
  description = "Elastic IP of the application host."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  description = "EC2 instance ID (use with `aws ssm start-session`)."
  value       = aws_instance.app.id
}

output "app_url" {
  value = "https://${var.domain_name}"
}

output "api_url" {
  value = "https://${local.api_domain}"
}

output "inbox_domain" {
  description = "Sandbox addresses are <prefix>@ this domain."
  value       = local.inbox_domain
}

output "backup_bucket" {
  value = aws_s3_bucket.backups.id
}

output "nameservers" {
  description = "Set these as custom nameservers at GoDaddy (only when manage_dns = true)."
  value       = var.manage_dns && var.route53_zone_id == "" ? aws_route53_zone.main[0].name_servers : []
}

output "godaddy_dns_records" {
  description = "Records to add in GoDaddy (DNS > Manage Zones). Shown when manage_dns = false."
  value = var.manage_dns ? "DNS is managed in Route53; nothing to do at GoDaddy beyond the nameservers." : join("\n", concat(
    [
      "Add these in GoDaddy > My Products > DNS > Manage Zones > ${var.domain_name}",
      "GoDaddy's 'Name' field takes the host only (@ for the apex), never the full domain.",
      "",
      format("%-6s %-8s %-34s %s", "TYPE", "NAME", "VALUE", "NOTES"),
      format("%-6s %-8s %-34s %s", "----", "----", "-----", "-----"),
    ],
    [
      for r in local.dns_records :
      format(
        "%-6s %-8s %-34s %s",
        r.type,
        r.host,
        r.type == "MX" ? "${r.value} (priority ${r.priority})" : r.value,
        r.purpose,
      )
    ],
    [
      "",
      "Verify once propagated (GoDaddy TTLs are usually 600s):",
      "  dig +short A   ${var.domain_name}",
      "  dig +short MX  ${local.inbox_domain}",
      "  nc -zv ${local.inbox_domain} 25",
    ],
  ))
}

output "ssm_session_command" {
  description = "Shell into the host without opening SSH."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}

output "set_secrets_commands" {
  description = "Run these once to replace the placeholder credentials."
  value = join("\n", [
    for p in local.external_params :
    "aws ssm put-parameter --name /${local.name}/${p} --value '<value>' --type SecureString --overwrite --region ${var.aws_region}"
  ])
}

output "estimated_monthly_cost_usd" {
  description = "Rough on-demand estimate; excludes data transfer and taxes."
  value = {
    ec2_instance   = var.use_spot_instance ? "~$4 (spot t4g.small)" : "~$12 (on-demand t4g.small)"
    ebs_gp3        = format("~$%.2f", var.root_volume_size * 0.08)
    public_ipv4    = "~$3.65"
    route53_zone   = "$0.50"
    s3_backups     = "~$0.50"
    ssm_parameters = "$0.00 (standard tier)"
    total          = var.use_spot_instance ? "~$11/mo" : "~$19/mo"
  }
}
