output "replica_db_instance_id" {
  description = "ID of the cross-region read replica"
  value       = aws_db_instance.replica.id
}

output "replica_db_endpoint" {
  description = "Endpoint of the cross-region read replica"
  value       = aws_db_instance.replica.endpoint
}

output "replica_kms_key_arn" {
  description = "ARN of the KMS key encrypting the replica"
  value       = aws_kms_key.replica.arn
}

output "standby_redis_endpoint" {
  description = "Endpoint of the standby Redis cluster"
  value       = aws_elasticache_cluster.standby.cache_nodes[0].address
}
