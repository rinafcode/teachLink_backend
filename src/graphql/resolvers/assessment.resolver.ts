import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { AssessmentType, QuestionType } from '../types/assessment.type';
/**
 * Field Resolver for Assessment type
 * Handles nested field resolution for assessment questions
 */
@Resolver(() => AssessmentType)
export class AssessmentResolver {
  /**
   * Executes questions.
   * @param assessment The assessment.
   * @returns The matching results.
   */
  @ResolveField(() => [QuestionType])
  async questions(@Parent() assessment: AssessmentType): Promise<QuestionType[]> {
    // Questions are typically loaded with the assessment
    // This resolver ensures proper GraphQL type resolution
    return assessment.questions || [];
  }
}
