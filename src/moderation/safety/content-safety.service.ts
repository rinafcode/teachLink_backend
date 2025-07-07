import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyScore, SafetyCategory } from '../entities/safety-score.entity';
import axios from 'axios';

export interface ContentAnalysisResult {
  overallScore: number;
  categoryScores: Record<SafetyCategory, number>;
  flaggedCategories: SafetyCategory[];
  confidence: number;
  analysis: Record<string, any>;
}

@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);

  // Safety thresholds for different categories
  private readonly SAFETY_THRESHOLDS = {
    [SafetyCategory.VIOLENCE]: 0.3,
    [SafetyCategory.HARASSMENT]: 0.3,
    [SafetyCategory.HATE_SPEECH]: 0.3,
    [SafetyCategory.SEXUAL_CONTENT]: 0.3,
    [SafetyCategory.SPAM]: 0.2,
    [SafetyCategory.MISINFORMATION]: 0.4,
    [SafetyCategory.COPYRIGHT]: 0.5,
    [SafetyCategory.PRIVACY]: 0.6,
  };

  constructor(
    @InjectRepository(SafetyScore)
    private safetyScoreRepository: Repository<SafetyScore>,
  ) {}

  async analyzeContent(contentId: string, contentType: string): Promise<SafetyScore> {
    this.logger.log(`Analyzing content ${contentId} for safety`);

    try {
      // Get content data (this would be implemented based on your content storage)
      const contentData = await this.getContentData(contentId, contentType);
      
      // Perform AI analysis
      const analysisResult = await this.performAIAnalysis(contentData);
      
      // Create safety score record
      const safetyScore = this.safetyScoreRepository.create({
        contentId,
        contentType,
        overallScore: analysisResult.overallScore,
        categoryScores: analysisResult.categoryScores,
        flaggedCategories: analysisResult.flaggedCategories,
        aiAnalysis: analysisResult.analysis,
        requiresManualReview: analysisResult.overallScore < 0.5,
      });

      return this.safetyScoreRepository.save(safetyScore);
    } catch (error) {
      this.logger.error(`Error analyzing content ${contentId}:`, error);
      throw error;
    }
  }

  async getContentSafetyScore(contentId: string): Promise<SafetyScore | null> {
    return this.safetyScoreRepository.findOne({
      where: { contentId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateSafetyScore(
    contentId: string,
    humanReview: Record<string, any>,
    reviewedBy: string,
  ): Promise<SafetyScore> {
    const safetyScore = await this.safetyScoreRepository.findOne({
      where: { contentId },
      order: { createdAt: 'DESC' },
    });

    if (!safetyScore) {
      throw new Error('Safety score not found for content');
    }

    safetyScore.humanReview = humanReview;
    safetyScore.reviewedBy = reviewedBy;
    safetyScore.reviewedAt = new Date();

    return this.safetyScoreRepository.save(safetyScore);
  }

  async getSafetyTrends(contentId: string, days = 30): Promise<SafetyScore[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.safetyScoreRepository
      .createQueryBuilder('score')
      .where('score.contentId = :contentId', { contentId })
      .andWhere('score.createdAt >= :cutoffDate', { cutoffDate })
      .orderBy('score.createdAt', 'ASC')
      .getMany();
  }

  async getCategoryBreakdown(contentType?: string): Promise<Record<SafetyCategory, number>> {
    const query = this.safetyScoreRepository
      .createQueryBuilder('score')
      .select('score.categoryScores', 'categoryScores');

    if (contentType) {
      query.where('score.contentType = :contentType', { contentType });
    }

    const scores = await query.getMany();
    
    const breakdown: Record<SafetyCategory, number> = {
      [SafetyCategory.VIOLENCE]: 0,
      [SafetyCategory.HARASSMENT]: 0,
      [SafetyCategory.HATE_SPEECH]: 0,
      [SafetyCategory.SEXUAL_CONTENT]: 0,
      [SafetyCategory.SPAM]: 0,
      [SafetyCategory.MISINFORMATION]: 0,
      [SafetyCategory.COPYRIGHT]: 0,
      [SafetyCategory.PRIVACY]: 0,
    };

    let count = 0;
    for (const score of scores) {
      count++;
      for (const category of Object.values(SafetyCategory)) {
        breakdown[category] += score.categoryScores[category] || 0;
      }
    }

    // Calculate averages
    if (count > 0) {
      for (const category of Object.values(SafetyCategory)) {
        breakdown[category] = breakdown[category] / count;
      }
    }

    return breakdown;
  }

  private async getContentData(contentId: string, contentType: string): Promise<any> {
    // This method would retrieve content data based on the content type
    // Implementation depends on your content storage system
    
    this.logger.log(`Retrieving content data for ${contentId} of type ${contentType}`);
    
    // Placeholder implementation - replace with actual content retrieval
    switch (contentType) {
      case 'course':
        return { title: 'Sample Course', description: 'Sample description' };
      case 'lesson':
        return { title: 'Sample Lesson', content: 'Sample content' };
      case 'comment':
        return { text: 'Sample comment' };
      case 'discussion':
        return { title: 'Sample Discussion', content: 'Sample discussion content' };
      default:
        return { content: 'Sample content' };
    }
  }

  /**
   * Performs AI-powered content analysis using a pluggable provider.
   * By default, uses a mock implementation. To use a real provider, set AI_PROVIDER and API_KEY in config.
   *
   * Supported providers: 'mock' (default), 'openai', 'custom'
   */
  private async performAIAnalysis(contentData: any): Promise<ContentAnalysisResult> {
    this.logger.log('Performing AI analysis on content');

    const provider = process.env.AI_PROVIDER || 'mock';
    const apiKey = process.env.AI_API_KEY;
    const apiEndpoint = process.env.AI_API_ENDPOINT;

    if (provider === 'openai' && apiKey && apiEndpoint) {
      // Example: Call OpenAI API (replace with your actual endpoint and payload)
      try {
        const text = this.extractText(contentData);
        const response = await axios.post(
          apiEndpoint,
          {
            model: 'gpt-4',
            prompt: `Analyze this content for safety: ${text}`,
            // Add more structured prompt or use function calling as needed
          },
          {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          }
        );
        // Parse response to extract category scores, etc.
        // This is a placeholder; adapt to your provider's response format
        const aiResult = response.data;
        // Example mapping (replace with real logic):
        const categoryScores: Record<SafetyCategory, number> = {
          [SafetyCategory.VIOLENCE]: aiResult.violence ?? 0.9,
          [SafetyCategory.HARASSMENT]: aiResult.harassment ?? 0.9,
          [SafetyCategory.HATE_SPEECH]: aiResult.hate_speech ?? 0.9,
          [SafetyCategory.SEXUAL_CONTENT]: aiResult.sexual_content ?? 0.9,
          [SafetyCategory.SPAM]: aiResult.spam ?? 0.9,
          [SafetyCategory.MISINFORMATION]: aiResult.misinformation ?? 0.9,
          [SafetyCategory.COPYRIGHT]: aiResult.copyright ?? 0.9,
          [SafetyCategory.PRIVACY]: aiResult.privacy ?? 0.9,
        };
        const overallScore = this.calculateOverallScore(categoryScores);
        const flaggedCategories = this.getFlaggedCategories(categoryScores);
        const confidence = aiResult.confidence ?? this.calculateConfidence(categoryScores);
        return {
          overallScore,
          categoryScores,
          flaggedCategories,
          confidence,
          analysis: aiResult,
        };
      } catch (error) {
        this.logger.error('AI provider error, falling back to mock analysis', error);
        // Fallback to mock
      }
    } else if (provider === 'custom' && apiKey && apiEndpoint) {
      // Example: Call a custom AI/ML API
      try {
        const response = await axios.post(apiEndpoint, { content: contentData }, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        // Parse and map response as above
        const aiResult = response.data;
        // ... mapping logic ...
        // For brevity, fallback to mock if not implemented
      } catch (error) {
        this.logger.error('Custom AI provider error, falling back to mock analysis', error);
      }
    }
    // Default: mock analysis (for dev/testing)
    const categoryScores = await this.analyzeCategories(contentData);
    const overallScore = this.calculateOverallScore(categoryScores);
    const flaggedCategories = this.getFlaggedCategories(categoryScores);
    const confidence = this.calculateConfidence(categoryScores);
    return {
      overallScore,
      categoryScores,
      flaggedCategories,
      confidence,
      analysis: {
        model: 'mock-ai-model',
        version: '1.0.0',
        confidence,
        processingTime: Math.random() * 1000,
        features: this.extractFeatures(contentData),
      },
    };
  }

  private async analyzeCategories(contentData: any): Promise<Record<SafetyCategory, number>> {
    const scores: Record<SafetyCategory, number> = {
      [SafetyCategory.VIOLENCE]: 0.8,
      [SafetyCategory.HARASSMENT]: 0.9,
      [SafetyCategory.HATE_SPEECH]: 0.95,
      [SafetyCategory.SEXUAL_CONTENT]: 0.9,
      [SafetyCategory.SPAM]: 0.85,
      [SafetyCategory.MISINFORMATION]: 0.7,
      [SafetyCategory.COPYRIGHT]: 0.8,
      [SafetyCategory.PRIVACY]: 0.9,
    };

    // Mock analysis based on content data
    const text = this.extractText(contentData);
    
    // Simple keyword-based analysis (replace with actual AI)
    const keywords = {
      [SafetyCategory.VIOLENCE]: ['violence', 'attack', 'kill', 'harm', 'weapon'],
      [SafetyCategory.HARASSMENT]: ['harass', 'bully', 'threaten', 'intimidate'],
      [SafetyCategory.HATE_SPEECH]: ['hate', 'racist', 'discriminate', 'bigot'],
      [SafetyCategory.SEXUAL_CONTENT]: ['sexual', 'explicit', 'adult', 'mature'],
      [SafetyCategory.SPAM]: ['spam', 'scam', 'click here', 'free money'],
      [SafetyCategory.MISINFORMATION]: ['fake news', 'conspiracy', 'hoax'],
      [SafetyCategory.COPYRIGHT]: ['copyright', 'plagiarism', 'stolen'],
      [SafetyCategory.PRIVACY]: ['personal', 'private', 'confidential'],
    };

    for (const [category, categoryKeywords] of Object.entries(keywords)) {
      const matches = categoryKeywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        scores[category as SafetyCategory] = Math.max(0.1, scores[category as SafetyCategory] - (matches.length * 0.2));
      }
    }

    return scores;
  }

  private extractText(contentData: any): string {
    // Extract text content from various content types
    if (typeof contentData === 'string') {
      return contentData;
    }
    
    if (contentData.text) {
      return contentData.text;
    }
    
    if (contentData.content) {
      return contentData.content;
    }
    
    if (contentData.description) {
      return contentData.description;
    }
    
    if (contentData.title) {
      return contentData.title;
    }
    
    return JSON.stringify(contentData);
  }

  private extractFeatures(contentData: any): Record<string, any> {
    const text = this.extractText(contentData);
    
    return {
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
      hasLinks: text.includes('http'),
      hasEmails: /\S+@\S+\.\S+/.test(text),
      hasPhoneNumbers: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text),
      language: 'en', // Mock language detection
      sentiment: this.analyzeSentiment(text),
    };
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'horrible', 'worst'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    }
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateOverallScore(categoryScores: Record<SafetyCategory, number>): number {
    const scores = Object.values(categoryScores);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private getFlaggedCategories(categoryScores: Record<SafetyCategory, number>): SafetyCategory[] {
    const flagged: SafetyCategory[] = [];
    
    for (const [category, score] of Object.entries(categoryScores)) {
      const threshold = this.SAFETY_THRESHOLDS[category as SafetyCategory];
      if (score < threshold) {
        flagged.push(category as SafetyCategory);
      }
    }
    
    return flagged;
  }

  private calculateConfidence(categoryScores: Record<SafetyCategory, number>): number {
    // Calculate confidence based on score consistency and analysis quality
    const scores = Object.values(categoryScores);
    const variance = this.calculateVariance(scores);
    
    // Higher variance means lower confidence
    let confidence = 0.8 - (variance * 0.5);
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
} 