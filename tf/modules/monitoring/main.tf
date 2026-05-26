# CloudWatch Log Groups for ECS
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ecs/teachlink-${var.environment}-app"
  retention_in_days = var.enable_monitoring ? 30 : 7

  tags = merge(
    {
      Name = "teachlink-${var.environment}-app-log-group"
    },
    var.tags
  )
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/aws/alb/teachlink-${var.environment}-alb"
  retention_in_days = var.enable_monitoring ? 30 : 7

  tags = merge(
    {
      Name = "teachlink-${var.environment}-alb-log-group"
    },
    var.tags
  )
}

# CloudWatch Metric Alarms for ECS
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "teachlink-${var.environment}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-ecs-cpu-high"
    },
    var.tags
  )
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "teachlink-${var.environment}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = var.service_name
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-ecs-memory-high"
    },
    var.tags
  )
}

# CloudWatch Metric Alarms for ALB
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "teachlink-${var.environment}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ALB 5XX errors"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    LoadBalancer = var.alb_name
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-alb-5xx-errors"
    },
    var.tags
  )
}

resource "aws_cloudwatch_metric_alarm" "alb_target_5xx_errors" {
  alarm_name          = "teachlink-${var.environment}-alb-target-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ALB target 5XX errors"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    LoadBalancer = var.alb_name
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-alb-target-5xx-errors"
    },
    var.tags
  )
}

# CloudWatch Metric Alarms for RDS (using metric math for dynamic DB instance)
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "teachlink-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    DBInstanceIdentifier = "teachlink-${var.environment}-db"
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-rds-cpu-high"
    },
    var.tags
  )
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "teachlink-${var.environment}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = 10737418240 # 10 GB in bytes
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = [] # Add SNS topic ARN here

  dimensions = {
    DBInstanceIdentifier = "teachlink-${var.environment}-db"
  }

  tags = merge(
    {
      Name = "teachlink-${var.environment}-rds-free-storage-low"
    },
    var.tags
  )
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "teachlink-${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.cluster_name, "ServiceName", var.service_name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Service Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_name]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "ALB Request Count"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "teachlink-${var.environment}-db"],
            [".", "FreeStorageSpace", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      }
    ]
  })
}
