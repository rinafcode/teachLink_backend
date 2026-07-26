import {
  sanitizeHtmlContent,
  sanitizeTextInput,
  hasXssPatterns,
  sanitizeSqlLike,
} from './sanitization.utils';

describe('sanitization.utils - sanitizeTextInput', () => {
  it('strips <script> tags and content', () => {
    const evil = '<script>alert("xss")</script>SAFE';
    expect(sanitizeTextInput(evil)).toBe('SAFE');
  });

  it('strips event handlers from <img> tags', () => {
    const evil = '<img src=x onerror=alert(1)>';
    expect(sanitizeTextInput(evil)).toBe('');
  });

  it('strips <iframe>, <object>, <embed>, <svg>', () => {
    expect(sanitizeTextInput('<iframe src="evil"></iframe>')).toBe('');
    expect(sanitizeTextInput('<object data="evil"></object>')).toBe('');
    expect(sanitizeTextInput('<embed src="evil">')).toBe('');
    expect(sanitizeTextInput('<svg/onload=alert(1)>')).toBe('');
  });

  it('strips inline event handler attributes from arbitrary tags', () => {
    expect(sanitizeTextInput('<a href="#" onclick="steal()">x</a>')).toBe('x');
    expect(sanitizeTextInput('<div onmouseover="bad()">text</div>')).toBe('text');
  });

  // With all tags stripped, sanitize-html defensively encodes angle brackets
  // as HTML entities. This is correct behavior: the resulting string is safe
  // to drop into any downstream HTML context without re-introducing XSS.
  it('defensively encodes residual angle brackets as HTML entities', () => {
    expect(sanitizeTextInput('a < b and c > d')).toBe('a &lt; b and c &gt; d');
    expect(sanitizeTextInput('I <3 this')).toBe('I &lt;3 this');
  });

  it('collapses dangerous nested payloads', () => {
    const nested = '<div><script>alert(1)</script><b>ok</b></div>';
    expect(sanitizeTextInput(nested)).toBe('ok');
  });

  it('throws a TypeError on non-string input', () => {
    expect(() => sanitizeTextInput(123 as unknown as string)).toThrow(TypeError);
    expect(() => sanitizeTextInput(null as unknown as string)).toThrow(TypeError);
  });
});

describe('sanitization.utils - sanitizeHtmlContent', () => {
  it('keeps whitelisted tags', () => {
    expect(sanitizeHtmlContent('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>',
    );
  });

  it('strips <script> tags but keeps surrounding safe content', () => {
    expect(sanitizeHtmlContent('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('strips on* event handlers and forces rel="noopener noreferrer" on anchors', () => {
    const evil = '<a href="https://example.com" onclick="bad()">link</a>';
    const sanitized = sanitizeHtmlContent(evil);
    expect(sanitized).not.toMatch(/onclick/i);
    expect(sanitized).toMatch(/rel="noopener noreferrer"/);
    expect(sanitized).toContain('href="https://example.com"');
  });

  it('removes dangerous xss schemes from href', () => {
    const evil = '<a href="javascript:alert(1)">click</a>';
    const sanitized = sanitizeHtmlContent(evil);
    expect(sanitized).not.toMatch(/javascript:/i);
    // After javascript: stripping, the href attribute itself is dropped.
    expect(sanitized).not.toMatch(/\bhref=/);
  });

  it('disallows data: URIs', () => {
    const evil = '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>';
    expect(sanitizeHtmlContent(evil)).not.toMatch(/data:/i);
  });

  it('strips <iframe>, <object>, <embed>', () => {
    expect(sanitizeHtmlContent('<iframe src="x"></iframe>safe')).toBe('safe');
    expect(sanitizeHtmlContent('<object data="x"></object>safe')).toBe('safe');
    expect(sanitizeHtmlContent('<embed src="x">safe')).toBe('safe');
  });

  it('throws a TypeError on non-string input', () => {
    expect(() => sanitizeHtmlContent({} as unknown as string)).toThrow(TypeError);
  });
});

describe('sanitization.utils - hasXssPatterns', () => {
  it('detects <script>', () => {
    expect(hasXssPatterns('<script>alert(1)</script>')).toBe(true);
  });

  it('detects javascript: scheme', () => {
    expect(hasXssPatterns('javascript:alert(1)')).toBe(true);
  });

  it('detects inline event handlers', () => {
    expect(hasXssPatterns('<img onerror=alert(1)>')).toBe(true);
    expect(hasXssPatterns('onload=bad()')).toBe(true);
  });

  it('detects dangerous embed elements', () => {
    expect(hasXssPatterns('<iframe src=x>')).toBe(true);
    expect(hasXssPatterns('<object data=x>')).toBe(true);
  });

  it('detects data:text/html', () => {
    expect(hasXssPatterns('data:text/html;base64,foo')).toBe(true);
  });

  it('returns false for benign content', () => {
    expect(hasXssPatterns('Hello, world!')).toBe(false);
    expect(hasXssPatterns('plain@example.com')).toBe(false);
  });

  it('returns false for empty or non-string', () => {
    expect(hasXssPatterns('')).toBe(false);
    expect(hasXssPatterns(undefined as unknown as string)).toBe(false);
  });
});

describe('sanitization.utils - sanitizeSqlLike (regression)', () => {
  it('escapes SQL LIKE wildcards', () => {
    expect(sanitizeSqlLike('100%')).toBe('100\\%');
    expect(sanitizeSqlLike('a_b')).toBe('a\\_b');
  });

  it('preserves ordinary text', () => {
    expect(sanitizeSqlLike('hello')).toBe('hello');
  });
});
