data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-${var.cpu_architecture == "arm64" ? "arm64" : "x86_64"}"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.al2023.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public.id
  key_name      = var.ssh_key_name != "" ? var.ssh_key_name : null

  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  # Spot is dramatically cheaper but interruptible. "stop" (not "terminate")
  # keeps the EBS volume so the instance can resume with its data intact.
  dynamic "instance_market_options" {
    for_each = var.use_spot_instance ? [1] : []
    content {
      market_type = "spot"
      spot_options {
        spot_instance_type             = "persistent"
        instance_interruption_behavior = "stop"
      }
    }
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = false
    tags                  = { Name = "${local.name}-root" }
  }

  user_data_replace_on_change = false
  user_data = templatefile("${path.module}/user_data.sh", {
    aws_region    = var.aws_region
    param_prefix  = "/${local.name}"
    domain_name   = var.domain_name
    api_domain    = local.api_domain
    inbox_domain  = local.inbox_domain
    app_repo_url  = var.app_repo_url
    backup_bucket = aws_s3_bucket.backups.id
    admin_email   = var.sendgrid_from_email
  })

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 only
  }

  monitoring = false # Detailed monitoring costs extra; basic 5-minute is free.

  tags = { Name = "${local.name}-app" }

  lifecycle {
    ignore_changes = [ami]
  }
}

# A stable IP is required for the inbox MX record and for mail-server
# reputation. Note AWS bills ~$3.65/mo per public IPv4 address since Feb 2024.
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "${local.name}-eip" }

  depends_on = [aws_internet_gateway.main]
}
