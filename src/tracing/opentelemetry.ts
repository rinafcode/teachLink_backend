import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';

const serviceName = process.env.SERVICE_NAME ?? 'teachlink-backend';
const jaegerHost = process.env.JAEGER_AGENT_HOST ?? 'localhost';
const jaegerPort = parseInt(process.env.JAEGER_AGENT_PORT ?? '6831', 10);

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  }),
  traceExporter: new JaegerExporter({
    host: jaegerHost,
    port: jaegerPort,
  }),
  textMapPropagator: new JaegerPropagator(),
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  diag.debug('OpenTelemetry SDK started');
} catch (error) {
  console.error('OpenTelemetry SDK failed to start', error);
}

process.on('SIGINT', () => {
  sdk.shutdown().catch((error) => {
    console.error('Error shutting down OpenTelemetry SDK', error);
  });
});

process.on('SIGTERM', () => {
  sdk.shutdown().catch((error) => {
    console.error('Error shutting down OpenTelemetry SDK', error);
  });
});
