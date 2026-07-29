import * as fs from 'fs';
import * as path from 'path';

describe('Prometheus Alerting Rules & Helm Chart', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const rulesPath = path.join(rootDir, 'charts/teachlink-backend/templates/prometheus-rules.yaml');
  const valuesPath = path.join(rootDir, 'charts/teachlink-backend/values.yaml');
  const runbooksPath = path.join(rootDir, 'docs/RUNBOOKS.md');

  it('prometheus-rules.yaml exists and contains required PrometheusRule CR structure', () => {
    expect(fs.existsSync(rulesPath)).toBe(true);
    const content = fs.readFileSync(rulesPath, 'utf8');

    expect(content).toContain('kind: PrometheusRule');
    expect(content).toContain('apiVersion: monitoring.coreos.com/v1');
    expect(content).toContain('.Values.prometheusRule.enabled');
  });

  it('defines HighErrorRate alert (>1% 5xx for 5m) with runbook link', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');

    expect(content).toContain('alert: HighErrorRate');
    expect(content).toContain('status_code=~"5.."');
    expect(content).toContain('> 1');
    expect(content).toContain('for: 5m');
    expect(content).toContain('#5-higherrorrate');
  });

  it('defines HighP99Latency alert (>1s for 10m) with runbook link', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');

    expect(content).toContain('alert: HighP99Latency');
    expect(content).toContain('histogram_quantile(');
    expect(content).toContain('0.99');
    expect(content).toContain('> 1');
    expect(content).toContain('for: 10m');
    expect(content).toContain('#6-highp99latency');
  });

  it('defines QueueDepthHigh alert (>1000 jobs for 10m) with runbook link', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');

    expect(content).toContain('alert: QueueDepthHigh');
    expect(content).toContain('queue_waiting_jobs');
    expect(content).toContain('> 1000');
    expect(content).toContain('for: 10m');
    expect(content).toContain('#7-queuedepthhigh');
  });

  it('defines DLQDepthHigh alert (>0 for 5m) with runbook link', () => {
    const content = fs.readFileSync(rulesPath, 'utf8');

    expect(content).toContain('alert: DLQDepthHigh');
    expect(content).toContain('> 0');
    expect(content).toContain('for: 5m');
    expect(content).toContain('#8-dlqdepthhigh');
  });

  it('charts/teachlink-backend/values.yaml includes prometheusRule and alertmanager settings', () => {
    expect(fs.existsSync(valuesPath)).toBe(true);
    const content = fs.readFileSync(valuesPath, 'utf8');

    expect(content).toContain('prometheusRule:');
    expect(content).toContain('enabled: true');
    expect(content).toContain('alertmanager:');
    expect(content).toContain('slackRoute:');
  });

  it('docs/RUNBOOKS.md documents all 4 alerting rules with mitigation steps', () => {
    expect(fs.existsSync(runbooksPath)).toBe(true);
    const content = fs.readFileSync(runbooksPath, 'utf8');

    expect(content).toContain('## 5. HighErrorRate');
    expect(content).toContain('## 6. HighP99Latency');
    expect(content).toContain('## 7. QueueDepthHigh');
    expect(content).toContain('## 8. DLQDepthHigh');
  });
});
