variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "name" {
  description = "Logical name for this replication pairing (e.g. uploads, backups)"
  type        = string
}

variable "source_bucket_id" {
  description = "ID (name) of the source S3 bucket in the primary region"
  type        = string
}

variable "source_bucket_arn" {
  description = "ARN of the source S3 bucket in the primary region"
  type        = string
}

variable "destination_bucket_arn" {
  description = "ARN of the destination S3 bucket in the secondary region"
  type        = string
}

variable "destination_storage_class" {
  description = "Storage class for replicated objects in the destination bucket"
  type        = string
  default     = "STANDARD_IA"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
