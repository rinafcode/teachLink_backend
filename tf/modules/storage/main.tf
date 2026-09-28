# S3 bucket for application uploads
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.s3_bucket_prefix}-${var.environment}-uploads"

  tags = merge(
    {
      Name = "${var.s3_bucket_prefix}-${var.environment}-uploads"
    },
    var.tags
  )
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }
  }
}

# S3 bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.s3_bucket_prefix}-${var.environment}-backups"

  tags = merge(
    {
      Name = "${var.s3_bucket_prefix}-${var.environment}-backups"
    },
    var.tags
  )
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket for Terraform state (if not using external state bucket)
resource "aws_s3_bucket" "terraform_state" {
  count  = var.environment == "dev" ? 1 : 0
  bucket = "${var.s3_bucket_prefix}-terraform-state"

  tags = merge(
    {
      Name = "${var.s3_bucket_prefix}-terraform-state"
    },
    var.tags
  )
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  count  = var.environment == "dev" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  count  = var.environment == "dev" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  count  = var.environment == "dev" ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for Terraform state locking (if not using external lock table)
resource "aws_dynamodb_table" "terraform_state_lock" {
  count        = var.environment == "dev" ? 1 : 0
  name         = "${var.s3_bucket_prefix}-terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(
    {
      Name = "${var.s3_bucket_prefix}-terraform-state-lock"
    },
    var.tags
  )
}
