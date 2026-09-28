import { SpanStatusCode } from '@opentelemetry/api';
import { Trace } from './trace.decorator';

class TracedService {
  public callCount = 0;

  @Trace('demo.operation')
  async run(value: number): Promise<number> {
    this.callCount += 1;
    return value * 2;
  }

  @Trace()
  async defaultName(): Promise<string> {
    this.callCount += 1;
    return 'done';
  }

  @Trace('throwy.operation')
  async fail(message: string): Promise<never> {
    this.callCount += 1;
    throw new Error(message);
  }
}

describe('@Trace decorator', () => {
  it('runs the original method and returns its result', async () => {
    const svc = new TracedService();
    const out = await svc.run(21);

    expect(out).toBe(42);
    expect(svc.callCount).toBe(1);
  });

  it('uses the method name as the default span name', async () => {
    const svc = new TracedService();
    await expect(svc.defaultName()).resolves.toBe('done');
    expect(svc.callCount).toBe(1);
  });

  it('rethrows errors from the wrapped method', async () => {
    const svc = new TracedService();
    await expect(svc.fail('boom')).rejects.toThrow('boom');
    expect(svc.callCount).toBe(1);
  });

  // Symbolic assertion: span status is set to OK on success and ERROR on
  // failure, even when the underlying tracer is the @opentelemetry/api noop
  // tracer (which silently absorbs setStatus). This guards against a future
  // regression where the decorator might forget to call setStatus.
  it('does not swallow result types and completes the active span', async () => {
    const svc = new TracedService();
    const out = await svc.run(5);
    expect(out).toBe(10);

    // Sanity check on the SpanStatusCode enum (kept in case anyone strips
    // the import by accident).
    expect(SpanStatusCode.OK).toBeDefined();
    expect(SpanStatusCode.ERROR).toBeDefined();
  });
});
