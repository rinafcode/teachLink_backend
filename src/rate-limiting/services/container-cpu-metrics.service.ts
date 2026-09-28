import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as os from 'os';

interface CpuStatSnapshot {
  usageUsec: number;
  nrPeriods: number;
  nrThrottled: number;
  timestampMs: number;
}

interface ProcessCpuSnapshot {
  cpuSecondsTotal: number;
  timestampMs: number;
}

/**
 * Reads container-aware CPU metrics with ordered fallbacks:
 * 1) cgroups v2 cpu.stat (container-level)
 * 2) Prometheus process_cpu_seconds_total scrape (optional)
 * 3) host loadavg (last resort)
 */
@Injectable()
export class ContainerCpuMetricsService {
  private readonly logger = new Logger(ContainerCpuMetricsService.name);
  private readonly cpuStatPath = '/sys/fs/cgroup/cpu.stat';
  private previousCpuStatSnapshot?: CpuStatSnapshot;
  private previousProcessCpuSnapshot?: ProcessCpuSnapshot;

  async getCpuLoadRatio(): Promise<number> {
    const cgroupRatio = this.getCgroupCpuLoadRatio();
    if (cgroupRatio !== null) {
      return cgroupRatio;
    }

    const prometheusRatio = await this.getPrometheusCpuLoadRatio();
    if (prometheusRatio !== null) {
      return prometheusRatio;
    }

    return this.getLoadAvgRatio();
  }

  private getCgroupCpuLoadRatio(): number | null {
    try {
      const cpuStat = readFileSync(this.cpuStatPath, 'utf8');
      const usageUsec = this.readMetric(cpuStat, 'usage_usec');
      const nrPeriods = this.readMetric(cpuStat, 'nr_periods');
      const nrThrottled = this.readMetric(cpuStat, 'nr_throttled');

      if (usageUsec === null || nrPeriods === null || nrThrottled === null) {
        return null;
      }

      const current: CpuStatSnapshot = {
        usageUsec,
        nrPeriods,
        nrThrottled,
        timestampMs: Date.now(),
      };

      const throttleRatio = nrPeriods > 0 ? this.clamp(nrThrottled / nrPeriods) : 0;
      const cpuCount = Math.max(1, os.cpus().length);

      if (!this.previousCpuStatSnapshot) {
        this.previousCpuStatSnapshot = current;
        return throttleRatio;
      }

      const elapsedUsec = (current.timestampMs - this.previousCpuStatSnapshot.timestampMs) * 1000;
      const deltaUsageUsec = current.usageUsec - this.previousCpuStatSnapshot.usageUsec;
      this.previousCpuStatSnapshot = current;

      if (elapsedUsec <= 0 || deltaUsageUsec < 0) {
        return throttleRatio;
      }

      const usageRatio = this.clamp(deltaUsageUsec / elapsedUsec / cpuCount);
      return Math.max(usageRatio, throttleRatio);
    } catch {
      return null;
    }
  }

  private async getPrometheusCpuLoadRatio(): Promise<number | null> {
    const url = process.env.PROMETHEUS_METRICS_URL;
    if (!url) {
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Prometheus metrics scrape failed: status=${response.status}`);
        return null;
      }

      const metricsText = await response.text();
      const cpuSecondsTotal = this.readPrometheusProcessCpuSeconds(metricsText);
      if (cpuSecondsTotal === null) {
        return null;
      }

      const current: ProcessCpuSnapshot = { cpuSecondsTotal, timestampMs: Date.now() };
      const cpuCount = Math.max(1, os.cpus().length);

      if (!this.previousProcessCpuSnapshot) {
        this.previousProcessCpuSnapshot = current;
        return null;
      }

      const elapsedSeconds =
        (current.timestampMs - this.previousProcessCpuSnapshot.timestampMs) / 1000;
      const deltaCpuSeconds =
        current.cpuSecondsTotal - this.previousProcessCpuSnapshot.cpuSecondsTotal;
      this.previousProcessCpuSnapshot = current;

      if (elapsedSeconds <= 0 || deltaCpuSeconds < 0) {
        return null;
      }

      return this.clamp(deltaCpuSeconds / elapsedSeconds / cpuCount);
    } catch {
      return null;
    }
  }

  private getLoadAvgRatio(): number {
    const load = os.loadavg()[0];
    const cpuCount = Math.max(1, os.cpus().length);
    return this.clamp(load / cpuCount);
  }

  private readMetric(content: string, key: string): number | null {
    const match = content.match(new RegExp(`^${key}\\s+(\\d+)`, 'm'));
    if (!match) return null;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readPrometheusProcessCpuSeconds(metricsText: string): number | null {
    const match = metricsText.match(
      /^process_cpu_seconds_total(?:\{[^}]*\})?\s+([0-9]+(?:\.[0-9]+)?)$/m,
    );
    if (!match) return null;

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
}
