import { Injectable } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';

@Injectable()
export class AutoModerationService {
  private hf: HfInference;

  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }

  async analyze(content: string): Promise<{ flagged: boolean; reasons: string[]; score: number }> {
    const result = await this.hf.textClassification({
      model: 's-nlp/roberta_toxicity_classifier', // or 'unitary/toxic-bert'
      inputs: content,
    });

    // result is an array of { label, score }
    const toxicLabel = result.find(r => r.label.toLowerCase().includes('toxic'));
    const score = toxicLabel ? toxicLabel.score : 0;

    return {
      flagged: score > 0.7, // threshold can be tuned
      reasons: score > 0.7 ? ['AI model detected toxicity'] : [],
      score,
    };
  }
}
