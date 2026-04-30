# TeachLink Infrastructure as Code (IaC)

This directory contains the Terraform configuration for the TeachLink application infrastructure. It provides a complete Infrastructure as Code (IaC) setup to automate cloud resource provisioning across multiple environments.

## 📋 Overview

The Terraform configuration is organized into reusable modules that manage different aspects of the infrastructure:

- **Networking**: VPC, subnets, security groups, NAT gateways
- **Compute**: ECS cluster, Fargate tasks, Application Load Balancer, auto-scaling
- **Database**: RDS PostgreSQL, ElastiCache Redis
- **Storage**: S3 buckets for uploads and backups
- **Monitoring**: CloudWatch logs, metrics, alarms, and dashboards

## 🚀 Quick Start

### Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- An S3 bucket for Terraform state storage (for production environments)
- A DynamoDB table for state locking (for production environments)

### Initial Setup

1. **Configure AWS Credentials**

   ```bash
   aws configure
   ```

2. **Create State Management Resources (Production)**

   For production environments, you should create the S3 bucket and DynamoDB table manually first:

   ```bash
   # Create S3 bucket for Terraform state
   aws s3api create-bucket \
     --bucket teachlink-terraform-state \
     --region us-east-1

   # Enable versioning
   aws s3api put-bucket-versioning \
     --bucket teachlink-terraform-state \
     --versioning-configuration Status=Enabled

   # Create DynamoDB table for state locking
   aws dynamodb create-table \
     --table-name teachlink-terraform-state-lock \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

3. **Initialize Terraform**

   ```bash
   cd tf
   terraform init
   ```

4. **Configure Environment Variables**

   Copy the example configuration file and update it with your values:

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your configuration
   ```

5. **Plan and Apply**

   ```bash
   # Review what will be created
   terraform plan

   # Apply the configuration
   terraform apply
   ```

## 📁 Directory Structure

```
tf/
├── versions.tf              # Terraform version and provider requirements
├── providers.tf             # AWS provider and backend configuration
├── variables.tf             # Input variables
├── terraform.tfvars.example # Example variable values
├── main.tf                  # Module orchestration
├── outputs.tf               # Output values
├── modules/                 # Reusable Terraform modules
│   ├── networking/          # VPC, subnets, security groups
│   │   ├── variables.tf
│   │   ├── main.tf
│   │   └── outputs.tf
│   ├── compute/             # ECS, ALB, auto-scaling
│   │   ├── variables.tf
│   │   ├── main.tf
│   │   └── outputs.tf
│   ├── database/            # RDS, Redis
│   │   ├── variables.tf
│   │   ├── main.tf
│   │   └── outputs.tf
│   ├── storage/             # S3 buckets
│   │   ├── variables.tf
│   │   ├── main.tf
│   │   └── outputs.tf
│   └── monitoring/          # CloudWatch, alarms, dashboards
│       ├── variables.tf
│       ├── main.tf
│       └── outputs.tf
└── environments/            # Environment-specific configurations
    ├── dev/
    ├── staging/
    └── prod/
```

## 🔧 Configuration

### Variables

Key variables that can be configured in `terraform.tfvars`:

| Variable               | Description                           | Default           |
| ---------------------- | ------------------------------------- | ----------------- |
| `environment`          | Environment name (dev, staging, prod) | -                 |
| `aws_region`           | AWS region                            | us-east-1         |
| `vpc_cidr`             | VPC CIDR block                        | 10.0.0.0/16       |
| `cluster_name`         | ECS cluster name                      | teachlink-cluster |
| `task_cpu`             | CPU units for ECS task                | 256               |
| `task_memory`          | Memory for ECS task (MB)              | 512               |
| `desired_count`        | Desired number of tasks               | 2                 |
| `min_capacity`         | Minimum auto-scaling capacity         | 2                 |
| `max_capacity`         | Maximum auto-scaling capacity         | 10                |
| `db_instance_class`    | RDS instance class                    | db.t3.micro       |
| `db_allocated_storage` | RDS storage (GB)                      | 20                |
| `redis_node_type`      | ElastiCache node type                 | cache.t3.micro    |
| `enable_monitoring`    | Enable detailed monitoring            | true              |

