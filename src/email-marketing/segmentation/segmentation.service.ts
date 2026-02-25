import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';

import { Segment } from '../entities/segment.entity';
import { SegmentRule } from '../entities/segment-rule.entity';
import { CreateSegmentDto } from '../dto/create-segment.dto';
import { UpdateSegmentDto } from '../dto/update-segment.dto';
import { SegmentRuleOperator } from '../enums/segment-rule-operator.enum';
import { SegmentRuleField } from '../enums/segment-rule-field.enum';

// Note: Import User entity from users module when integrating
export interface UserProfile {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    createdAt: Date;
    lastLoginAt?: Date;
    tags?: string[];
    preferences?: Record<string, any>;
}

@Injectable()
export class SegmentationService {
    constructor(
        @InjectRepository(Segment)
        private readonly segmentRepository: Repository<Segment>,
        @InjectRepository(SegmentRule)
        private readonly ruleRepository: Repository<SegmentRule>,
    ) { }

    /**
     * Create a new segment
     */
    async create(createSegmentDto: CreateSegmentDto): Promise<Segment> {
        const segment = this.segmentRepository.create({
            name: createSegmentDto.name,
            description: createSegmentDto.description,
            isDynamic: createSegmentDto.isDynamic ?? true,
        });

        const savedSegment = await this.segmentRepository.save(segment);

        // Create rules
        if (createSegmentDto.rules?.length) {
            const rules = createSegmentDto.rules.map((rule, index) =>
                this.ruleRepository.create({
                    ...rule,
                    segmentId: savedSegment.id,
                    order: index,
                }),
            );
            await this.ruleRepository.save(rules);
        }

        return this.findOne(savedSegment.id);
    }

