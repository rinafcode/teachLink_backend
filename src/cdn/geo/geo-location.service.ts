import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp?: string;
  connectionType?: string;
}

export interface EdgeLocation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  provider: string;
  priority: number;
}

@Injectable()
export class GeoLocationService {
  private readonly logger = new Logger(GeoLocationService.name);
  private edgeLocations: EdgeLocation[] = [
    { id: 'us-east-1', name: 'Virginia', country: 'US', latitude: 39.0438, longitude: -77.4874, provider: 'cloudflare', priority: 1 },
    { id: 'us-west-1', name: 'California', country: 'US', latitude: 37.7749, longitude: -122.4194, provider: 'cloudflare', priority: 2 },
    { id: 'eu-west-1', name: 'Ireland', country: 'IE', latitude: 53.1424, longitude: -7.6921, provider: 'cloudflare', priority: 1 },
    { id: 'eu-central-1', name: 'Germany', country: 'DE', latitude: 50.1109, longitude: 8.6821, provider: 'cloudflare', priority: 2 },
    { id: 'ap-southeast-1', name: 'Singapore', country: 'SG', latitude: 1.3521, longitude: 103.8198, provider: 'cloudflare', priority: 1 },
    { id: 'ap-northeast-1', name: 'Japan', country: 'JP', latitude: 35.6762, longitude: 139.6503, provider: 'cloudflare', priority: 2 },
  ];

  constructor(private configService: ConfigService) {}

  async getLocationInfo(ipAddress: string): Promise<LocationInfo | null> {
    try {
      // In real implementation, use a geolocation service like MaxMind or IP-API
      // For now, return mock data based on IP
      return this.mockGeolocation(ipAddress);
    } catch (error) {
      this.logger.error(`Failed to get location for IP ${ipAddress}:`, error);
      return null;
    }
  }

  async getOptimalLocation(userLocation?: string): Promise<string> {
    if (!userLocation) {
      // Default to primary edge location
      return this.edgeLocations[0].id;
    }

    const userCoords = await this.getCoordinates(userLocation);
    if (!userCoords) {
      return this.edgeLocations[0].id;
    }

    let optimalLocation = this.edgeLocations[0];
    let minDistance = this.calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      optimalLocation.latitude,
      optimalLocation.longitude,
    );

    for (const location of this.edgeLocations.slice(1)) {
      const distance = this.calculateDistance(
        userCoords.latitude,
        userCoords.longitude,
        location.latitude,
        location.longitude,
      );

      if (distance < minDistance) {
        minDistance = distance;
        optimalLocation = location;
      }
    }

    return optimalLocation.id;
  }

  async getNearestEdgeLocations(
    userLocation: string,
    limit: number = 3,
  ): Promise<EdgeLocation[]> {
    const userCoords = await this.getCoordinates(userLocation);
    if (!userCoords) {
      return this.edgeLocations.slice(0, limit);
    }

    const sortedLocations = this.edgeLocations
      .map(location => ({
        ...location,
        distance: this.calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          location.latitude,
          location.longitude,
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    return sortedLocations.slice(0, limit);
  }

  async optimizeRouteForConnection(
    userLocation: string,
    connectionType: string,
  ): Promise<string> {
    const locations = await this.getNearestEdgeLocations(userLocation, 5);

    // Adjust based on connection type
    switch (connectionType.toLowerCase()) {
      case 'mobile':
      case '3g':
      case '4g':
        // Prefer locations with better mobile optimization
        return locations[0].id;
      case 'satellite':
        // Prefer locations with lower latency for satellite
        return locations[0].id;
      default:
        return locations[0].id;
    }
  }

  async getLatencyEstimates(userLocation: string): Promise<Record<string, number>> {
    const userCoords = await this.getCoordinates(userLocation);
    const estimates: Record<string, number> = {};

    for (const location of this.edgeLocations) {
      const distance = this.calculateDistance(
        userCoords.latitude,
        userCoords.longitude,
        location.latitude,
        location.longitude,
      );

      // Rough estimate: 1ms per 100km
      estimates[location.id] = Math.round(distance / 100);
    }

    return estimates;
  }

  private async getCoordinates(location: string): Promise<{ latitude: number; longitude: number } | null> {
    // In real implementation, use geocoding service
    // For now, return mock coordinates
    const mockCoords: Record<string, { latitude: number; longitude: number }> = {
      'new york': { latitude: 40.7128, longitude: -74.0060 },
      'london': { latitude: 51.5074, longitude: -0.1278 },
      'tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'sydney': { latitude: -33.8688, longitude: 151.2093 },
      'lagos': { latitude: 6.5244, longitude: 3.3792 },
    };

    return mockCoords[location.toLowerCase()] || null;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private mockGeolocation(ipAddress: string): LocationInfo {
    // Mock implementation - in real app, use actual geolocation service
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
      timezone: 'America/Los_Angeles',
      isp: 'Mock ISP',
      connectionType: 'fiber',
    };
  }

  async getGeoStats(): Promise<{
    totalRequests: number;
    topCountries: Array<{ country: string; count: number }>;
    averageLatency: number;
  }> {
    // Implementation would aggregate geolocation analytics
    return {
      totalRequests: 100000,
      topCountries: [
        { country: 'US', count: 45000 },
        { country: 'UK', count: 15000 },
        { country: 'DE', count: 12000 },
      ],
      averageLatency: 45,
    };
  }
}
