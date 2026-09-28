# Main Notification Queue
resource "aws_sqs_queue" "notification_queue" {
  name                      = "teachlink-notifications-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400
  receive_wait_time_seconds = 10
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 5
  })
}

# Dead Letter Queue for Notifications
resource "aws_sqs_queue" "notification_dlq" {
  name = "teachlink-notifications-dlq-${var.environment}"
}

# Push Notification Queue
resource "aws_sqs_queue" "push_notification_queue" {
  name                      = "teachlink-push-notifications-${var.environment}"
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.push_notification_dlq.arn
    maxReceiveCount     = 5
  })
}

# Dead Letter Queue for Push Notifications
resource "aws_sqs_queue" "push_notification_dlq" {
  name = "teachlink-push-notifications-dlq-${var.environment}"
}
