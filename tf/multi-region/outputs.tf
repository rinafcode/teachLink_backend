# ---------------------------------------------------------------------------
# Primary region
# ---------------------------------------------------------------------------
output "primary_region" {
  description = "Primary (active) region"
  value       = var.primary_region
}

output "primary_alb_dns_name" {
  description = "DNS name of the primary region ALB"
  value       = module.compute_primary.alb_dns_name
}

output "primary_db_endpoint" {
  description = "Primary RDS endpoint (read/write)"
  value       = module.database_primary.db_instance_endpoint
}

output "primary_uploads_bucket" {
  description = "Primary region uploads bucket"
  value       = module.storage_primary.uploads_bucket_id
}

# ---------------------------------------------------------------------------
# Secondary region
# ---------------------------------------------------------------------------
output "secondary_region" {
  description = "Secondary (standby) region"
  value       = var.secondary_region
}

output "secondary_alb_dns_name" {
  description = "DNS name of the secondary region ALB"
  value       = module.compute_secondary.alb_dns_name
}

output "replica_db_endpoint" {
  description = "Cross-region read replica endpoint (read-only until promoted)"
  value       = module.database_replica.replica_db_endpoint
}

output "secondary_uploads_bucket" {
  description = "Secondary region uploads bucket (replication target)"
  value       = module.storage_secondary.uploads_bucket_id
}

# ---------------------------------------------------------------------------
# Failover / DNS
# ---------------------------------------------------------------------------
output "app_fqdn" {
  description = "Failover-enabled application endpoint"
  value       = module.dns_failover.app_fqdn
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = module.dns_failover.hosted_zone_id
}

output "hosted_zone_name_servers" {
  description = "Name servers to delegate to (when a zone was created)"
  value       = module.dns_failover.name_servers
}

output "primary_health_check_id" {
  description = "Route 53 health check ID for the primary region"
  value       = module.dns_failover.primary_health_check_id
}

output "secondary_health_check_id" {
  description = "Route 53 health check ID for the secondary region"
  value       = module.dns_failover.secondary_health_check_id
}
