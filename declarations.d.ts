declare module 'langchain/embeddings/openai';
declare module 'langchain/embeddings/hf';

declare module 'bull' {
  interface Job {
    id: string | number;
    name: string;
    data: Record<string, any>;
    progress: (value: number | object) => Promise<void>;
  }

  interface Queue {
    add: (name: string, data: any, opts?: any) => Promise<Job>;
    process: (concurrency: number, handler: (job: Job) => Promise<any>) => void;
    close: () => Promise<void>;
  }
}
