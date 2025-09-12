import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';

// Custom exceptions for specific business logic
export class ScalingOperationException extends BadRequestException {
  constructor(operation: string, reason: string) {
    super(`Scaling operation '${operation}' failed: ${reason}`);
  }
}

export class InvalidScalingRequestException extends BadRequestException {
  constructor(containerId: string, reason: string) {
    super(`Invalid scaling request for container '${containerId}': ${reason}`);
  }
}

export class InsufficientPermissionsException extends ForbiddenException {
  constructor(userId: string, operation: string) {
    super(
      `User '${userId}' has insufficient permissions for operation '${operation}'`,
    );
  }
}

export class ContainerNotFoundException extends NotFoundException {
  constructor(containerId: string) {
    super(`Container with ID '${containerId}' not found`);
  }
}

export class DeploymentFailedException extends InternalServerErrorException {
  constructor(containerId: string, reason: string) {
    super(`Deployment failed for container '${containerId}': ${reason}`);
  }
}

export class RateLimitExceededException extends ForbiddenException {
  constructor(userId: string, endpoint: string) {
    super(`Rate limit exceeded for user '${userId}' on endpoint '${endpoint}'`);
  }
}

export class CacheOperationException extends InternalServerErrorException {
  constructor(operation: string, key: string, reason: string) {
    super(`Cache operation '${operation}' failed for key '${key}': ${reason}`);
  }
}

export class MetricsCollectionException extends InternalServerErrorException {
  constructor(metric: string, reason: string) {
    super(`Failed to collect metric '${metric}': ${reason}`);
  }
}

export class EmbeddingModelException extends ServiceUnavailableException {
  constructor(model: string, reason: string) {
    super(`Embedding model '${model}' unavailable: ${reason}`);
  }
}

export class SearchOperationException extends BadRequestException {
  constructor(query: string, reason: string) {
    super(`Search operation failed for query '${query}': ${reason}`);
  }
}

export class PaymentProcessingException extends BadRequestException {
  constructor(paymentId: string, reason: string) {
    super(`Payment processing failed for '${paymentId}': ${reason}`);
  }
}

export class NotificationDeliveryException extends InternalServerErrorException {
  constructor(userId: string, type: string, reason: string) {
    super(
      `Failed to deliver ${type} notification to user '${userId}': ${reason}`,
    );
  }
}
