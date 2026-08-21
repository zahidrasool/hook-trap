#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# HookTrap AWS Deployment Script
# =============================================================================
#
# Usage:
#   ./deploy.sh --option-a           # Deploy fully serverless (Lambda + API Gateway)
#   ./deploy.sh --option-b           # Deploy with App Runner
#   ./deploy.sh --option-a --migrate # Deploy and run database migrations
#
# Environment variables (override defaults):
#   AWS_REGION          - AWS region (default: us-east-1)
#   AWS_ACCOUNT_ID      - AWS account ID (auto-detected if not set)
#   ENVIRONMENT         - Deployment environment: production|staging (default: production)
#   ECR_REPO_NAME       - ECR repository name (default: hooktrap-backend)
#   STACK_NAME          - CloudFormation stack name (default: hooktrap-{environment})

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Defaults
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
ECR_REPO_NAME="${ECR_REPO_NAME:-hooktrap-backend}"
DEPLOY_OPTION=""
RUN_MIGRATIONS=false
IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'latest')"

# =============================================================================
# Parse arguments
# =============================================================================
while [[ $# -gt 0 ]]; do
    case $1 in
        --option-a)
            DEPLOY_OPTION="lambda"
            shift
            ;;
        --option-b)
            DEPLOY_OPTION="apprunner"
            shift
            ;;
        --migrate)
            RUN_MIGRATIONS=true
            shift
            ;;
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 --option-a|--option-b [--migrate] [--region REGION] [--env ENV] [--tag TAG]"
            echo ""
            echo "Options:"
            echo "  --option-a    Deploy fully serverless (Lambda + API Gateway)"
            echo "  --option-b    Deploy with App Runner"
            echo "  --migrate     Run database migrations after deployment"
            echo "  --region      AWS region (default: us-east-1)"
            echo "  --env         Environment: production|staging (default: production)"
            echo "  --tag         Docker image tag (default: git short SHA)"
            exit 0
            ;;
        *)
            echo "Error: Unknown option $1"
            exit 1
            ;;
    esac
done

if [[ -z "$DEPLOY_OPTION" ]]; then
    echo "Error: Must specify --option-a (Lambda) or --option-b (App Runner)"
    echo "Run $0 --help for usage information."
    exit 1
fi

STACK_NAME="${STACK_NAME:-hooktrap-${ENVIRONMENT}}"

# Auto-detect AWS account ID
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "============================================="
echo "HookTrap Deployment"
echo "============================================="
echo "Option:       ${DEPLOY_OPTION}"
echo "Environment:  ${ENVIRONMENT}"
echo "Region:       ${AWS_REGION}"
echo "Account:      ${AWS_ACCOUNT_ID}"
echo "Stack:        ${STACK_NAME}"
echo "Image Tag:    ${IMAGE_TAG}"
echo "ECR URI:      ${ECR_URI}:${IMAGE_TAG}"
echo "============================================="

# =============================================================================
# Step 1: Create ECR repository if it doesn't exist
# =============================================================================
echo ""
echo "[1/5] Ensuring ECR repository exists..."
aws ecr describe-repositories \
    --repository-names "$ECR_REPO_NAME" \
    --region "$AWS_REGION" > /dev/null 2>&1 || \
aws ecr create-repository \
    --repository-name "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

# =============================================================================
# Step 2: Build Docker image
# =============================================================================
echo ""
echo "[2/5] Building Docker image..."
docker build \
    -t "${ECR_REPO_NAME}:${IMAGE_TAG}" \
    -t "${ECR_REPO_NAME}:latest" \
    -f "$BACKEND_DIR/Dockerfile" \
    "$BACKEND_DIR"

# =============================================================================
# Step 3: Push to ECR
# =============================================================================
echo ""
echo "[3/5] Pushing image to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker tag "${ECR_REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker tag "${ECR_REPO_NAME}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:latest"

# =============================================================================
# Step 4: Deploy via SAM
# =============================================================================
echo ""
echo "[4/5] Deploying CloudFormation stack via SAM..."

if [[ "$DEPLOY_OPTION" == "lambda" ]]; then
    TEMPLATE_FILE="$SCRIPT_DIR/template.yaml"

    sam build \
        --template-file "$TEMPLATE_FILE" \
        --build-dir "$SCRIPT_DIR/.aws-sam/build"

    sam deploy \
        --template-file "$SCRIPT_DIR/.aws-sam/build/template.yaml" \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_NAMED_IAM \
        --resolve-s3 \
        --no-fail-on-empty-changeset \
        --parameter-overrides \
            "Environment=${ENVIRONMENT}"

elif [[ "$DEPLOY_OPTION" == "apprunner" ]]; then
    TEMPLATE_FILE="$SCRIPT_DIR/apprunner.yaml"

    sam deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_NAMED_IAM \
        --resolve-s3 \
        --no-fail-on-empty-changeset \
        --parameter-overrides \
            "Environment=${ENVIRONMENT}" \
            "EcrImageUri=${ECR_URI}:${IMAGE_TAG}"
fi

# =============================================================================
# Step 5: Run database migrations (optional)
# =============================================================================
if [[ "$RUN_MIGRATIONS" == true ]]; then
    echo ""
    echo "[5/5] Running database migrations..."

    if [[ "$DEPLOY_OPTION" == "lambda" ]]; then
        # For Lambda: invoke a migration function or use a one-off task
        FUNCTION_NAME="hooktrap-${ENVIRONMENT}-api"
        echo "Running Alembic migrations via Lambda invocation..."
        aws lambda invoke \
            --function-name "$FUNCTION_NAME" \
            --region "$AWS_REGION" \
            --payload '{"path": "/health", "httpMethod": "GET"}' \
            --cli-binary-format raw-in-base64-out \
            /tmp/migration-response.json
        echo "Note: Migrations run automatically on Lambda cold start via lifespan handler."
        echo "If you need explicit Alembic migrations, consider running them from a bastion host."

    elif [[ "$DEPLOY_OPTION" == "apprunner" ]]; then
        echo "Note: Migrations run automatically on App Runner startup via lifespan handler."
        echo "If you need explicit Alembic migrations, consider running them from a bastion host"
        echo "or an ECS Fargate task within the VPC."
    fi
else
    echo ""
    echo "[5/5] Skipping migrations (use --migrate to run them)"
fi

# =============================================================================
# Print outputs
# =============================================================================
echo ""
echo "============================================="
echo "Deployment complete!"
echo "============================================="
echo ""
echo "Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table
