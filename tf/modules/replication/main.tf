# S3 Cross-Region Replication Module
#
# Configures continuous, asynchronous replication of a source bucket (primary
# region) to a destination bucket (secondary region). Both buckets must have
# versioning enabled, which the storage module already guarantees.
#
# This module must be applied with a provider in the SOURCE bucket's region,
# because the replication configuration is attached to the source bucket.

# IAM role assumed by S3 to perform replication.
resource "aws_iam_role" "replication" {
  name = "teachlink-${var.environment}-${var.name}-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

# Permissions: read+version source objects, replicate into the destination.
resource "aws_iam_policy" "replication" {
  name = "teachlink-${var.environment}-${var.name}-replication"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = [var.source_bucket_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = ["${var.source_bucket_arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = ["${var.destination_bucket_arn}/*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "replication" {
  role       = aws_iam_role.replication.name
  policy_arn = aws_iam_policy.replication.arn
}

# Attach the replication configuration to the source bucket.
resource "aws_s3_bucket_replication_configuration" "this" {
  role   = aws_iam_role.replication.arn
  bucket = var.source_bucket_id

  rule {
    id     = "replicate-${var.name}-to-secondary"
    status = "Enabled"

    filter {
      prefix = ""
    }

    delete_marker_replication {
      status = "Enabled"
    }

    destination {
      bucket        = var.destination_bucket_arn
      storage_class = var.destination_storage_class
    }
  }

  depends_on = [aws_iam_role_policy_attachment.replication]
}
