import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationAction, ActionType, ActionSeverity } from '../entities/moderation-action.entity';
import { SafetyScore, SafetyCategory } from '../entities/safety-score.entity';
import { ContentSafetyService } from '../safety/content-safety.service';
import { MediaService } from '../../media/media.service';
import { LessonsService } from '../../courses/lessons/lessons.service';
import { CoursesService } from '../../courses/courses.service';
import { ModulesService } from '../../courses/modules/modules.service';
import { UsersService } from '../../users/users.service';

export interface AutoModerationResult {
  flagged: boolean;
  confidence: number;
  categories: SafetyCategory[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction?: ActionType;
  explanation: string;
}

@Injectable()
export class AutoModerationService {
  private readonly logger = new Logger(AutoModerationService.name);

  // Thresholds for automated actions
  private readonly THRESHOLDS = {
    CRITICAL: 0.1, // Auto-remove content
    HIGH: 0.3,     // Auto-hide content
    MEDIUM: 0.5,   // Flag for manual review
    LOW: 0.7,      // Monitor
  };

  constructor(
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(SafetyScore)
    private safetyScoreRepository: Repository<SafetyScore>,
    private contentSafetyService: ContentSafetyService,
    private mediaService: MediaService,
    private lessonsService: LessonsService,
    private coursesService: CoursesService,
    private modulesService: ModulesService,
    private usersService: UsersService,
  ) {}

