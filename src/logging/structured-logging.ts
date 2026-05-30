export type LogMeta = Record<string, unknown>;

function timestamp(): string {
  return new Date().toISOString();
}

function safeSerialize(arg: unknown): unknown {
  if (arg instanceof Error) {
    return { message: arg.message, stack: arg.stack };
  }
  return arg;
}

function formatStructured(level: string, service: string, args: IArguments, meta: LogMeta = {}) {
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
  if (extra !== undefined && (Array.isArray(extra) ? extra.length > 0 : Object.keys((extra as any) || {}).length > 0)) {
    out.data = extra;
  }

  try {
    return JSON.stringify(out);
  } catch (err) {
    return JSON.stringify({ timestamp: timestamp(), level, service, pid: process.pid, message: 'failed to stringify log' });
  }
}

let _serviceName = 'teachlink-backend';

export function initStructuredLogging(serviceName?: string): void {
  if (serviceName) _serviceName = serviceName;

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug ? console.debug.bind(console) : originalLog;

  console.log = function log() {
    originalLog(formatStructured('info', _serviceName, arguments));
  } as typeof console.log;

  console.info = function info() {
    originalInfo(formatStructured('info', _serviceName, arguments));
  } as typeof console.info;

  console.warn = function warn() {
    originalWarn(formatStructured('warn', _serviceName, arguments));
  } as typeof console.warn;

  console.error = function error() {
    originalError(formatStructured('error', _serviceName, arguments));
  } as typeof console.error;

  console.debug = function debug() {
    originalDebug(formatStructured('debug', _serviceName, arguments));
  } as typeof console.debug;

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException', { error: safeSerialize(err) });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection', { reason: safeSerialize(reason) });
  });
}

export function buildLogObject(level: string, message: string, meta: LogMeta = {}) {
  return JSON.parse(formatStructured(level, _serviceName, [message], meta));
}
