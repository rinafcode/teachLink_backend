import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LanguageDetectionService } from './language-detection.service';
function mockReq(headers: Record<string, string> = {}, query?: Record<string, string>) {
    return {
        headers,
        query: query ?? {},
    } as import('express').Request;
}
describe('LanguageDetectionService', () => {
    let service: LanguageDetectionService;
    async function createModule(config: Record<string, string>) {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LanguageDetectionService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => config[key],
                    },
                },
            ],
        }).compile();
        return module.get(LanguageDetectionService);
    }
    beforeEach(async () => {
        service = await createModule({
            I18N_DEFAULT_LOCALE: 'en',
            I18N_SUPPORTED_LOCALES: 'en,fr,de',
        });
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('pickSupported', () => {
        it('returns exact tag when listed', () => {
            expect(service.pickSupported('fr')).toBe('fr');
            expect(service.pickSupported('FR')).toBe('fr');
        });
        it('maps region subtag to primary when primary is supported', () => {
            expect(service.pickSupported('fr-CA')).toBe('fr');
        });
        it('returns null when nothing matches', async () => {
            const s = await createModule({ I18N_DEFAULT_LOCALE: 'en', I18N_SUPPORTED_LOCALES: 'en' });
            expect(s.pickSupported('zz')).toBeNull();
        });
    });
    describe('resolveWithSource', () => {
        it('uses query lang when supported', () => {
            const req = mockReq({ 'accept-language': 'en-US,en;q=0.9' });
            expect(service.resolveWithSource(req, 'de')).toEqual({ locale: 'de', source: 'query' });
        });
        it('ignores unsupported query lang and falls through to header', () => {
            const req = mockReq({ 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' });
            expect(service.resolveWithSource(req, 'xx')).toEqual({ locale: 'fr', source: 'header' });
        });
        it('respects q-values on Accept-Language', () => {
            const req = mockReq({ 'accept-language': 'de;q=0.8,fr;q=0.9' });
            expect(service.resolveWithSource(req)).toEqual({ locale: 'fr', source: 'header' });
        });
        it('uses default when header missing or unmatched', async () => {
            const s = await createModule({ I18N_DEFAULT_LOCALE: 'en', I18N_SUPPORTED_LOCALES: 'en' });
            expect(s.resolveWithSource(mockReq({}))).toEqual({ locale: 'en', source: 'default' });
            expect(s.resolveWithSource(mockReq({ 'accept-language': 'ja,zh-CN;q=0.9' }))).toEqual({
                locale: 'en',
                source: 'default',
            });
        });
    });
});
