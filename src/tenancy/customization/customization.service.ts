import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ResourceNotFoundException } from '../../common/exceptions/app.exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCustomization } from '../entities/tenant-customization.entity';
import { UpdateTenantCustomizationDto } from '../dto/tenant.dto';
import * as crypto from 'crypto';
import * as dns from 'dns';

/**
 * Provides customization operations.
 */
@Injectable()
export class CustomizationService {
  constructor(
    @InjectRepository(TenantCustomization)
    private readonly customizationRepository: Repository<TenantCustomization>,
  ) {}
  /**
   * Get customization for a tenant
   */
  async getCustomization(tenantId: string): Promise<TenantCustomization> {
    const customization = await this.customizationRepository.findOne({ where: { tenantId } });
    if (!customization) {
      throw new ResourceNotFoundException(`TenantCustomization for tenant '${tenantId}'`);
    }
    return customization;
  }
  /**
   * Create default customization for a tenant
   */
  async createDefaultCustomization(tenantId: string): Promise<TenantCustomization> {
    const customization = this.customizationRepository.create({
      tenantId,
      theme: {
        mode: 'light',
        colors: {},
        fonts: {},
        spacing: {},
      },
    });
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update tenant customization
   */
  async updateCustomization(
    tenantId: string,
    updateDto: UpdateTenantCustomizationDto,
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    Object.assign(customization, updateDto);
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update logo
   */
  async updateLogo(tenantId: string, logoUrl: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.logoUrl = logoUrl;
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update theme colors
   */
  async updateColors(
    tenantId: string,
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
    },
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    if (colors.primary) customization.primaryColor = colors.primary;
    if (colors.secondary) customization.secondaryColor = colors.secondary;
    if (colors.accent) customization.accentColor = colors.accent;
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update theme configuration
   */
  async updateTheme(
    tenantId: string,
    theme: Record<string, unknown>,
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.theme = {
      ...customization.theme,
      ...theme,
    };
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update email templates
   */
  async updateEmailTemplates(
    tenantId: string,
    templates: Record<string, string>,
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.emailTemplates = {
      ...customization.emailTemplates,
      ...templates,
    };
    return await this.customizationRepository.save(customization);
  }
  private readonly DOMAIN_REGEX =
    /^(?![.-])(?!.*--)[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  private readonly BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.example'];

  private validateDomain(domain: string): void {
    if (!domain || typeof domain !== 'string') {
      throw new BadRequestException('Domain must be a non-empty string');
    }
    const trimmed = domain.toLowerCase().trim();
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
      throw new BadRequestException('IP literals are not allowed as custom domains');
    }
    if (trimmed.startsWith('localhost') || this.BLOCKED_SUFFIXES.some((s) => trimmed.endsWith(s))) {
      throw new BadRequestException('Localhost and internal suffixes are not allowed');
    }
    if (!this.DOMAIN_REGEX.test(trimmed)) {
      throw new BadRequestException('Domain must be a valid hostname');
    }
  }

  /**
   * Set custom domain
   */
  async setCustomDomain(tenantId: string, domain: string): Promise<TenantCustomization> {
    this.validateDomain(domain);
    const normalized = domain.toLowerCase().trim();

    const existing = await this.customizationRepository.findOne({
      where: { customDomain: normalized },
    });
    if (existing && existing.tenantId !== tenantId) {
      throw new ConflictException('This domain is already claimed by another tenant');
    }

    const customization = await this.getCustomization(tenantId);
    const token = crypto.randomBytes(32).toString('hex');
    customization.customDomain = normalized;
    customization.customDomainVerified = false;
    customization.domainVerificationToken = token;
    return await this.customizationRepository.save(customization);
  }

  /**
   * Verify custom domain
   */
  async verifyCustomDomain(tenantId: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    if (!customization.customDomain) {
      throw new BadRequestException('No custom domain has been set');
    }
    if (!customization.domainVerificationToken) {
      throw new BadRequestException('No verification token found. Re-set the custom domain.');
    }

    const domain = customization.customDomain;
    const expectedPrefix = '_teachlink-verify';
    const fqdn = `${expectedPrefix}.${domain}`;

    let records: string[][];
    try {
      records = await dns.promises.resolveTxt(fqdn);
    } catch {
      throw new BadRequestException(
        `Could not resolve TXT record at ${fqdn}. Ensure the DNS record is published and propagated.`,
      );
    }

    const token = customization.domainVerificationToken;
    const matched = records.some((recordSet) => recordSet.some((entry) => entry.trim() === token));

    if (!matched) {
      throw new BadRequestException(
        `TXT record at ${fqdn} does not match the expected verification token.`,
      );
    }

    customization.customDomainVerified = true;
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update social links
   */
  async updateSocialLinks(
    tenantId: string,
    socialLinks: Record<string, string>,
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.socialLinks = {
      ...customization.socialLinks,
      ...socialLinks,
    };
    return await this.customizationRepository.save(customization);
  }
  /**
   * Update landing page configuration
   */
  async updateLandingPage(
    tenantId: string,
    config: Record<string, unknown>,
  ): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.landingPageConfig = {
      ...customization.landingPageConfig,
      ...config,
    };
    return await this.customizationRepository.save(customization);
  }
  /**
   * Add custom CSS
   */
  async addCustomCss(tenantId: string, css: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.customCss = css;
    return await this.customizationRepository.save(customization);
  }
  /**
   * Add custom JavaScript
   */
  async addCustomJs(tenantId: string, js: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.customJs = js;
    return await this.customizationRepository.save(customization);
  }
  /**
   * Reset customization to defaults
   */
  async resetToDefaults(tenantId: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.logoUrl = null;
    customization.faviconUrl = null;
    customization.primaryColor = null;
    customization.secondaryColor = null;
    customization.accentColor = null;
    customization.fontFamily = null;
    customization.customCss = null;
    customization.customJs = null;
    customization.theme = {
      mode: 'light',
      colors: {},
      fonts: {},
      spacing: {},
    };
    return await this.customizationRepository.save(customization);
  }
}