    /**
     * Get all segments
     */
    async findAll(page: number = 1, limit: number = 10): Promise<{
        segments: Segment[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const [segments, total] = await this.segmentRepository.findAndCount({
            skip: (page - 1) * limit,
            take: limit,
            order: { createdAt: 'DESC' },
            relations: ['rules'],
        });

        // Calculate member count for each segment
        for (const segment of segments) {
            segment.memberCount = await this.calculateMemberCount(segment.id);
        }

        return {
            segments,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get a single segment by ID
     */
    async findOne(id: string): Promise<Segment> {
        const segment = await this.segmentRepository.findOne({
            where: { id },
            relations: ['rules'],
        });

        if (!segment) {
            throw new NotFoundException(`Segment with ID ${id} not found`);
        }

        // Calculate member count without recursive call
        segment.memberCount = await this.calculateMemberCountForSegment(segment);
        return segment;
    }

    /**
     * Update a segment
     */
    async update(id: string, updateSegmentDto: UpdateSegmentDto): Promise<Segment> {
        const segment = await this.findOne(id);

        Object.assign(segment, {
            name: updateSegmentDto.name ?? segment.name,
            description: updateSegmentDto.description ?? segment.description,
            isDynamic: updateSegmentDto.isDynamic ?? segment.isDynamic,
        });

        await this.segmentRepository.save(segment);

        // Update rules if provided
        if (updateSegmentDto.rules) {
            await this.ruleRepository.delete({ segmentId: id });
            const rules = updateSegmentDto.rules.map((rule, index) =>
                this.ruleRepository.create({
                    ...rule,
                    segmentId: id,
                    order: index,
                }),
            );
            await this.ruleRepository.save(rules);
        }

        return this.findOne(id);
    }

    /**
     * Delete a segment
     */
    async remove(id: string): Promise<void> {
        const segment = await this.findOne(id);
        await this.segmentRepository.remove(segment);
    }

    /**
     * Get users from multiple segments
     */
    async getUsersFromSegments(segmentIds: string[]): Promise<UserProfile[]> {
        if (!segmentIds.length) {
            return [];
        }

        const segments = await this.segmentRepository.find({
            where: { id: In(segmentIds) },
            relations: ['rules'],
        });

        const userSets = await Promise.all(
            segments.map((segment) => this.getSegmentMembers(segment)),
        );

        // Combine all users (union)
        const userMap = new Map<string, UserProfile>();
        for (const users of userSets) {
            for (const user of users) {
                userMap.set(user.id, user);
            }
        }

        return Array.from(userMap.values());
    }

    /**
     * Get members of a specific segment
     */
    async getSegmentMembers(segmentOrId: Segment | string): Promise<UserProfile[]> {
        let segment: Segment;

        if (typeof segmentOrId === 'string') {
            // Direct query to avoid infinite recursion
            const found = await this.segmentRepository.findOne({
                where: { id: segmentOrId },
                relations: ['rules'],
            });
            if (!found) {
                throw new NotFoundException(`Segment with ID ${segmentOrId} not found`);
            }
            segment = found;
        } else {
            segment = segmentOrId;
        }

        if (!segment.isDynamic) {
            // Static segment - return manually added members
            return this.getStaticSegmentMembers(segment.id);
        }

        // Dynamic segment - evaluate rules
        return this.evaluateSegmentRules(segment.rules);
    }

    /**
     * Preview segment members without saving
     */
    async previewSegment(rules: CreateSegmentDto['rules']): Promise<{
        count: number;
        sample: UserProfile[];
    }> {
        const ruleEntities = rules.map((rule, index) =>
            this.ruleRepository.create({ ...rule, order: index }),
        );

        const members = await this.evaluateSegmentRules(ruleEntities);

        return {
            count: members.length,
            sample: members.slice(0, 10),
        };
    }

    /**
     * Add users manually to a static segment
     */
    async addUsersToSegment(segmentId: string, userIds: string[]): Promise<void> {
        const segment = await this.findOne(segmentId);

        if (segment.isDynamic) {
            throw new BadRequestException('Cannot manually add users to a dynamic segment');
        }

        // Add to static member list
        const currentMembers = segment.staticMemberIds || [];
        const newMembers = [...new Set([...currentMembers, ...userIds])];

        await this.segmentRepository.update(segmentId, {
            staticMemberIds: newMembers,
        });
    }

    /**
     * Remove users from a static segment
     */
    async removeUsersFromSegment(segmentId: string, userIds: string[]): Promise<void> {
        const segment = await this.findOne(segmentId);

        if (segment.isDynamic) {
            throw new BadRequestException('Cannot manually remove users from a dynamic segment');
        }

        const currentMembers = segment.staticMemberIds || [];
        const newMembers = currentMembers.filter((id) => !userIds.includes(id));

        await this.segmentRepository.update(segmentId, {
            staticMemberIds: newMembers,
        });
    }

    /**
     * Check if a user belongs to a segment
     */
    async isUserInSegment(userId: string, segmentId: string): Promise<boolean> {
        const members = await this.getSegmentMembers(segmentId);
        return members.some((member) => member.id === userId);
    }

    /**
     * Get all segments a user belongs to
     */
    async getUserSegments(userId: string): Promise<Segment[]> {
        const allSegments = await this.segmentRepository.find({
            relations: ['rules'],
        });

        const userSegments: Segment[] = [];

        for (const segment of allSegments) {
            if (await this.isUserInSegment(userId, segment.id)) {
                userSegments.push(segment);
            }
        }

        return userSegments;
    }

    // ==================== Private Helper Methods ====================

    /**
     * Calculate member count for a segment (by ID - may cause recursion, use carefully)
     */
    private async calculateMemberCount(segmentId: string): Promise<number> {
        const members = await this.getSegmentMembers(segmentId);
        return members.length;
    }

    /**
     * Calculate member count for a segment (accepts segment object to avoid recursion)
     */
    private async calculateMemberCountForSegment(segment: Segment): Promise<number> {
        if (!segment.isDynamic) {
            return segment.staticMemberIds?.length || 0;
        }
        const members = await this.evaluateSegmentRules(segment.rules);
        return members.length;
    }

    /**
     * Get members of a static segment
     */
    private async getStaticSegmentMembers(segmentId: string): Promise<UserProfile[]> {
        const segment = await this.segmentRepository.findOne({
            where: { id: segmentId },
        });

        if (!segment?.staticMemberIds?.length) {
            return [];
        }

        // TODO: Fetch actual user data from Users module
        // For now, return mock data
        return segment.staticMemberIds.map((id) => ({
            id,
            email: `user-${id}@example.com`,
            createdAt: new Date(),
        }));
    }

    /**
     * Evaluate segment rules and return matching users
     */
    private async evaluateSegmentRules(rules: SegmentRule[]): Promise<UserProfile[]> {
        if (!rules.length) {
            return [];
        }

        // TODO: Build actual query against User entity
        // This is a placeholder implementation showing the query building logic

        // Group rules by AND/OR logic
        const sortedRules = [...rules].sort((a, b) => a.order - b.order);

        // Build query conditions
        const conditions: string[] = [];

        for (const rule of sortedRules) {
            const condition = this.buildRuleCondition(rule);
            if (condition) {
                conditions.push(condition);
            }
        }

        // For MVP, return empty array - actual implementation requires User repository
        console.log('Segment rules would evaluate:', conditions);

        // TODO: Execute query and return real users
        return [];
    }

    /**
     * Build SQL condition from a rule
     */
    private buildRuleCondition(rule: SegmentRule): string | null {
        const field = this.getFieldMapping(rule.field);
        const operator = this.getOperatorMapping(rule.operator);
        const value = this.formatValue(rule.value, rule.operator);

        if (!field || !operator) {
            return null;
        }

        return `${field} ${operator} ${value}`;
    }

    /**
     * Map rule field to database column
     */
    private getFieldMapping(field: SegmentRuleField): string | null {
        const mapping: Record<SegmentRuleField, string> = {
            [SegmentRuleField.EMAIL]: 'user.email',
            [SegmentRuleField.FIRST_NAME]: 'user.firstName',
            [SegmentRuleField.LAST_NAME]: 'user.lastName',
            [SegmentRuleField.CREATED_AT]: 'user.createdAt',
            [SegmentRuleField.LAST_LOGIN]: 'user.lastLoginAt',
            [SegmentRuleField.COURSE_COUNT]: 'enrollments.count',
            [SegmentRuleField.TOTAL_SPENT]: 'payments.total',
            [SegmentRuleField.TAG]: 'user.tags',
            [SegmentRuleField.COUNTRY]: 'user.country',
            [SegmentRuleField.SUBSCRIPTION_STATUS]: 'subscription.status',
        };

        return mapping[field] || null;
    }

    /**
     * Map rule operator to SQL operator
     */
    private getOperatorMapping(operator: SegmentRuleOperator): string | null {
        const mapping: Record<SegmentRuleOperator, string> = {
            [SegmentRuleOperator.EQUALS]: '=',
            [SegmentRuleOperator.NOT_EQUALS]: '!=',
            [SegmentRuleOperator.CONTAINS]: 'LIKE',
            [SegmentRuleOperator.NOT_CONTAINS]: 'NOT LIKE',
            [SegmentRuleOperator.STARTS_WITH]: 'LIKE',
            [SegmentRuleOperator.ENDS_WITH]: 'LIKE',
            [SegmentRuleOperator.GREATER_THAN]: '>',
            [SegmentRuleOperator.LESS_THAN]: '<',
            [SegmentRuleOperator.GREATER_OR_EQUAL]: '>=',
            [SegmentRuleOperator.LESS_OR_EQUAL]: '<=',
            [SegmentRuleOperator.IS_SET]: 'IS NOT NULL',
            [SegmentRuleOperator.IS_NOT_SET]: 'IS NULL',
            [SegmentRuleOperator.IN_LIST]: 'IN',
            [SegmentRuleOperator.NOT_IN_LIST]: 'NOT IN',
            [SegmentRuleOperator.BEFORE]: '<',
            [SegmentRuleOperator.AFTER]: '>',
            [SegmentRuleOperator.BETWEEN]: 'BETWEEN',
        };

        return mapping[operator] || null;
    }

    /**
     * Format value based on operator
     */
    private formatValue(value: any, operator: SegmentRuleOperator): string {
        if (operator === SegmentRuleOperator.CONTAINS || operator === SegmentRuleOperator.NOT_CONTAINS) {
            return `'%${value}%'`;
        }

        if (operator === SegmentRuleOperator.STARTS_WITH) {
            return `'${value}%'`;
        }

        if (operator === SegmentRuleOperator.ENDS_WITH) {
            return `'%${value}'`;
        }

        if (operator === SegmentRuleOperator.IN_LIST || operator === SegmentRuleOperator.NOT_IN_LIST) {
            if (Array.isArray(value)) {
                return `(${value.map((v) => `'${v}'`).join(', ')})`;
            }
        }

        if (typeof value === 'string') {
            return `'${value}'`;
        }

        return String(value);
    }
}
