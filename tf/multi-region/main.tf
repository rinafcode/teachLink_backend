# Multi-Region Deployment & Failover
#
# Composes the existing single-region modules into an active (primary) /
# warm-standby (secondary) topology with:
#   - full stacks in two regions (networking, compute, storage, monitoring)
#   - a cross-region RDS read replica + standby Redis in the secondary region
#   - S3 cross-region replication for uploads and backups
#   - Route 53 health-check driven DNS failover
#
# See README.md and ../../dr/ for the operational runbooks.

locals {
  primary_prefix   = "${var.s3_bucket_prefix}-${replace(var.primary_region, "-", "")}"
  secondary_prefix = "${var.s3_bucket_prefix}-${replace(var.secondary_region, "-", "")}"
}

# ===========================================================================
# PRIMARY REGION (active)
# ===========================================================================
module "networking_primary" {
  source    = "../modules/networking"
  providers = { aws = aws.primary }

  vpc_cidr             = var.primary_vpc_cidr
  public_subnet_cidrs  = var.primary_public_subnet_cidrs
  private_subnet_cidrs = var.primary_private_subnet_cidrs
  availability_zones   = var.primary_availability_zones
  environment          = var.environment
  tags                 = var.tags
}

module "compute_primary" {
  source    = "../modules/compute"
  providers = { aws = aws.primary }

  cluster_name                = "${var.cluster_name}-primary"
  service_name                = "${var.service_name}-primary"
  task_cpu                    = var.task_cpu
  task_memory                 = var.task_memory
  desired_count               = var.primary_desired_count
  min_capacity                = var.primary_min_capacity
  max_capacity                = var.primary_max_capacity
  container_port              = var.container_port
  health_check_path           = var.health_check_path
  certificate_arn             = var.primary_certificate_arn
  container_image             = var.container_image
  private_subnet_ids          = module.networking_primary.private_subnet_ids
  public_subnet_ids           = module.networking_primary.public_subnet_ids
  alb_security_group_id       = module.networking_primary.alb_security_group_id
  ecs_tasks_security_group_id = module.networking_primary.ecs_tasks_security_group_id
  environment                 = var.environment
  aws_region                  = var.primary_region
  tags                        = var.tags
}

module "database_primary" {
  source = "../modules/database"
  providers = {
    aws    = aws.primary
    random = random
  }

  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage
  db_name                  = var.db_name
  redis_node_type          = var.redis_node_type
  redis_num_cache_nodes    = var.redis_num_cache_nodes
  private_subnet_ids       = module.networking_primary.private_subnet_ids
  rds_security_group_id    = module.networking_primary.rds_security_group_id
  redis_security_group_id  = module.networking_primary.redis_security_group_id
  environment              = var.environment
  tags                     = var.tags
}

module "storage_primary" {
  source    = "../modules/storage"
  providers = { aws = aws.primary }

  s3_bucket_prefix = local.primary_prefix
  environment      = var.environment
  tags             = var.tags
}

module "monitoring_primary" {
  source    = "../modules/monitoring"
  providers = { aws = aws.primary }

  environment       = var.environment
  aws_region        = var.primary_region
  cluster_name      = "${var.cluster_name}-primary"
  service_name      = "${var.service_name}-primary"
  alb_name          = module.compute_primary.alb_name
  enable_monitoring = var.enable_monitoring
  tags              = var.tags
}

# ===========================================================================
# SECONDARY REGION (warm standby / failover target)
# ===========================================================================
module "networking_secondary" {
  source    = "../modules/networking"
  providers = { aws = aws.secondary }

  vpc_cidr             = var.secondary_vpc_cidr
  public_subnet_cidrs  = var.secondary_public_subnet_cidrs
  private_subnet_cidrs = var.secondary_private_subnet_cidrs
  availability_zones   = var.secondary_availability_zones
  environment          = var.environment
  tags                 = var.tags
}

module "compute_secondary" {
  source    = "../modules/compute"
  providers = { aws = aws.secondary }

