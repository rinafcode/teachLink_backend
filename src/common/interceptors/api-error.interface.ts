export interface IApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  /** Only populated in non-production environments */
  stack?: string;
  /** Structured validation errors, if applicable */
  details?: IValidationErrorDetail[];
}

export interface IValidationErrorDetail {
  field: string;
  constraints: Record<string, string>;
}
