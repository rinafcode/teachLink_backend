export type LogMeta = Record<string, unknown>;

export interface SamplingConfig {
  firstN: number;
  thenEveryM: number;
}

interface SamplerEntry {
  count: number;
  logged: number;
}

const samplerMap = new Map<string, SamplerEntry>();
const MAX_SAMPLER_ENTRIES = 1000;

const DEFAULT_SAMPLING: SamplingConfig = {
  firstN: 5,
  thenEveryM: 10,
};

let _samplingConfig: SamplingConfig = { ...DEFAULT_SAMPLING };

export function configureSampling(config: Partial<SamplingConfig>): void {
  if (config.firstN !== undefined) _samplingConfig.firstN = config.firstN;
  if (config.thenEveryM !== undefined) _samplingConfig.thenEveryM = config.thenEveryM;
}

export function resetSampler(): void {
  samplerMap.clear();
}

export function getSamplerState(): ReadonlyMap<string, Readonly<SamplerEntry>> {
  return samplerMap as ReadonlyMap<string, Readonly<SamplerEntry>>;
}

function getSamplerKey(args: unknown[]): string | null {
  for (const arg of args) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
  }
  return null;
}

function evictSamplerIfNeeded(): void {
  if (samplerMap.size >= MAX_SAMPLER_ENTRIES) {
    const keysToDelete = Array.from(samplerMap.keys()).slice(0, Math.floor(MAX_SAMPLER_ENTRIES / 2));
    for (const key of keysToDelete) samplerMap.delete(key);
  }
}

function timestamp(): string {
  return new Date().toISOString();
}

function safeSerialize(arg: unknown): unknown {
  if (arg instanceof Error) {
    return { message: arg.message, stack: arg.stack };
  }
  return arg;
}

function formatStructured(level: string, service: string, args: unknown[], meta: LogMeta = {}) {
  const msgParts: unknown[] = Array.prototype.slice.call(args);
  const message = typeof msgParts[0] === 'string' ? msgParts.shift() : undefined;
  const extra = msgParts.length === 1 ? safeSerialize(msgParts[0]) : msgParts.map(safeSerialize);

  const out: Record<string, unknown> = {
    timestamp: timestamp(),
    level,
    service,
    pid: process.pid,
  };

  if (message) out.message = message;
  if (meta && Object.keys(meta).length > 0) out.meta = meta;
  if (
    extra !== undefined &&
    (Array.isArray(extra) ? extra.length > 0 : Object.keys((extra as any) || {}).length > 0)
  ) {
    out.data = extra;
  }

  try {
    return JSON.stringify(out);
  } catch (_err) {
    return JSON.stringify({
      timestamp: timestamp(),
      level,
      service,
      pid: process.pid,
      message: 'failed to stringify log',
    });
  }
}

function formatWithSampling(
  level: string,
  service: string,
  args: unknown[],
  originalFn: (...args: unknown[]) => void,
): void {
  if (level !== 'error') {
    originalFn(formatStructured(level, service, args));
    return;
  }

  const key = getSamplerKey(args);
  if (key === null) {
    originalFn(formatStructured(level, service, args));
    return;
  }

  let entry = samplerMap.get(key);
  if (!entry) {
    entry = { count: 0, logged: 0 };
    samplerMap.set(key, entry);
  }
  entry.count++;

  const { firstN, thenEveryM } = _samplingConfig;
  const shouldLog = entry.count <= firstN || (entry.count - firstN) % thenEveryM === 0;

  if (shouldLog) {
    entry.logged++;
    evictSamplerIfNeeded();
    const msgParts: unknown[] = Array.prototype.slice.call(args);
    const message = typeof msgParts[0] === 'string' ? msgParts.shift() : undefined;
    const extra = msgParts.length === 1 ? safeSerialize(msgParts[0]) : msgParts.map(safeSerialize);

    const out: Record<string, unknown> = {
      timestamp: timestamp(),
      level,
      service,
      pid: process.pid,
      occurrenceCount: entry.count,
    };

    if (message) out.message = message;
    if (extra !== undefined && (Array.isArray(extra) ? extra.length > 0 : Object.keys((extra as any) || {}).length > 0)) {
      out.data = extra;
    }
    if (entry.count > firstN) out.sampled = true;

    try {
      originalFn(JSON.stringify(out));
    } catch (_err) {
      originalFn(
        JSON.stringify({
          timestamp: timestamp(),
          level,
          service,
          pid: process.pid,
          message: 'failed to stringify log',
        }),
      );
    }
  }
}

let _serviceName = 'teachlink-backend';

/* eslint-disable no-console */
export function initStructuredLogging(serviceName?: string, samplingConfig?: Partial<SamplingConfig>): void {
  if (serviceName) _serviceName = serviceName;
  if (samplingConfig) configureSampling(samplingConfig);

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug ? console.debug.bind(console) : originalLog;

  console.log = function log(...args: unknown[]) {
    originalLog(formatStructured('info', _serviceName, args));
  } as typeof console.log;

  console.info = function info(...args: unknown[]) {
    originalInfo(formatStructured('info', _serviceName, args));
  } as typeof console.info;

  console.warn = function warn(...args: unknown[]) {
    originalWarn(formatStructured('warn', _serviceName, args));
  } as typeof console.warn;

  console.error = function error(...args: unknown[]) {
    formatWithSampling('error', _serviceName, args, originalError);
  } as typeof console.error;

  console.debug = function debug(...args: unknown[]) {
    originalDebug(formatStructured('debug', _serviceName, args));
  } as typeof console.debug;

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException', { error: safeSerialize(err) });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection', { reason: safeSerialize(reason) });
  });
}
/* eslint-enable no-console */

export function buildLogObject(level: string, message: string, meta: LogMeta = {}) {
  return JSON.parse(formatStructured(level, _serviceName, [message], meta));
}
