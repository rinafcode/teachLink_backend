export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  details?: ValidationErrorDetail[];
  timestamp?: string;
  path?: string;
  stack?: string;
}

export interface ValidationErrorDetail {
  property: string;
  constraints: string[] | Record<string, string>;
}
