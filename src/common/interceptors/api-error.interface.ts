export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  /** Only populated in non-production environments */
  stack?: string;
  /** Structured validation errors, if applicable */
  details?: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  constraints: Record<string, string>;
}