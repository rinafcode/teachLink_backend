import { Injectable } from '@nestjs/common';

@Injectable()
export class PathGenerationService {
  async generate(goal: string, skillLevels: Record<string, number>) {
    // Based on goal and skillLevels, return a path
    // This can later be replaced with a rules engine or AI model
    return [
      { title: 'Intro to HTML', skill: 'frontend' },
      { title: 'Basic JavaScript', skill: 'frontend' },
      { title: 'APIs with Express', skill: 'backend' },
    ];
  }
}
