# Networking Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = module.networking.alb_security_group_id
}

output "ecs_tasks_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = module.networking.ecs_tasks_security_group_id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.networking.rds_security_group_id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = module.networking.redis_security_group_id
}

# Compute Outputs
output "ecs_cluster_id" {
  description = "ECS cluster ID"
  value       = module.compute.ecs_cluster_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.compute.ecs_service_name
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = module.compute.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the ALB"
  value       = module.compute.alb_zone_id
}

output "alb_url" {
  description = "URL of the ALB"
  value       = "http${var.certificate_arn != "" ? "s" : ""}://${module.compute.alb_dns_name}"
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = module.compute.target_group_arn
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.compute.task_definition_arn
}

output "task_definition_family" {
  description = "Family of the ECS task definition"
  value       = module.compute.task_definition_family
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = module.compute.log_group_name
}

# Database Outputs
output "db_instance_id" {
  description = "RDS instance ID"
  value       = module.database.db_instance_id
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.db_instance_endpoint
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = module.database.db_instance_port
}

output "db_instance_name" {
  description = "RDS database name"
  value       = module.database.db_instance_name
}

output "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret for DB password"
  value       = module.database.db_password_secret_arn
}

output "redis_cluster_id" {
  description = "ElastiCache cluster ID"
  value       = module.database.redis_cluster_id
}

output "redis_cluster_endpoint" {
  description = "ElastiCache cluster endpoint"
  value       = module.database.redis_cluster_endpoint
}

output "redis_cluster_port" {
  description = "ElastiCache cluster port"
  value       = module.database.redis_cluster_port
}

# Storage Outputs
output "uploads_bucket_id" {
  description = "ID of the uploads S3 bucket"
  value       = module.storage.uploads_bucket_id
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = module.storage.uploads_bucket_arn
}

output "uploads_bucket_domain" {
  description = "Domain of the uploads S3 bucket"
  value       = module.storage.uploads_bucket_domain
}

output "uploads_bucket_regional_domain" {
  description = "Regional domain of the uploads S3 bucket"
  value       = module.storage.uploads_bucket_regional_domain
}

output "backups_bucket_id" {
  description = "ID of the backups S3 bucket"
  value       = module.storage.backups_bucket_id
}

output "backups_bucket_arn" {
  description = "ARN of the backups S3 bucket"
  value       = module.storage.backups_bucket_arn
}

# Monitoring Outputs
output "cloudwatch_log_group_app" {
  description = "CloudWatch log group for application"
  value       = module.monitoring.cloudwatch_log_group_app
}

output "cloudwatch_log_group_alb" {
  description = "CloudWatch log group for ALB"
  value       = module.monitoring.cloudwatch_log_group_alb
}

output "cloudwatch_dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = module.monitoring.cloudwatch_dashboard_url
}
