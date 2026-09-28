export interface IApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  details?: IValidationErrorDetail[];
  timestamp?: string;
  path?: string;
  correlationId?: string;
  stack?: string;
}

export interface IValidationErrorDetail {
  property: string;
  constraints: string[] | Record<string, string>;
}
