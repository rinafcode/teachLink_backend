variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "source_db_arn" {
  description = "ARN of the primary-region RDS instance to replicate from"
  type        = string
}

variable "db_instance_class" {
  description = "Instance class for the read replica"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs in the secondary region"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID for the replica in the secondary region"
  type        = string
}

variable "redis_security_group_id" {
  description = "Security group ID for the standby Redis cluster"
  type        = string
}

variable "redis_node_type" {
  description = "ElastiCache node type for the standby cluster"
  type        = string
}

variable "redis_num_cache_nodes" {
  description = "Number of standby cache nodes"
  type        = number
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
