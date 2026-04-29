# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "teachlink-${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db-subnet-group"
    },
    var.tags
  )
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "teachlink-${var.environment}-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = "admin"
  password = random_password.db_password.result

  vpc_security_group_ids = [var.rds_security_group_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  deletion_protection = false
  skip_final_snapshot = true

  multi_az = false

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db"
    },
    var.tags
  )
}

# Random password for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store RDS password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "teachlink-${var.environment}-db-password"

  tags = merge(
    {
      Name = "teachlink-${var.environment}-db-password"
    },
    var.tags
  )
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "teachlink-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    {
      Name = "teachlink-${var.environment}-redis-subnet-group"
    },
    var.tags
  )
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "teachlink-${var.environment}-redis"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.redis_security_group_id]

  tags = merge(
    {
      Name = "teachlink-${var.environment}-redis"
    },
    var.tags
  )
}
