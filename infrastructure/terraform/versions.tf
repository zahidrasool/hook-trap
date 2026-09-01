terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state. Create the bucket + lock table once (see README "Bootstrap"),
  # then uncomment and run `terraform init -migrate-state`.
  #
  # backend "s3" {
  #   bucket         = "mocklane-tfstate"
  #   key            = "mocklane/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "mocklane-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  # Use a named profile rather than whatever happens to be in the default
  # credentials file. Ambient credentials are how this stack once got applied
  # to the wrong account.
  profile = var.aws_profile != "" ? var.aws_profile : null

  # Hard guard: Terraform refuses to plan or apply if the resolved credentials
  # belong to any other account. Set allowed_account_ids in terraform.tfvars to
  # your own account before the first apply.
  allowed_account_ids = length(var.allowed_account_ids) > 0 ? var.allowed_account_ids : null

  default_tags {
    tags = {
      Project     = "MockLane"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

locals {
  name = "mocklane-${var.environment}"

  # Every AZ-spanning resource keys off this list.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  api_domain   = "api.${var.domain_name}"
  inbox_domain = "inbox.${var.domain_name}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
