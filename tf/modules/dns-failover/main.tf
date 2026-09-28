# DNS Failover Module
#
# Implements active-passive, health-check driven failover between two regions
# using Route 53. Traffic resolves to the primary region while its health check
# is healthy and automatically shifts to the secondary region when it is not.

locals {
  # Use the provided hosted zone, or the one created below.
  zone_id  = var.hosted_zone_id != "" ? var.hosted_zone_id : aws_route53_zone.this[0].zone_id
  app_fqdn = "${var.app_subdomain}.${var.domain_name}"
}

# Optionally create a public hosted zone when an existing one is not supplied.
resource "aws_route53_zone" "this" {
  count = var.hosted_zone_id == "" ? 1 : 0
  name  = var.domain_name

  tags = merge(
    {
      Name = "teachlink-${var.environment}-zone"
    },
    var.tags
  )
}

# Health check for the primary region endpoint.
resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_alb_dns_name
  port              = var.health_check_port
  type              = var.health_check_type
  resource_path     = var.health_check_path
  request_interval  = var.health_check_interval
  failure_threshold = var.health_check_failure_threshold

  tags = merge(
    {
      Name   = "teachlink-${var.environment}-primary-${var.primary_region}"
      Region = var.primary_region
    },
    var.tags
  )
}

# Health check for the secondary region endpoint.
resource "aws_route53_health_check" "secondary" {
  fqdn              = var.secondary_alb_dns_name
  port              = var.health_check_port
  type              = var.health_check_type
  resource_path     = var.health_check_path
  request_interval  = var.health_check_interval
  failure_threshold = var.health_check_failure_threshold

  tags = merge(
    {
      Name   = "teachlink-${var.environment}-secondary-${var.secondary_region}"
      Region = var.secondary_region
    },
    var.tags
  )
}

# PRIMARY failover record — served while the primary health check is healthy.
resource "aws_route53_record" "primary" {
  zone_id = local.zone_id
  name    = local.app_fqdn
  type    = "A"

  set_identifier  = "primary-${var.primary_region}"
  health_check_id = aws_route53_health_check.primary.id

  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = var.primary_alb_dns_name
    zone_id                = var.primary_alb_zone_id
    evaluate_target_health = true
  }
}

# SECONDARY failover record — served when the primary is unhealthy.
resource "aws_route53_record" "secondary" {
  zone_id = local.zone_id
  name    = local.app_fqdn
  type    = "A"

  set_identifier  = "secondary-${var.secondary_region}"
  health_check_id = aws_route53_health_check.secondary.id

  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = var.secondary_alb_dns_name
    zone_id                = var.secondary_alb_zone_id
    evaluate_target_health = true
  }
}

# CloudWatch alarm that fires when the primary region health check goes red,
# so failover is observable and can page the on-call engineer.
resource "aws_cloudwatch_metric_alarm" "primary_unhealthy" {
  alarm_name          = "teachlink-${var.environment}-primary-region-unhealthy"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Primary region (${var.primary_region}) health check is failing; Route 53 is failing over to ${var.secondary_region}."
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.primary.id
  }

  tags = var.tags
}
