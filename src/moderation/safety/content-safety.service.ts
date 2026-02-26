import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentSafetyService {
  scoreContent(content: string): number {
    // Simple scoring logic (replace with ML model later)
    let score = 0;
    if (/violence|hate|explicit/i.test(content)) score += 0.8;
    if (/spam|scam/i.test(content)) score += 0.5;
    return Math.min(score, 1);
  }
}
