import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ABTest } from '../entities/ab-test.entity';
import { ABTestVariant } from '../entities/ab-test-variant.entity';
import { EmailEvent } from '../entities/email-event.entity';
import { CreateABTestDto } from '../dto/create-ab-test.dto';
import { ABTestStatus } from '../enums/ab-test-status.enum';
import { EmailEventType } from '../enums/email-event-type.enum';

export interface VariantStats {
    variantId: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
    isWinner: boolean;
    confidenceLevel: number;
}

@Injectable()
export class ABTestingService {
    constructor(
        @InjectRepository(ABTest)
        private readonly abTestRepository: Repository<ABTest>,
        @InjectRepository(ABTestVariant)
        private readonly variantRepository: Repository<ABTestVariant>,
        @InjectRepository(EmailEvent)
        private readonly eventRepository: Repository<EmailEvent>,
    ) { }

    /**
     * Create a new A/B test
     */
    async create(createABTestDto: CreateABTestDto): Promise<ABTest> {
        if (createABTestDto.variants.length < 2) {
            throw new BadRequestException('A/B test requires at least 2 variants');
        }

        const totalWeight = createABTestDto.variants.reduce((sum, v) => sum + (v.weight || 50), 0);
        if (totalWeight !== 100) {
            throw new BadRequestException('Variant weights must sum to 100');
        }

        const abTest = this.abTestRepository.create({
            name: createABTestDto.name,
            campaignId: createABTestDto.campaignId,
            testField: createABTestDto.testField,
            winnerCriteria: createABTestDto.winnerCriteria,
            sampleSize: createABTestDto.sampleSize,
            status: ABTestStatus.DRAFT,
        });

        const savedTest = await this.abTestRepository.save(abTest);

        const variants = createABTestDto.variants.map((v, index) =>
            this.variantRepository.create({
                ...v,
                abTestId: savedTest.id,
                name: v.name || `Variant ${String.fromCharCode(65 + index)}`,
            }),
        );

        await this.variantRepository.save(variants);
        return this.findOne(savedTest.id);
    }

    /**
     * Get all A/B tests
     */
    async findAll(page = 1, limit = 10) {
        const [tests, total] = await this.abTestRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
            relations: ['variants'],
        });

        return { tests, total, page, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Get a single A/B test by ID
     */
    async findOne(id: string): Promise<ABTest> {
        const test = await this.abTestRepository.findOne({
            where: { id },
            relations: ['variants'],
        });

        if (!test) {
            throw new NotFoundException(`A/B test with ID ${id} not found`);
        }
        return test;
    }

    /**
     * Start an A/B test
     */
    async startTest(id: string): Promise<ABTest> {
        const test = await this.findOne(id);

        if (test.status !== ABTestStatus.DRAFT) {
            throw new BadRequestException('Only draft tests can be started');
        }

        test.status = ABTestStatus.RUNNING;
        test.startedAt = new Date();
        return this.abTestRepository.save(test);
    }

    /**
     * Get test results with statistical analysis
     */
    async getTestResults(id: string): Promise<{
        test: ABTest;
        variants: VariantStats[];
        isSignificant: boolean;
        recommendedWinner: string | null;
    }> {
        const test = await this.findOne(id);
        const variantStats: VariantStats[] = [];

        for (const variant of test.variants) {
            const sent = variant.recipientCount || 0;
            const opened = await this.countVariantEvents(variant.id, EmailEventType.OPENED);
            const clicked = await this.countVariantEvents(variant.id, EmailEventType.CLICKED);

            variantStats.push({
                variantId: variant.id,
                name: variant.name,
                sent,
                opened,
                clicked,
                openRate: sent > 0 ? (opened / sent) * 100 : 0,
                clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
                isWinner: false,
                confidenceLevel: 0,
            });
        }

        // Calculate statistical significance
        const { isSignificant, winner, confidenceLevel } = this.calculateSignificance(
            variantStats,
            test.winnerCriteria,
        );

        if (winner) {
            const winnerStats = variantStats.find((v) => v.variantId === winner);
            if (winnerStats) {
                winnerStats.isWinner = true;
                winnerStats.confidenceLevel = confidenceLevel;
            }
        }

        return {
            test,
            variants: variantStats,
            isSignificant,
            recommendedWinner: winner,
        };
    }

    /**
     * Declare a winner and end the test
     */
    async declareWinner(testId: string, variantId: string): Promise<ABTest> {
        const test = await this.findOne(testId);

        if (test.status !== ABTestStatus.RUNNING) {
            throw new BadRequestException('Only running tests can have a winner declared');
        }

        const variant = test.variants.find((v) => v.id === variantId);
        if (!variant) {
            throw new BadRequestException('Variant not found in this test');
        }

        test.status = ABTestStatus.COMPLETED;
        test.winnerId = variantId;
        test.endedAt = new Date();

        return this.abTestRepository.save(test);
    }

    /**
     * Select variant for a recipient (weighted random)
     */
    selectVariantForRecipient(test: ABTest): ABTestVariant {
        const random = Math.random() * 100;
        let cumulative = 0;

        for (const variant of test.variants) {
            cumulative += variant.weight;
            if (random <= cumulative) {
                return variant;
            }
        }

        return test.variants[0];
    }

    // Private helper methods
    private async countVariantEvents(variantId: string, eventType: EmailEventType): Promise<number> {
        return this.eventRepository.count({
            where: { metadata: { variantId }, eventType },
        });
    }

    private calculateSignificance(
        variants: VariantStats[],
        criteria: string,
    ): { isSignificant: boolean; winner: string | null; confidenceLevel: number } {
        if (variants.length < 2) {
            return { isSignificant: false, winner: null, confidenceLevel: 0 };
        }

        // Sort by the winning criteria
        const sorted = [...variants].sort((a, b) => {
            const metricA = criteria === 'click_rate' ? a.clickRate : a.openRate;
            const metricB = criteria === 'click_rate' ? b.clickRate : b.openRate;
            return metricB - metricA;
        });

        const best = sorted[0];
        const second = sorted[1];

        // Simple z-test approximation
        const n1 = best.sent;
        const n2 = second.sent;
        const p1 = criteria === 'click_rate' ? best.clickRate / 100 : best.openRate / 100;
        const p2 = criteria === 'click_rate' ? second.clickRate / 100 : second.openRate / 100;

        if (n1 < 30 || n2 < 30) {
            return { isSignificant: false, winner: null, confidenceLevel: 0 };
        }

        const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
        const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

        if (se === 0) {
            return { isSignificant: false, winner: null, confidenceLevel: 0 };
        }

        const zScore = Math.abs(p1 - p2) / se;

        // Z-score to confidence level
        let confidenceLevel = 0;
        if (zScore >= 2.576) confidenceLevel = 99;
        else if (zScore >= 1.96) confidenceLevel = 95;
        else if (zScore >= 1.645) confidenceLevel = 90;

        return {
            isSignificant: confidenceLevel >= 95,
            winner: confidenceLevel >= 95 ? best.variantId : null,
            confidenceLevel,
        };
    }
}
