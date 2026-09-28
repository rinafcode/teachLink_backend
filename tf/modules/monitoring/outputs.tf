output "cloudwatch_log_group_app" {
  description = "CloudWatch log group for application"
  value       = aws_cloudwatch_log_group.app.name
}

output "cloudwatch_log_group_alb" {
  description = "CloudWatch log group for ALB"
  value       = aws_cloudwatch_log_group.alb.name
}

output "cloudwatch_dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.environment}#dashboards:name=teachlink-${var.environment}-dashboard"
}
