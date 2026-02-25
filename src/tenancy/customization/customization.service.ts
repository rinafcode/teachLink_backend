import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCustomization } from '../entities/tenant-customization.entity';
import { UpdateTenantCustomizationDto } from '../dto/tenant.dto';

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
      throw new NotFoundException(`Customization not found for tenant ${tenantId}`);
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
    colors: { primary?: string; secondary?: string; accent?: string },
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
  async updateTheme(tenantId: string, theme: Record<string, any>): Promise<TenantCustomization> {
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

  /**
   * Set custom domain
   */
  async setCustomDomain(tenantId: string, domain: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    customization.customDomain = domain;
    customization.customDomainVerified = false;
    return await this.customizationRepository.save(customization);
  }

  /**
   * Verify custom domain
   */
  async verifyCustomDomain(tenantId: string): Promise<TenantCustomization> {
    const customization = await this.getCustomization(tenantId);
    // TODO: Implement actual domain verification logic
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
    config: Record<string, any>,
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
