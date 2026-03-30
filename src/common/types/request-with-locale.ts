import { Request } from 'express';

export type RequestWithLocale = Request & { resolvedLocale?: string };
