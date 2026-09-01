# Nightly pg_dump to S3. This replaces RDS automated backups, which is most of
# why running Postgres in a container is acceptable here.

resource "aws_s3_bucket" "backups" {
  bucket        = "${local.name}-backups-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  tags = { Name = "${local.name}-backups" }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-dumps"
    status = "Enabled"

    filter {
      prefix = "postgres/"
    }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = var.backup_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.backups]
}
