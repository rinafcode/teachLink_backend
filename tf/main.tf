# Networking Module
module "networking" {
  source = "./modules/networking"

  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
  environment          = var.environment
  tags                 = var.tags
}

# Compute Module
module "compute" {
  source = "./modules/compute"

  cluster_name                = var.cluster_name
  service_name                = var.service_name
  task_cpu                    = var.task_cpu
  task_memory                 = var.task_memory
  desired_count               = var.desired_count
  min_capacity                = var.min_capacity
  max_capacity                = var.max_capacity
  container_port              = var.container_port
  health_check_path           = var.health_check_path
  certificate_arn             = var.certificate_arn
  container_image             = var.container_image
  private_subnet_ids          = module.networking.private_subnet_ids
  public_subnet_ids           = module.networking.public_subnet_ids
  alb_security_group_id       = module.networking.alb_security_group_id
  ecs_tasks_security_group_id = module.networking.ecs_tasks_security_group_id
  environment                 = var.environment
  aws_region                  = var.aws_region
  tags                        = var.tags
}

# Database Module
module "database" {
  source = "./modules/database"

  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage
  db_name                  = var.db_name
  redis_node_type          = var.redis_node_type
  redis_num_cache_nodes    = var.redis_num_cache_nodes
  private_subnet_ids       = module.networking.private_subnet_ids
  rds_security_group_id    = module.networking.rds_security_group_id
  redis_security_group_id  = module.networking.redis_security_group_id
  environment              = var.environment
  tags                     = var.tags
}

# Storage Module
module "storage" {
  source = "./modules/storage"

  s3_bucket_prefix = var.s3_bucket_prefix
  environment      = var.environment
  tags             = var.tags
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  environment       = var.environment
  aws_region        = var.aws_region
  cluster_name      = var.cluster_name
  service_name      = var.service_name
  alb_name          = module.compute.alb_name
  enable_monitoring = var.enable_monitoring
  tags              = var.tags
}