  async processContent(contentId: string, contentType: string): Promise<AutoModerationResult> {
    this.logger.log(`Processing content ${contentId} for automated moderation`);

    try {
      // Get or create safety score
      let safetyScore = await this.safetyScoreRepository.findOne({
        where: { contentId },
        order: { createdAt: 'DESC' },
      });

      if (!safetyScore) {
        safetyScore = await this.contentSafetyService.analyzeContent(contentId, contentType);
      }

      // Analyze content for violations
      const result = await this.analyzeContent(safetyScore);

      // Take automated action if necessary
      if (result.flagged && result.recommendedAction) {
        await this.takeAutomatedAction(contentId, contentType, result);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in auto-moderation for content ${contentId}:`, error);
      throw error;
    }
  }

  async analyzeContent(safetyScore: SafetyScore): Promise<AutoModerationResult> {
    const overallScore = safetyScore.overallScore;
    const flaggedCategories = safetyScore.flaggedCategories || [];

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (overallScore <= this.THRESHOLDS.CRITICAL) {
      riskLevel = 'critical';
    } else if (overallScore <= this.THRESHOLDS.HIGH) {
      riskLevel = 'high';
    } else if (overallScore <= this.THRESHOLDS.MEDIUM) {
      riskLevel = 'medium';
    }

    // Check for specific violations
    const violations = await this.detectViolations(safetyScore);
    const flagged = violations.length > 0 || overallScore < this.THRESHOLDS.MEDIUM;

    // Determine recommended action
    let recommendedAction: ActionType | undefined;
    if (overallScore <= this.THRESHOLDS.CRITICAL) {
      recommendedAction = ActionType.REMOVE_CONTENT;
    } else if (overallScore <= this.THRESHOLDS.HIGH) {
      recommendedAction = ActionType.HIDE_CONTENT;
    } else if (flagged) {
      recommendedAction = ActionType.FLAG_FOR_REVIEW;
    }

    return {
      flagged,
      confidence: this.calculateConfidence(safetyScore),
      categories: flaggedCategories,
      riskLevel,
      recommendedAction,
      explanation: this.generateExplanation(violations, overallScore),
    };
  }

  private async detectViolations(safetyScore: SafetyScore): Promise<string[]> {
    const violations: string[] = [];
    const categoryScores = safetyScore.categoryScores;

    // Check for specific category violations
    if (categoryScores[SafetyCategory.VIOLENCE] < 0.3) {
      violations.push('violence');
    }
    if (categoryScores[SafetyCategory.HARASSMENT] < 0.3) {
      violations.push('harassment');
    }
    if (categoryScores[SafetyCategory.HATE_SPEECH] < 0.3) {
      violations.push('hate_speech');
    }
    if (categoryScores[SafetyCategory.SEXUAL_CONTENT] < 0.3) {
      violations.push('sexual_content');
    }
    if (categoryScores[SafetyCategory.SPAM] < 0.2) {
      violations.push('spam');
    }
    if (categoryScores[SafetyCategory.MISINFORMATION] < 0.4) {
      violations.push('misinformation');
    }

    return violations;
  }

  private calculateConfidence(safetyScore: SafetyScore): number {
    // Calculate confidence based on AI analysis quality and consistency
    const aiAnalysis = safetyScore.aiAnalysis;
    if (!aiAnalysis) return 0.5;

    // Factors that increase confidence:
    // - High consistency across different analysis methods
    // - Clear violation patterns
    // - Multiple detection methods agree
    
    let confidence = 0.5;
    
    if (aiAnalysis.confidence) {
      confidence = aiAnalysis.confidence;
    }

    // Adjust based on category scores consistency
    const categoryScores = Object.values(safetyScore.categoryScores);
    const variance = this.calculateVariance(categoryScores);
    confidence += (1 - variance) * 0.3;

    return Math.min(confidence, 1.0);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private generateExplanation(violations: string[], overallScore: number): string {
    if (violations.length === 0) {
      return `Content appears safe with overall score of ${overallScore.toFixed(2)}`;
    }

    const violationList = violations.join(', ');
    return `Content flagged for violations: ${violationList}. Overall safety score: ${overallScore.toFixed(2)}`;
  }

  private async takeAutomatedAction(
    contentId: string,
    contentType: string,
    result: AutoModerationResult,
  ): Promise<void> {
    if (!result.recommendedAction) return;

    this.logger.log(`Taking automated action ${result.recommendedAction} on content ${contentId}`);

    const action = this.moderationActionRepository.create({
      contentId,
      contentType,
      actionType: result.recommendedAction,
      severity: this.mapRiskLevelToSeverity(result.riskLevel),
      reason: `Automated action: ${result.explanation}`,
      evidence: {
        autoModeration: true,
        confidence: result.confidence,
        categories: result.categories,
        riskLevel: result.riskLevel,
      },
    });

    await this.moderationActionRepository.save(action);

    // Execute the action
    await this.executeAction(action);
  }

  private mapRiskLevelToSeverity(riskLevel: string): ActionSeverity {
    switch (riskLevel) {
      case 'critical':
        return ActionSeverity.CRITICAL;
      case 'high':
        return ActionSeverity.HIGH;
      case 'medium':
        return ActionSeverity.MEDIUM;
      default:
        return ActionSeverity.LOW;
    }
  }

  private async executeAction(action: ModerationAction): Promise<void> {
    switch (action.actionType) {
      case ActionType.REMOVE_CONTENT:
        await this.removeContent(action.contentId, action.contentType);
        break;
      case ActionType.HIDE_CONTENT:
        await this.hideContent(action.contentId, action.contentType);
        break;
      case ActionType.FLAG_FOR_REVIEW:
        // Content is already flagged, no additional action needed
        break;
      default:
        this.logger.warn(`Unknown automated action type: ${action.actionType}`);
    }
  }

  private async removeContent(contentId: string, contentType: string): Promise<void> {
    this.logger.log(`Automatically removing content ${contentId} of type ${contentType}`);
    switch (contentType) {
      case 'course':
        await this.coursesService.update(contentId, { isRemoved: true });
        break;
      case 'lesson':
        await this.lessonsService.update(contentId, { isRemoved: true });
        break;
      case 'media':
        await this.mediaService.update(contentId, { isRemoved: true });
        break;
      default:
        this.logger.warn(`Unknown content type for removal: ${contentType}`);
    }
  }

  private async hideContent(contentId: string, contentType: string): Promise<void> {
    this.logger.log(`Automatically hiding content ${contentId} of type ${contentType}`);
    switch (contentType) {
      case 'course':
        await this.coursesService.update(contentId, { isHidden: true });
        break;
      case 'lesson':
        await this.lessonsService.update(contentId, { isHidden: true });
        break;
      case 'media':
        await this.mediaService.update(contentId, { isHidden: true });
        break;
      default:
        this.logger.warn(`Unknown content type for hiding: ${contentType}`);
    }
  }

  async getModerationStats(): Promise<{
    totalProcessed: number;
    flaggedContent: number;
    automatedActions: number;
    averageConfidence: number;
  }> {
    const [totalActions] = await this.moderationActionRepository
      .createQueryBuilder('action')
      .where('action.evidence->>\'autoModeration\' = :autoMod', { autoMod: 'true' })
      .getManyAndCount();

    const flaggedActions = totalActions.filter(action => 
      action.actionType !== ActionType.APPROVE
    );

    const averageConfidence = flaggedActions.length > 0
      ? flaggedActions.reduce((sum, action) => 
          sum + (action.evidence?.confidence || 0), 0) / flaggedActions.length
      : 0;

    return {
      totalProcessed: totalActions.length,
      flaggedContent: flaggedActions.length,
      automatedActions: flaggedActions.length,
      averageConfidence,
    };
  }
} 