variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

# ---------------------------------------------------------------------------
# Regions
# ---------------------------------------------------------------------------
variable "primary_region" {
  description = "Primary AWS region (active)"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region (standby / failover target)"
  type        = string
  default     = "us-west-2"
}

variable "primary_availability_zones" {
  description = "Availability zones in the primary region"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "secondary_availability_zones" {
  description = "Availability zones in the secondary region"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b"]
}

# ---------------------------------------------------------------------------
# Networking (distinct CIDRs per region so VPCs can be peered if needed)
# ---------------------------------------------------------------------------
variable "primary_vpc_cidr" {
  description = "VPC CIDR for the primary region"
  type        = string
  default     = "10.0.0.0/16"
}

variable "secondary_vpc_cidr" {
  description = "VPC CIDR for the secondary region"
  type        = string
  default     = "10.1.0.0/16"
}

variable "primary_public_subnet_cidrs" {
  description = "Public subnet CIDRs in the primary region"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "primary_private_subnet_cidrs" {
  description = "Private subnet CIDRs in the primary region"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "secondary_public_subnet_cidrs" {
  description = "Public subnet CIDRs in the secondary region"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24"]
}

variable "secondary_private_subnet_cidrs" {
  description = "Private subnet CIDRs in the secondary region"
  type        = list(string)
  default     = ["10.1.10.0/24", "10.1.11.0/24"]
}

# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------
variable "cluster_name" {
  description = "ECS cluster name (suffixed per region)"
  type        = string
  default     = "teachlink-cluster"
}

variable "service_name" {
  description = "ECS service name (suffixed per region)"
  type        = string
  default     = "teachlink-service"
}

variable "task_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memory (MB) for ECS task"
  type        = number
  default     = 512
}

variable "container_port" {
  description = "Container port for the application"
  type        = number
  default     = 3000
}

variable "container_image" {
  description = "Container image deployed to both regions"
  type        = string
  default     = "nginx:latest"
}

variable "health_check_path" {
  description = "Application health check path"
  type        = string
  default     = "/health"
}

variable "primary_certificate_arn" {
  description = "ACM certificate ARN in the primary region (for HTTPS)"
  type        = string
  default     = ""
}

variable "secondary_certificate_arn" {
  description = "ACM certificate ARN in the secondary region (for HTTPS)"
  type        = string
  default     = ""
}

# Primary region runs the active fleet.
variable "primary_desired_count" {
  description = "Desired ECS task count in the primary region"
  type        = number
  default     = 3
}

variable "primary_min_capacity" {
  description = "Minimum ECS task count in the primary region"
  type        = number
  default     = 3
}

variable "primary_max_capacity" {
  description = "Maximum ECS task count in the primary region"
  type        = number
  default     = 20
}

# Secondary region runs warm-standby capacity. Set desired/min > 0 for an
# active-active hot-standby, or keep low for a cost-efficient pilot-light.
variable "secondary_desired_count" {
  description = "Desired ECS task count in the secondary region (standby)"
  type        = number
  default     = 1
}

variable "secondary_min_capacity" {
  description = "Minimum ECS task count in the secondary region"
  type        = number
  default     = 1
}

variable "secondary_max_capacity" {
  description = "Maximum ECS task count in the secondary region (for failover scale-up)"
  type        = number
  default     = 20
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "teachlink_db"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes per region"
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
variable "s3_bucket_prefix" {
  description = "Base prefix for S3 bucket names; the region is appended to keep names globally unique"
  type        = string
  default     = "teachlink"
}

# ---------------------------------------------------------------------------
# DNS failover
# ---------------------------------------------------------------------------
variable "domain_name" {
  description = "Root domain managed in Route 53 (e.g. teachlink.io)"
  type        = string
}

variable "app_subdomain" {
  description = "Subdomain that fails over between regions"
  type        = string
  default     = "api"
}

variable "hosted_zone_id" {
  description = "Existing Route 53 hosted zone ID. Leave empty to create a new public zone."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
variable "enable_monitoring" {
  description = "Enable detailed CloudWatch monitoring in both regions"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}
