import { Injectable } from '@nestjs/common';

@Injectable()
export class GeoRoutingService {
  private readonly regionMap: Record<string, string> = {
    EU: 'eu-cluster',
    US: 'us-cluster',
    AS: 'asia-cluster',
    default: 'us-cluster',
  };

  getRegion(ip: string): string {
    const geo = this.resolveGeo(ip);
    return this.regionMap[geo] || this.regionMap.default;
  }

  private resolveGeo(_ip: string): string {
    return 'US';
  }

  getServedByRegion(ip: string): string {
    return this.getRegion(ip);
  }
}
