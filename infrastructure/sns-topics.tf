resource "aws_sns_topic" "notifications" {
  name = "teachlink-notifications-${var.environment}"
}

resource "aws_sns_topic_subscription" "email_queue_subscription" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notification_queue.arn
}

resource "aws_sns_topic_subscription" "push_queue_subscription" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.push_notification_queue.arn
}