### Backend Configuration

The Terraform state is configured to use remote backend with S3 and DynamoDB:

```hcl
terraform {
  backend "s3" {
    bucket         = "<your-state-bucket>"
    key            = "terraform/teachlink-<env>/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "<your-lock-table>"
    encrypt        = true
  }
}
```

For local development, a separate `tf/backend.local.tf` file is provided to keep state on disk without affecting remote backends.

For production or shared environments, copy `tf/backend.tf.example` to `tf/backend.tf` and update the bucket name, key, region, and DynamoDB table.

For development environments, you can use local state by not specifying remote backend configuration.

## 📊 Outputs

After applying, Terraform will output important values:

- **VPC and Subnets**: VPC ID, subnet IDs
- **Load Balancer**: ALB DNS name, URL
- **ECS**: Cluster ID, service name, task definition
- **Database**: RDS endpoint, Redis endpoint
- **Storage**: S3 bucket names and ARNs
- **Monitoring**: CloudWatch dashboard URL

## 🔐 Security

- All data at rest is encrypted (EBS, RDS, S3)
- Database passwords are stored in AWS Secrets Manager
- Security groups follow the principle of least privilege
- Private subnets for application and database tiers
- Public access blocks on S3 buckets
- SSL/TLS support via ACM certificates

## 📈 Auto-scaling

The ECS service is configured with auto-scaling based on:

- CPU utilization (target: 70%)
- Memory utilization (target: 70%)

Scale-out cooldown: 300 seconds  
Scale-in cooldown: 300 seconds

## 🔍 Monitoring

CloudWatch monitoring includes:

- Application and ALB log groups
- CPU and memory utilization alarms
- ALB 5XX error rate alarms
- RDS CPU and storage alarms
- Custom CloudWatch dashboard

## 🔄 Common Operations

### Plan Changes

```bash
terraform plan -var-file="terraform.tfvars"
```

### Apply Changes

```bash
terraform apply -var-file="terraform.tfvars"
```

### Destroy Infrastructure

```bash
terraform destroy -var-file="terraform.tfvars"
```

### Update Specific Module

```bash
terraform apply -target=module.compute -var-file="terraform.tfvars"
```

### View State

```bash
terraform state list
terraform state show module.compute.aws_ecs_cluster.main
```

## 📝 Best Practices

1. **Always run `terraform plan` before `terraform apply`**
2. **Use version control for all Terraform files**
3. **Store sensitive values in environment variables or Secrets Manager**
4. **Use workspaces for different environments**
5. **Review changes carefully before applying**
6. **Keep modules small and focused**
7. **Document all variables and outputs**
8. **Use consistent naming conventions**

## 🚨 Troubleshooting

### State Lock Issues

If you encounter state lock issues:

```bash
terraform force-unlock <LOCK_ID>
```

### Provider Issues

If AWS provider has issues:

```bash
terraform init -upgrade
```

### Import Existing Resources

To import existing resources into Terraform state:

```bash
terraform import aws_vpc.main vpc-12345678
```

## 📚 Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [ECS Fargate Best Practices](https://aws.amazon.com/blogs/containers/)

## 🔗 Related Documentation

- [TeachLink Architecture Overview](../../docs/)
- [Disaster Recovery Plan](../../docs/disaster-recovery.md)
- [Monitoring Dashboard](../../docs/monitoring-dashboard.md)

## 🤝 Contributing

When making changes to the Terraform configuration:

1. Update the relevant module
2. Test in a development environment first
3. Document any new variables or outputs
4. Update this README if necessary
5. Create a pull request with `Close #428` in the description

## 📄 License

This infrastructure code is part of the TeachLink project.
