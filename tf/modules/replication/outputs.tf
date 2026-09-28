output "replication_role_arn" {
  description = "ARN of the IAM role used by S3 for replication"
  value       = aws_iam_role.replication.arn
}

output "replication_rule_id" {
  description = "ID of the replication rule attached to the source bucket"
  value       = "replicate-${var.name}-to-secondary"
}
