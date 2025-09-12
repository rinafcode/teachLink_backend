import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { GeoLocation } from '../interfaces/cdn.interfaces';
import axios from 'axios';

@Injectable()
export class GeoLocationService {
  private readonly logger = new Logger(GeoLocationService.name);
  private readonly geoCache = new Map<string, GeoLocation>();

  constructor(private readonly configService: ConfigService) {}

  async getLocationByIP(ip: string): Promise<GeoLocation> {
    // Check cache first
    if (this.geoCache.has(ip)) {
      return this.geoCache.get(ip);
    }

    try {
      // Use a geo-location service (example with ipapi.co)
      const response = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 5000,
      });

      const location: GeoLocation = {
        country: response.data.country_name || 'Unknown',
        region: response.data.region || 'Unknown',
        city: response.data.city || 'Unknown',
        latitude: response.data.latitude || 0,
        longitude: response.data.longitude || 0,
        timezone: response.data.timezone || 'UTC',
      };

      // Cache the result for 1 hour
      this.geoCache.set(ip, location);
      setTimeout(() => this.geoCache.delete(ip), 3600000);

      return location;
    } catch (error) {
      this.logger.warn(`Failed to get location for IP ${ip}: ${error.message}`);

      // Return default location
      return {
        country: 'Unknown',
        region: 'global',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
      };
    }
  }

  async getNearestEdgeLocation(userLocation: GeoLocation): Promise<string> {
    // Define edge locations with their coordinates
    const edgeLocations = [
      { region: 'us-east-1', lat: 39.0458, lng: -76.6413, name: 'Virginia' },
      { region: 'us-west-1', lat: 37.7749, lng: -122.4194, name: 'California' },
      { region: 'eu-west-1', lat: 53.3498, lng: -6.2603, name: 'Ireland' },
      {
        region: 'ap-southeast-1',
        lat: 1.3521,
        lng: 103.8198,
        name: 'Singapore',
      },
      { region: 'ap-northeast-1', lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    ];

    let nearestLocation = edgeLocations[0];
    let minDistance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      nearestLocation.lat,
      nearestLocation.lng,
    );

    for (const location of edgeLocations.slice(1)) {
      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        location.lat,
        location.lng,
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = location;
      }
    }

    this.logger.log(
      `Nearest edge location for ${userLocation.city}: ${nearestLocation.name} (${minDistance.toFixed(2)}km)`,
    );

    return nearestLocation.region;
  }

  async getRegionalOptimization(region: string): Promise<{
    compressionLevel: number;
    imageFormat: string;
    cacheHeaders: Record<string, string>;
  }> {
    // Define region-specific optimizations
    const optimizations = {
      'us-east-1': {
        compressionLevel: 85,
        imageFormat: 'webp',
        cacheHeaders: {
          'Cache-Control': 'public, max-age=31536000',
          Vary: 'Accept-Encoding',
        },
      },
      'us-west-1': {
        compressionLevel: 85,
        imageFormat: 'webp',
        cacheHeaders: {
          'Cache-Control': 'public, max-age=31536000',
          Vary: 'Accept-Encoding',
        },
      },
      'eu-west-1': {
        compressionLevel: 80,
        imageFormat: 'webp',
        cacheHeaders: {
          'Cache-Control': 'public, max-age=86400',
          Vary: 'Accept-Encoding',
        },
      },
      'ap-southeast-1': {
        compressionLevel: 75, // Lower quality for slower connections
        imageFormat: 'jpeg',
        cacheHeaders: {
          'Cache-Control': 'public, max-age=86400',
          Vary: 'Accept-Encoding',
        },
      },
      global: {
        compressionLevel: 80,
        imageFormat: 'jpeg',
        cacheHeaders: {
          'Cache-Control': 'public, max-age=86400',
          Vary: 'Accept-Encoding',
        },
      },
    };

    return optimizations[region] || optimizations.global;
  }

  async detectConnectionSpeed(ip: string): Promise<string> {
    // This would typically use network timing APIs or external services
    // For now, return a mock connection type based on region
    const location = await this.getLocationByIP(ip);

    // Simple heuristic based on country development
    const highSpeedCountries = [
      'United States',
      'Canada',
      'Germany',
      'Japan',
      'South Korea',
    ];
    const mediumSpeedCountries = ['Brazil', 'India', 'China', 'Russia'];

    if (highSpeedCountries.includes(location.country)) {
      return '4g';
    } else if (mediumSpeedCountries.includes(location.country)) {
      return '3g';
    } else {
      return '2g';
    }
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