  cluster_name                = "${var.cluster_name}-secondary"
  service_name                = "${var.service_name}-secondary"
  task_cpu                    = var.task_cpu
  task_memory                 = var.task_memory
  desired_count               = var.secondary_desired_count
  min_capacity                = var.secondary_min_capacity
  max_capacity                = var.secondary_max_capacity
  container_port              = var.container_port
  health_check_path           = var.health_check_path
  certificate_arn             = var.secondary_certificate_arn
  container_image             = var.container_image
  private_subnet_ids          = module.networking_secondary.private_subnet_ids
  public_subnet_ids           = module.networking_secondary.public_subnet_ids
  alb_security_group_id       = module.networking_secondary.alb_security_group_id
  ecs_tasks_security_group_id = module.networking_secondary.ecs_tasks_security_group_id
  environment                 = var.environment
  aws_region                  = var.secondary_region
  tags                        = var.tags
}

module "storage_secondary" {
  source    = "../modules/storage"
  providers = { aws = aws.secondary }

  s3_bucket_prefix = local.secondary_prefix
  environment      = var.environment
  tags             = var.tags
}

module "monitoring_secondary" {
  source    = "../modules/monitoring"
  providers = { aws = aws.secondary }

  environment       = var.environment
  aws_region        = var.secondary_region
  cluster_name      = "${var.cluster_name}-secondary"
  service_name      = "${var.service_name}-secondary"
  alb_name          = module.compute_secondary.alb_name
  enable_monitoring = var.enable_monitoring
  tags              = var.tags
}

# Cross-region read replica + standby cache in the secondary region.
module "database_replica" {
  source    = "../modules/database-replica"
  providers = { aws = aws.secondary }

  environment             = var.environment
  source_db_arn           = module.database_primary.db_instance_arn
  db_instance_class       = var.db_instance_class
  private_subnet_ids      = module.networking_secondary.private_subnet_ids
  rds_security_group_id   = module.networking_secondary.rds_security_group_id
  redis_security_group_id = module.networking_secondary.redis_security_group_id
  redis_node_type         = var.redis_node_type
  redis_num_cache_nodes   = var.redis_num_cache_nodes
  tags                    = var.tags
}

# ===========================================================================
# DATA REPLICATION (S3 cross-region replication, primary -> secondary)
# ===========================================================================
module "replication_uploads" {
  source    = "../modules/replication"
  providers = { aws = aws.primary }

  environment            = var.environment
  name                   = "uploads"
  source_bucket_id       = module.storage_primary.uploads_bucket_id
  source_bucket_arn      = module.storage_primary.uploads_bucket_arn
  destination_bucket_arn = module.storage_secondary.uploads_bucket_arn
  tags                   = var.tags

  # Ensure versioning on both buckets is configured before attaching replication.
  depends_on = [module.storage_primary, module.storage_secondary]
}

module "replication_backups" {
  source    = "../modules/replication"
  providers = { aws = aws.primary }

  environment            = var.environment
  name                   = "backups"
  source_bucket_id       = module.storage_primary.backups_bucket_id
  source_bucket_arn      = module.storage_primary.backups_bucket_arn
  destination_bucket_arn = module.storage_secondary.backups_bucket_arn
  tags                   = var.tags

  # Ensure versioning on both buckets is configured before attaching replication.
  depends_on = [module.storage_primary, module.storage_secondary]
}

# ===========================================================================
# DNS FAILOVER (Route 53)
# NOTE: Route 53 health-check CloudWatch metrics are published to us-east-1,
# so the primary provider should target us-east-1 (the default).
# ===========================================================================
module "dns_failover" {
  source    = "../modules/dns-failover"
  providers = { aws = aws.primary }

  environment            = var.environment
  domain_name            = var.domain_name
  app_subdomain          = var.app_subdomain
  hosted_zone_id         = var.hosted_zone_id
  primary_region         = var.primary_region
  secondary_region       = var.secondary_region
  primary_alb_dns_name   = module.compute_primary.alb_dns_name
  primary_alb_zone_id    = module.compute_primary.alb_zone_id
  secondary_alb_dns_name = module.compute_secondary.alb_dns_name
  secondary_alb_zone_id  = module.compute_secondary.alb_zone_id
  health_check_path      = var.health_check_path
  health_check_port      = var.primary_certificate_arn != "" ? 443 : 80
  health_check_type      = var.primary_certificate_arn != "" ? "HTTPS" : "HTTP"
  tags                   = var.tags
}
