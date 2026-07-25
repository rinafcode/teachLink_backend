output "hosted_zone_id" {
  description = "Route 53 hosted zone ID used for the failover records"
  value       = local.zone_id
}

output "app_fqdn" {
  description = "Fully qualified domain name that fails over between regions"
  value       = local.app_fqdn
}

output "primary_health_check_id" {
  description = "ID of the primary region Route 53 health check"
  value       = aws_route53_health_check.primary.id
}

output "secondary_health_check_id" {
  description = "ID of the secondary region Route 53 health check"
  value       = aws_route53_health_check.secondary.id
}

output "name_servers" {
  description = "Name servers for the created hosted zone (empty when an existing zone is reused)"
  value       = var.hosted_zone_id == "" ? aws_route53_zone.this[0].name_servers : []
}
