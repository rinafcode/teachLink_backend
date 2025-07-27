import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';

export interface UserProfile {
  id: string;
  preferences: Record<string, number>;
  searchHistory: string[];
  clickHistory: string[];
  categories: Record<string, number>;
  tags: Record<string, number>;
}

export interface PersonalizedResult {
  id: string;
  score: number;
  reason: string;
  metadata: Record<string, any>;
}

@Injectable()
export class DiscoveryAlgorithmService {
  private readonly logger = new Logger(DiscoveryAlgorithmService.name);
  private readonly userIndex = 'user_profiles';
  private readonly interactionIndex = 'user_interactions';
  private readonly contentIndex = 'content_features';

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {}

  async personalizeResults(
    userId: string,
    results: any[],
    algorithm: 'hybrid' | 'collaborative' | 'content' | 'popularity' = 'hybrid',
  ): Promise<PersonalizedResult[]> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Personalizing ${results.length} results for user ${userId} using ${algorithm} algorithm`);

      let personalizedResults: PersonalizedResult[] = [];

      switch (algorithm) {
        case 'collaborative':
          personalizedResults = await this.collaborativeFiltering(userId, results);
          break;
        case 'content':
          personalizedResults = await this.contentBasedFiltering(userId, results);
          break;
        case 'popularity':
          personalizedResults = await this.popularityBasedRanking(results);
          break;
        case 'hybrid':
        default:
          personalizedResults = await this.hybridPersonalization(userId, results);
          break;
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Personalization completed in ${duration}ms for user ${userId}`);

      return personalizedResults;
    } catch (error) {
      this.logger.error(`Personalization failed for user ${userId}`, error);
      // Fallback to original results with basic scoring
      return results.map((result, index) => ({
        id: result.id,
        score: 1.0 - (index * 0.1),
        reason: 'fallback',
        metadata: result,
      }));
    }
  }

  private async collaborativeFiltering(
    userId: string,
    results: any[],
  ): Promise<PersonalizedResult[]> {
    try {
      // Find similar users based on interaction patterns
      const similarUsers = await this.findSimilarUsers(userId);
      
      // Get recommendations from similar users
      const recommendations = await this.getRecommendationsFromSimilarUsers(similarUsers);
      
      // Score results based on collaborative recommendations
      return results.map(result => {
        const collaborativeScore = recommendations[result.id] || 0;
        return {
          id: result.id,
          score: collaborativeScore,
          reason: 'collaborative_filtering',
          metadata: result,
        };
      }).sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Collaborative filtering failed', error);
      throw error;
    }
  }

  private async contentBasedFiltering(
    userId: string,
    results: any[],
  ): Promise<PersonalizedResult[]> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      
      // Calculate content similarity scores
      const contentScores = await Promise.all(
        results.map(async (result) => {
          const similarity = await this.calculateContentSimilarity(userProfile, result);
          return {
            id: result.id,
            score: similarity,
            reason: 'content_based',
            metadata: result,
          };
        })
      );

      return contentScores.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Content-based filtering failed', error);
      throw error;
    }
  }

  private async popularityBasedRanking(results: any[]): Promise<PersonalizedResult[]> {
    try {
      // Score based on popularity metrics
      const popularityScores = await Promise.all(
        results.map(async (result) => {
          const popularity = await this.getContentPopularity(result.id);
          return {
            id: result.id,
            score: popularity,
            reason: 'popularity_based',
            metadata: result,
          };
        })
      );

      return popularityScores.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Popularity-based ranking failed', error);
      throw error;
    }
  }

  private async hybridPersonalization(
    userId: string,
    results: any[],
  ): Promise<PersonalizedResult[]> {
    try {
      // Get scores from different algorithms
      const [collaborativeScores, contentScores, popularityScores] = await Promise.all([
        this.collaborativeFiltering(userId, results),
        this.contentBasedFiltering(userId, results),
        this.popularityBasedRanking(results),
      ]);

      // Combine scores with weights
      const weights = {
        collaborative: 0.4,
        content: 0.4,
        popularity: 0.2,
      };

      const hybridScores = results.map(result => {
        const collaborative = collaborativeScores.find(s => s.id === result.id)?.score || 0;
        const content = contentScores.find(s => s.id === result.id)?.score || 0;
        const popularity = popularityScores.find(s => s.id === result.id)?.score || 0;

        const hybridScore = 
          collaborative * weights.collaborative +
          content * weights.content +
          popularity * weights.popularity;

        return {
          id: result.id,
          score: hybridScore,
          reason: 'hybrid_personalization',
          metadata: result,
        };
      });

      return hybridScores.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error('Hybrid personalization failed', error);
      throw error;
    }
  }

  private async findSimilarUsers(userId: string): Promise<string[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      const result = await this.esService.search({
        index: this.userIndex,
        body: {
          query: {
            bool: {
              must_not: [{ term: { id: userId } }],
              should: [
                {
                  script_score: {
                    query: { match_all: {} },
                    script: {
                      source: `
                        double similarity = 0.0;
                        for (String key : params.userPreferences.keySet()) {
                          if (doc['preferences.' + key].size() > 0) {
                            double userPref = params.userPreferences.get(key);
                            double otherPref = doc['preferences.' + key].value;
                            similarity += Math.min(userPref, otherPref) / Math.max(userPref, otherPref);
                          }
                        }
                        return similarity;
                      `,
                      params: { userPreferences: userProfile.preferences },
                    },
                  },
                },
              ],
            },
          },
          size: 10,
        } as any,
      });

      return result.hits.hits.map(hit => hit._id);
    } catch (error) {
      this.logger.error('Failed to find similar users', error);
      return [];
    }
  }

  private async getRecommendationsFromSimilarUsers(similarUsers: string[]): Promise<Record<string, number>> {
    try {
      const recommendations: Record<string, number> = {};
      
      for (const userId of similarUsers) {
        const interactions = await this.getUserInteractions(userId);
        
        interactions.forEach(interaction => {
          if (!recommendations[interaction.contentId]) {
            recommendations[interaction.contentId] = 0;
          }
          recommendations[interaction.contentId] += interaction.score;
        });
      }

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to get recommendations from similar users', error);
      return {};
    }
  }

  private async calculateContentSimilarity(
    userProfile: UserProfile,
    content: any,
  ): Promise<number> {
    try {
      let similarity = 0.0;
      let totalWeight = 0.0;

      // Category similarity
      if (content.category && userProfile.categories[content.category]) {
        similarity += userProfile.categories[content.category] * 0.3;
        totalWeight += 0.3;
      }

      // Tag similarity
      if (content.tags && Array.isArray(content.tags)) {
        let tagSimilarity = 0.0;
        content.tags.forEach((tag: string) => {
          if (userProfile.tags[tag]) {
            tagSimilarity += userProfile.tags[tag];
          }
        });
        similarity += (tagSimilarity / content.tags.length) * 0.4;
        totalWeight += 0.4;
      }

      // Content type similarity
      if (content.type && userProfile.preferences[`type_${content.type}`]) {
        similarity += userProfile.preferences[`type_${content.type}`] * 0.3;
        totalWeight += 0.3;
      }

      return totalWeight > 0 ? similarity / totalWeight : 0.0;
    } catch (error) {
      this.logger.error('Failed to calculate content similarity', error);
      return 0.0;
    }
  }

  private async getContentPopularity(contentId: string): Promise<number> {
    try {
      const result = await this.esService.search({
        index: this.interactionIndex,
        body: {
          query: {
            bool: {
              must: [
                { term: { contentId } },
                { range: { timestamp: { gte: 'now-30d' } } },
              ],
            },
          },
          aggs: {
            popularity_score: {
              sum: { field: 'score' },
            },
          },
        } as any,
      });
      const aggs = result.aggregations as any;
      const popularity = aggs?.popularity_score?.value || 0;
      return Math.min(popularity / 100, 1.0); 
    } catch (error) {
      this.logger.error('Failed to get content popularity', error);
      return 0.0;
    }
  }

  async updateUserProfile(userId: string, interaction: any) {
    try {
      await this.esService.index({
        index: this.interactionIndex,
        body: {
          userId,
          contentId: interaction.contentId,
          type: interaction.type, 
          score: interaction.score || 1.0,
          timestamp: new Date().toISOString(),
        },
      });

      // Update user profile based on interaction
      await this.updateUserPreferences(userId, interaction);
      
      this.logger.debug(`Updated user profile for ${userId} with interaction ${interaction.type}`);
    } catch (error) {
      this.logger.error(`Failed to update user profile for ${userId}`, error);
    }
  }

  private async updateUserPreferences(userId: string, interaction: any) {
    try {
      const userProfile = await this.getUserProfile(userId);
      
      // Update preferences based on interaction type
      switch (interaction.type) {
        case 'click':
          this.updateClickPreferences(userProfile, interaction);
          break;
        case 'like':
          this.updateLikePreferences(userProfile, interaction);
          break;
        case 'search':
          this.updateSearchPreferences(userProfile, interaction);
          break;
      }

      // Save updated profile
      const { id, ...profileBody } = userProfile;
      await this.esService.index({
        index: this.userIndex,
        id,
        body: profileBody,
      });
    } catch (error) {
      this.logger.error(`Failed to update user preferences for ${userId}`, error);
    }
  }

  private updateClickPreferences(profile: UserProfile, interaction: any) {
    const content = interaction.content;
    if (!content) return;

    // Update category preference
    if (content.category) {
      profile.categories[content.category] = 
        (profile.categories[content.category] || 0) + 0.1;
    }

    // Update tag preferences
    if (content.tags && Array.isArray(content.tags)) {
      content.tags.forEach((tag: string) => {
        profile.tags[tag] = (profile.tags[tag] || 0) + 0.05;
      });
    }

    // Update content type preference
    if (content.type) {
      const typeKey = `type_${content.type}`;
      profile.preferences[typeKey] = (profile.preferences[typeKey] || 0) + 0.1;
    }
  }

  private updateLikePreferences(profile: UserProfile, interaction: any) {
    // Similar to click but with higher weight
    const content = interaction.content;
    if (!content) return;

    if (content.category) {
      profile.categories[content.category] = 
        (profile.categories[content.category] || 0) + 0.2;
    }

    if (content.tags && Array.isArray(content.tags)) {
      content.tags.forEach((tag: string) => {
        profile.tags[tag] = (profile.tags[tag] || 0) + 0.1;
      });
    }
  }

  private updateSearchPreferences(profile: UserProfile, interaction: any) {
    // Update search history
    if (interaction.query) {
      profile.searchHistory.push(interaction.query);
      // Keep only last 100 searches
      if (profile.searchHistory.length > 100) {
        profile.searchHistory = profile.searchHistory.slice(-100);
      }
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const result = await this.esService.get({
        index: this.userIndex,
        id: userId,
      });

      return result._source as UserProfile;
    } catch (error) {
      // Return default profile if user doesn't exist
      return {
        id: userId,
        preferences: {},
        searchHistory: [],
        clickHistory: [],
        categories: {},
        tags: {},
      };
    }
  }

  private async getUserInteractions(userId: string): Promise<any[]> {
    try {
      const result = await this.esService.search({
        index: this.interactionIndex,
        body: {
          query: { term: { userId } },
          sort: [{ timestamp: { order: 'desc' } }],
          size: 100,
        }
      } as unknown as SearchRequest);

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      this.logger.error(`Failed to get interactions for user ${userId}`, error);
      return [];
    }
  }

  async getPersonalizationStats(userId: string) {
    try {
      const profile = await this.getUserProfile(userId);
      const interactions = await this.getUserInteractions(userId);

      return {
        userId,
        totalInteractions: interactions.length,
        topCategories: Object.entries(profile.categories)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([category, score]) => ({ category, score })),
        topTags: Object.entries(profile.tags)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([tag, score]) => ({ tag, score })),
        recentSearches: profile.searchHistory.slice(-10),
      };
    } catch (error) {
      this.logger.error(`Failed to get personalization stats for user ${userId}`, error);
      return null;
    }
  }
}