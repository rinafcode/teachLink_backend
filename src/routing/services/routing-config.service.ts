import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DynamicRoutingConfig, 
  RoutingRule, 
  RoutingConditionType, 
  RoutingOperator, 
  RoutingActionType 
} from '../interfaces/routing.interface';

/**
 * Service for managing dynamic routing configuration
 */
@Injectable()
export class RoutingConfigService implements OnModuleInit {
  private readonly logger = new Logger(RoutingConfigService.name);
  private config: DynamicRoutingConfig;
  private configPath: string;

  constructor(private readonly configService: ConfigService) {
    this.configPath = this.configService.get<string>('ROUTING_CONFIG_PATH', './config/routing.json');
    this.config = this.getDefaultConfig();
  }

  async onModuleInit() {
    await this.loadConfig();
  }

  /**
   * Loads routing configuration from file or creates default
   */
  async loadConfig(): Promise<void> {
    try {
      const configExists = await this.fileExists(this.configPath);
      
      if (configExists) {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        this.config = JSON.parse(configData);
        this.logger.log(`Routing configuration loaded from ${this.configPath}`);
      } else {
        await this.saveConfig();
        this.logger.log(`Default routing configuration created at ${this.configPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to load routing configuration: ${error}`);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Saves current configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      this.logger.log(`Routing configuration saved to ${this.configPath}`);
    } catch (error) {
      this.logger.error(`Failed to save routing configuration: ${error}`);
      throw error;
    }
  }

  /**
   * Gets current routing configuration
   */
  getConfig(): DynamicRoutingConfig {
    return { ...this.config };
  }

  /**
   * Updates routing configuration
   */
  async updateConfig(newConfig: Partial<DynamicRoutingConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
  }

  /**
   * Adds a new routing rule
   */
  async addRule(rule: RoutingRule): Promise<void> {
    // Validate rule
    this.validateRule(rule);
    
    // Check for duplicate IDs
    if (this.config.rules.some(r => r.id === rule.id)) {
      throw new Error(`Rule with ID ${rule.id} already exists`);
    }

    this.config.rules.push(rule);
    await this.saveConfig();
    this.logger.log(`Added routing rule: ${rule.name} (${rule.id})`);
  }

  /**
   * Updates an existing routing rule
   */
  async updateRule(ruleId: string, updates: Partial<RoutingRule>): Promise<void> {
    const ruleIndex = this.config.rules.findIndex(r => r.id === ruleId);
    
    if (ruleIndex === -1) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    const updatedRule = { ...this.config.rules[ruleIndex], ...updates };
    this.validateRule(updatedRule);
    
    this.config.rules[ruleIndex] = updatedRule;
    await this.saveConfig();
    this.logger.log(`Updated routing rule: ${updatedRule.name} (${ruleId})`);
  }

  /**
   * Removes a routing rule
   */
  async removeRule(ruleId: string): Promise<void> {
    const ruleIndex = this.config.rules.findIndex(r => r.id === ruleId);
    
    if (ruleIndex === -1) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    const removedRule = this.config.rules.splice(ruleIndex, 1)[0];
    await this.saveConfig();
    this.logger.log(`Removed routing rule: ${removedRule.name} (${ruleId})`);
  }

  /**
   * Enables or disables a routing rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    const rule = this.config.rules.find(r => r.id === ruleId);
    
    if (!rule) {
      throw new Error(`Rule with ID ${ruleId} not found`);
    }

    rule.enabled = enabled;
    await this.saveConfig();
    this.logger.log(`${enabled ? 'Enabled' : 'Disabled'} routing rule: ${rule.name} (${ruleId})`);
  }

  /**
   * Gets all routing rules
   */
  getRules(): RoutingRule[] {
    return [...this.config.rules];
  }

  /**
   * Gets a specific routing rule by ID
   */
  getRule(ruleId: string): RoutingRule | undefined {
    return this.config.rules.find(r => r.id === ruleId);
  }

  /**
   * Validates a routing rule
   */
  private validateRule(rule: RoutingRule): void {
    if (!rule.id || !rule.name) {
      throw new Error('Rule must have id and name');
    }

    if (!rule.conditions || rule.conditions.length === 0) {
      throw new Error('Rule must have at least one condition');
    }

    if (!rule.action) {
      throw new Error('Rule must have an action');
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!Object.values(RoutingConditionType).includes(condition.type)) {
        throw new Error(`Invalid condition type: ${condition.type}`);
      }

      if (!Object.values(RoutingOperator).includes(condition.operator)) {
        throw new Error(`Invalid operator: ${condition.operator}`);
      }

      if (!condition.field) {
        throw new Error('Condition must have a field');
      }
    }

    // Validate action
    if (!Object.values(RoutingActionType).includes(rule.action.type)) {
      throw new Error(`Invalid action type: ${rule.action.type}`);
    }

    if (!rule.action.target && rule.action.type !== RoutingActionType.BLOCK) {
      throw new Error('Action must have a target (except for BLOCK actions)');
    }
  }

