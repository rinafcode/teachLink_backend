# Database Replica Module (secondary region)
#
# Provisions a cross-region RDS read replica of the primary database plus a
# warm-standby Redis cluster. The read replica continuously streams changes
# from the primary, giving an RPO measured in seconds. On failover it is
# promoted to a standalone read/write primary (see dr/runbooks/region-outage.md).
#
# Instantiate this module with the secondary-region provider.

# Subnet group for the replica in the secondary region.
resource "aws_db_subnet_group" "replica" {
  name       = "teachlink-${var.environment}-db-replica-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db-replica-subnet-group"
    },
    var.tags
  )
}

# KMS key for encrypting the replica's storage in the secondary region.
# Cross-region replicas of an encrypted source require a destination-region key.
resource "aws_kms_key" "replica" {
  description             = "teachlink-${var.environment} RDS replica encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db-replica-kms"
    },
    var.tags
  )
}

resource "aws_kms_alias" "replica" {
  name          = "alias/teachlink-${var.environment}-db-replica"
  target_key_id = aws_kms_key.replica.key_id
}

# Cross-region read replica of the primary database.
resource "aws_db_instance" "replica" {
  identifier          = "teachlink-${var.environment}-db-replica"
  instance_class      = var.db_instance_class
  replicate_source_db = var.source_db_arn

  db_subnet_group_name   = aws_db_subnet_group.replica.name
  vpc_security_group_ids = [var.rds_security_group_id]

  storage_encrypted = true
  kms_key_id        = aws_kms_key.replica.arn

  # A replica must keep automated backups so it can itself be promoted/replicated.
  backup_retention_period = 7

  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Replicas cannot set master credentials or db_name (inherited from source).
  skip_final_snapshot = true
  deletion_protection = false

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db-replica"
      Role = "read-replica"
    },
    var.tags
  )
}

# Standby Redis cluster (warmed on failover; cache data is non-durable).
resource "aws_elasticache_subnet_group" "standby" {
  name       = "teachlink-${var.environment}-redis-standby-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    {
      Name = "teachlink-${var.environment}-redis-standby-subnet-group"
    },
    var.tags
  )
}

resource "aws_elasticache_cluster" "standby" {
  cluster_id           = "teachlink-${var.environment}-redis-standby"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.standby.name
  security_group_ids   = [var.redis_security_group_id]

  tags = merge(
    {
      Name = "teachlink-${var.environment}-redis-standby"
    },
    var.tags
  )
}
