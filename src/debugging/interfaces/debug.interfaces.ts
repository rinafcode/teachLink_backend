/**
 * Type definitions for the developer debugging toolkit.
 *
 * The toolkit captures HTTP traffic in-memory so developers can inspect,
 * replay and profile requests without an external APM. All structures are
 * intentionally serialisable so they can be returned verbatim over the wire.
 */

/** A single phase recorded on a request's performance timeline. */
export interface ITimelineSpan {
  /** Human readable phase name, e.g. "db.query" or "controller". */
  name: string;
  /** Milliseconds since the start of the request when the span opened. */
  startOffsetMs: number;
  /** Span duration in milliseconds. */
  durationMs: number;
  /** Optional free-form metadata captured with the span. */
  metadata?: Record<string, unknown>;
}

/** Aggregated performance timeline for one captured request. */
export interface IPerformanceTimeline {
  requestId: string;
  /** Total wall-clock time from request received to response sent. */
  totalDurationMs: number;
  spans: ITimelineSpan[];
}

/** Normalised representation of an enhanced error stack frame. */
export interface IStackFrame {
  functionName: string;
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
  /** True when the frame originates from the project's own source. */
  isApplicationCode: boolean;
  /** True when the frame lives under node_modules. */
  isNodeModule: boolean;
}

/** Enriched, structured view of an error and its stack trace. */
export interface IEnhancedStackTrace {
  name: string;
  message: string;
  frames: IStackFrame[];
  /** The single most likely culprit — first application frame. */
  origin?: IStackFrame;
  /** Original raw stack string, preserved for completeness. */
  raw?: string;
  /** Chained `cause` errors, recursively enhanced. */
  cause?: IEnhancedStackTrace;
}

/** Snapshot of an incoming request, suitable for inspection and replay. */
export interface ICapturedRequest {
  method: string;
  url: string;
  /** Path without query string. */
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
  /** Remote address as reported by the framework. */
  ip?: string;
}

/** Snapshot of the response produced for a captured request. */
export interface ICapturedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
}

/** A complete captured request/response exchange plus diagnostics. */
export interface IDebugRecord {
  id: string;
  /** Correlation id propagated from request headers when present. */
  correlationId?: string;
  timestamp: string;
  request: ICapturedRequest;
  response?: ICapturedResponse;
  timeline: IPerformanceTimeline;
  /** Present only when the request resulted in an error. */
  error?: IEnhancedStackTrace;
}

/** Result of replaying a previously captured request. */
export interface IReplayResult {
  /** The record that was replayed. */
  sourceId: string;
  /** Target the request was replayed against. */
  target: string;
  statusCode: number;
  durationMs: number;
  headers: Record<string, string>;
  body?: unknown;
  /** Differences between the original and replayed response, when available. */
  diff?: {
    statusChanged: boolean;
    originalStatus?: number;
    replayedStatus: number;
  };
}

/** Options controlling a replay. */
export interface IReplayOptions {
  /** Base URL to replay against. Defaults to the configured self target. */
  baseUrl?: string;
  /** Header overrides merged onto the captured headers. */
  headerOverrides?: Record<string, string>;
  /** Replacement body; when omitted the captured body is reused. */
  bodyOverride?: unknown;
}
