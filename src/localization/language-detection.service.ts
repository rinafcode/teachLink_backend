import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
export type LocaleResolutionSource = 'query' | 'header' | 'default';
export interface ResolvedLocale {
    locale: string;
    source: LocaleResolutionSource;
}
@Injectable()
export class LanguageDetectionService {
    constructor(private readonly configService: ConfigService) { }
    getDefaultLocale(): string {
        return this.configService.get<string>('I18N_DEFAULT_LOCALE')?.trim().toLowerCase() || 'en';
    }
    getSupportedLocales(): string[] {
        const raw = this.configService.get<string>('I18N_SUPPORTED_LOCALES') ||
            this.configService.get<string>('I18N_DEFAULT_LOCALE') ||
            'en';
        return raw
            .split(',')
            .map((s) => this.normalizeLocaleTag(s))
            .filter(Boolean);
    }
    normalizeLocaleTag(tag: string): string {
        if (!tag)
            return '';
        return tag.trim().toLowerCase().replace(/_/g, '-');
    }
    /** First supported locale that matches the tag (exact or primary subtag). */
    pickSupported(tag: string): string | null {
        const normalized = this.normalizeLocaleTag(tag);
        if (!normalized)
            return null;
        const supported = this.getSupportedLocales();
        if (supported.includes(normalized))
            return normalized;
        const primary = normalized.split('-')[0];
        if (supported.includes(primary))
            return primary;
        for (const s of supported) {
            if (s.startsWith(`${primary}-`) || primary === s.split('-')[0]) {
                return s;
            }
        }
        return null;
    }
    resolveWithSource(req: Request, queryLang?: string): ResolvedLocale {
        const defaultLocale = this.getDefaultLocale();
        if (queryLang) {
            const picked = this.pickSupported(queryLang);
            if (picked) {
                return { locale: picked, source: 'query' };
            }
        }
        const header = req.headers['accept-language'];
        if (header && typeof header === 'string') {
            const fromHeader = this.parseAcceptLanguage(header);
            if (fromHeader) {
                return { locale: fromHeader, source: 'header' };
            }
        }
        return { locale: defaultLocale, source: 'default' };
    }
    resolveLocale(req: Request, queryLang?: string): string {
        return this.resolveWithSource(req, queryLang).locale;
    }
    /**
     * RFC 7231-style Accept-Language: pick highest-q language that we support.
     */
    private parseAcceptLanguage(header: string): string | null {
        const parts = header.split(',');
        const candidates: Array<{
            tag: string;
            q: number;
        }> = [];
        for (const part of parts) {
            const [langPart, ...params] = part.trim().split(';');
            const tag = this.normalizeLocaleTag(langPart);
            if (!tag || tag === '*')
                continue;
            let q = 1;
            for (const p of params) {
                const [k, v] = p.trim().split('=');
                if (k?.toLowerCase() === 'q' && v) {
                    const n = parseFloat(v);
                    if (!Number.isNaN(n))
                        q = n;
                }
            }
            candidates.push({ tag, q });
        }
        candidates.sort((a, b) => b.q - a.q);
        for (const { tag } of candidates) {
            const picked = this.pickSupported(tag);
            if (picked)
                return picked;
        }
        return null;
    }
}
