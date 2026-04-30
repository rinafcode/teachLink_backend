# Local backend configuration for testing
# This file is used for local development and testing
# For production, use the S3 backend configuration in backend.tf.example

terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
