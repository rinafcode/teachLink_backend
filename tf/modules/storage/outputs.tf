output "uploads_bucket_id" {
  description = "ID of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_domain" {
  description = "Domain of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.bucket_domain_name
}

output "uploads_bucket_regional_domain" {
  description = "Regional domain of the uploads S3 bucket"
  value       = aws_s3_bucket.uploads.bucket_regional_domain_name
}

output "backups_bucket_id" {
  description = "ID of the backups S3 bucket"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = aws_s3_bucket.backups.arn
}

output "terraform_state_bucket_id" {
  description = "ID of the Terraform state S3 bucket"
  value       = var.environment == "dev" ? aws_s3_bucket.terraform_state[0].id : null
}

output "terraform_state_lock_table_id" {
  description = "ID of the Terraform state lock DynamoDB table"
  value       = var.environment == "dev" ? aws_dynamodb_table.terraform_state_lock[0].id : null
}