  /**
   * Gets default routing configuration with example rules
   */
  private getDefaultConfig(): DynamicRoutingConfig {
    return {
      rules: [
        {
          id: 'api-version-routing',
          name: 'API Version Header Routing',
          description: 'Route requests based on API version header',
          priority: 100,
          enabled: true,
          conditions: [
            {
              type: RoutingConditionType.HEADER,
              field: 'x-api-version',
              operator: RoutingOperator.EQUALS,
              value: 'v2'
            }
          ],
          action: {
            type: RoutingActionType.REWRITE,
            target: '/api/v2',
            transformations: [
              {
                type: 'path',
                operation: 'modify',
                field: 'path',
                value: '/api/v2${originalPath}'
              }
            ]
          }
        },
        {
          id: 'mobile-client-routing',
          name: 'Mobile Client Routing',
          description: 'Special routing for mobile clients',
          priority: 90,
          enabled: true,
          conditions: [
            {
              type: RoutingConditionType.HEADER,
              field: 'x-client-type',
              operator: RoutingOperator.EQUALS,
              value: 'mobile'
            }
          ],
          action: {
            type: RoutingActionType.FORWARD,
            target: '/api/mobile',
            transformations: [
              {
                type: 'header',
                operation: 'add',
                field: 'x-mobile-optimized',
                value: 'true'
              }
            ]
          }
        },
        {
          id: 'admin-access-control',
          name: 'Admin Access Control',
          description: 'Block non-admin access to admin endpoints',
          priority: 200,
          enabled: true,
          conditions: [
            {
              type: RoutingConditionType.PATH_PATTERN,
              field: 'path',
              operator: RoutingOperator.STARTS_WITH,
              value: '/admin'
            },
            {
              type: RoutingConditionType.CUSTOM,
              field: 'user.role',
              operator: RoutingOperator.NOT_EQUALS,
              value: 'ADMIN'
            }
          ],
          action: {
            type: RoutingActionType.BLOCK,
            target: 'unauthorized'
          }
        },
        {
          id: 'tenant-routing',
          name: 'Tenant-based Routing',
          description: 'Route requests based on tenant subdomain',
          priority: 80,
          enabled: true,
          conditions: [
            {
              type: RoutingConditionType.HEADER,
              field: 'host',
              operator: RoutingOperator.REGEX_MATCH,
              value: '^([^.]+)\\.teachlink\\.'
            }
          ],
          action: {
            type: RoutingActionType.FORWARD,
            target: '/tenant',
            transformations: [
              {
                type: 'header',
                operation: 'add',
                field: 'x-tenant-from-subdomain',
                value: 'true'
              }
            ]
          }
        },
        {
          id: 'feature-flag-routing',
          name: 'Feature Flag Routing',
          description: 'Route to beta features based on query parameter',
          priority: 70,
          enabled: true,
          conditions: [
            {
              type: RoutingConditionType.QUERY_PARAM,
              field: 'beta',
              operator: RoutingOperator.EQUALS,
              value: 'true'
            }
          ],
          action: {
            type: RoutingActionType.FORWARD,
            target: '/api/beta',
            transformations: [
              {
                type: 'header',
                operation: 'add',
                field: 'x-beta-features',
                value: 'enabled'
              }
            ]
          }
        }
      ],
      defaultAction: {
        type: RoutingActionType.FORWARD,
        target: '/api'
      },
      enableLogging: true,
      enableMetrics: true,
      cacheConfig: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000
      }
    };
  }

  /**
   * Checks if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}