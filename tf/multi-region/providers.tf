# Two aliased AWS providers drive the active-active/active-passive topology.
# Every module is instantiated once per region by passing the matching provider.

provider "aws" {
  alias  = "primary"
  region = var.primary_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "teachlink"
      ManagedBy   = "terraform"
      Topology    = "multi-region"
      Role        = "primary"
    }
  }
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "teachlink"
      ManagedBy   = "terraform"
      Topology    = "multi-region"
      Role        = "secondary"
    }
  }
}
