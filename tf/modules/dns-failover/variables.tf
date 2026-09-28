variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "domain_name" {
  description = "Root domain managed in Route 53 (e.g. teachlink.io)"
  type        = string
}

variable "app_subdomain" {
  description = "Subdomain that fails over between regions (e.g. api)"
  type        = string
  default     = "api"
}

variable "hosted_zone_id" {
  description = "Existing Route 53 hosted zone ID. Leave empty to create a new public zone for domain_name."
  type        = string
  default     = ""
}

variable "primary_region" {
  description = "Primary AWS region identifier (used for set identifiers)"
  type        = string
}

variable "secondary_region" {
  description = "Secondary AWS region identifier (used for set identifiers)"
  type        = string
}

variable "primary_alb_dns_name" {
  description = "DNS name of the primary region ALB"
  type        = string
}

variable "primary_alb_zone_id" {
  description = "Route 53 hosted zone ID of the primary region ALB"
  type        = string
}

variable "secondary_alb_dns_name" {
  description = "DNS name of the secondary region ALB"
  type        = string
}

variable "secondary_alb_zone_id" {
  description = "Route 53 hosted zone ID of the secondary region ALB"
  type        = string
}

variable "health_check_path" {
  description = "Path probed by the Route 53 health checks"
  type        = string
  default     = "/health"
}

variable "health_check_port" {
  description = "Port probed by the Route 53 health checks"
  type        = number
  default     = 443
}

variable "health_check_type" {
  description = "Health check protocol (HTTP or HTTPS)"
  type        = string
  default     = "HTTPS"

  validation {
    condition     = contains(["HTTP", "HTTPS"], var.health_check_type)
    error_message = "health_check_type must be either HTTP or HTTPS."
  }
}

variable "health_check_interval" {
  description = "Seconds between Route 53 health check probes (10 or 30)"
  type        = number
  default     = 30
}

variable "health_check_failure_threshold" {
  description = "Number of consecutive failed probes before a region is marked unhealthy"
  type        = number
  default     = 3
}

variable "record_ttl_note" {
  description = "Alias records ignore TTL; documented here for clarity (Route 53 evaluates health every interval)"
  type        = string
  default     = "alias-evaluate-target-health"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
