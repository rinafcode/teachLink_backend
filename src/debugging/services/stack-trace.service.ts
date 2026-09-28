import { Injectable } from '@nestjs/common';
import { IEnhancedStackTrace, IStackFrame } from '../interfaces/debug.interfaces';

/**
 * Parses raw V8 stack strings into structured frames and flags which frames
 * belong to the application versus third-party / runtime code. This makes
 * error responses far easier to triage than a flat string.
 */
@Injectable()
export class StackTraceService {
  // Matches the two common V8 frame shapes:
  //   "at fnName (/path/file.ts:12:34)"
  //   "at /path/file.ts:12:34"
  private static readonly FRAME_WITH_FN = /^\s*at\s+(.+?)\s+\((.*?):(\d+):(\d+)\)$/;
  private static readonly FRAME_BARE = /^\s*at\s+(.*?):(\d+):(\d+)$/;

  /**
   * Build an enhanced trace from any thrown value. Follows the `cause` chain
   * so wrapped errors keep their original origin information.
   */
  enhance(error: unknown): IEnhancedStackTrace {
    if (!(error instanceof Error)) {
      return {
        name: 'NonError',
        message: typeof error === 'string' ? error : JSON.stringify(error),
        frames: [],
      };
    }

    const frames = this.parseFrames(error.stack ?? '');
    const origin = frames.find((f) => f.isApplicationCode);

    const enhanced: IEnhancedStackTrace = {
      name: error.name,
      message: error.message,
      frames,
      origin,
      raw: error.stack,
    };

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined && cause !== null) {
      enhanced.cause = this.enhance(cause);
    }

    return enhanced;
  }

  /** Parse the lines of a raw stack string into structured frames. */
  parseFrames(stack: string): IStackFrame[] {
    return stack
      .split('\n')
      .map((line) => this.parseLine(line))
      .filter((frame): frame is IStackFrame => frame !== null);
  }

  private parseLine(line: string): IStackFrame | null {
    let match = StackTraceService.FRAME_WITH_FN.exec(line);
    if (match) {
      return this.toFrame(match[1], match[2], Number(match[3]), Number(match[4]));
    }

    match = StackTraceService.FRAME_BARE.exec(line);
    if (match) {
      return this.toFrame('<anonymous>', match[1], Number(match[2]), Number(match[3]));
    }

    return null;
  }

  private toFrame(
    functionName: string,
    fileName: string,
    lineNumber: number,
    columnNumber: number,
  ): IStackFrame {
    const isNodeModule = fileName.includes('node_modules');
    const isInternal = fileName.startsWith('node:') || !fileName.includes('/');
    return {
      functionName,
      fileName,
      lineNumber,
      columnNumber,
      isNodeModule,
      // Application code is anything that is neither a dependency nor a Node
      // internal module.
      isApplicationCode: !isNodeModule && !isInternal,
    };
  }
}
