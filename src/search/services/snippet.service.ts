import { Injectable } from '@nestjs/common';

@Injectable()
export class SnippetService {
  generateSnippet(text: string, query: string): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.substring(0, 200);

    const start = Math.max(0, idx - 50);
    const end = Math.min(text.length, idx + query.length + 150);
    let snippet = text.substring(start, end);

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');
    snippet = snippet.replace(regex, '<mark>$1</mark>');

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }
}
