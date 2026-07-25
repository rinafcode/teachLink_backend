import { SanitizationPipe } from './sanitization.pipe';

describe('SanitizationPipe', () => {
  const pipe = new SanitizationPipe();

  it('strips HTML tags from a plain-string string field', () => {
    const input = { name: '<script>alert(1)</script>Alice' };
    const out = pipe.transform(input, { type: 'body' }) as {
      name: string;
    };

    expect(out.name).toBe('Alice');
  });

  it('recurses through nested objects', () => {
    const input = {
      profile: {
        bio: '<img src=x onerror=alert(1)>safe',
        contact: { email: 'plain@example.com' },
      },
    };
    const out = pipe.transform(input, { type: 'body' }) as {
      profile: { bio: string; contact: { email: string } };
    };

    expect(out.profile.bio).toBe('safe');
    expect(out.profile.contact.email).toBe('plain@example.com');
  });

  it('recurses through arrays in plain mode', () => {
    const input = { tags: ['<b>ok</b>', '<script>alert(1)</script>', 'plain'] };
    const out = pipe.transform(input, { type: 'body' }) as {
      tags: string[];
    };

    expect(out.tags).toEqual(['ok', '', 'plain']);
  });

  it('preserves password field values verbatim', () => {
    const input = { password: 'P@ss<w0rd>!', name: '<b>Bob</b>' };
    const out = pipe.transform(input, { type: 'body' }) as {
      password: string;
      name: string;
    };

    expect(out.password).toBe('P@ss<w0rd>!');
    expect(out.name).toBe('Bob');
  });

  it('preserves token / hash / signature field values', () => {
    const input = {
      token: 'abc<>123',
      refreshToken: 'r<>ef',
      apiKey: 'k<ey>',
      signature: 'sig<nat>',
      hash: 'h<>ash',
    };
    const out = pipe.transform(input, { type: 'body' }) as Record<
      string,
      string
    >;

    for (const key of Object.keys(input)) {
      expect(out[key]).toBe(input[key as keyof typeof input]);
    }
  });

  it('does not treat markdown fields as rich text', () => {
    // Markdown is rendered downstream; pipe leaves the literal text intact
    // except for the universal plain-text strip of dangerous tags.
    const input = { bodyMarkdown: '<img onerror=alert(1)>hello' };
    const out = pipe.transform(input, { type: 'body' }) as {
      bodyMarkdown: string;
    };

    expect(out.bodyMarkdown).toBe('hello');
  });

  it('applies HTML whitelist sanitization to rich-text fields by name suffix', () => {
    const input = {
      bodyHtml: '<p>ok</p><script>alert(1)</script>',
      commentRichText: '<a href="javascript:bad()">x</a>',
    };
    const out = pipe.transform(input, { type: 'body' }) as Record<
      string,
      string
    >;

    expect(out.bodyHtml).toBe('<p>ok</p>');

    expect(out.commentRichText).not.toMatch(/javascript:/i);
    expect(out.commentRichText).not.toMatch(/href/);
    expect(out.commentRichText).toContain('x');
    expect(out.commentRichText).toMatch(/rel="noopener noreferrer"/);
  });

  it('preserves rich mode inside arrays within rich-text fields', () => {
    const input = {
      bodyHtml: ['<p>a</p>', '<script>bad</script>', '<strong>b</strong>'],
    };
    const out = pipe.transform(input, { type: 'body' }) as {
      bodyHtml: string[];
    };

    expect(out.bodyHtml).toEqual(['<p>a</p>', '', '<strong>b</strong>']);
  });

  it('preserves rich mode through nested objects inside rich-text fields', () => {
    const input = { bodyHtml: { inner: '<i>x</i><script>bad</script>' } };
    const out = pipe.transform(input, { type: 'body' }) as {
      bodyHtml: { inner: string };
    };

    expect(out.bodyHtml.inner).toBe('<i>x</i>');
  });

  it('falls back to plain text beyond the recursion cap (fail-closed)', () => {
    let deep: Record<string, unknown> = { leaf: '<script>x</script>safe' };
    for (let i = 0; i < 50; i += 1) {
      deep = { nest: deep };
    }
    const out = pipe.transform(deep, { type: 'body' }) as Record<
      string,
      unknown
    >;
    const serialized = JSON.stringify(out);
    // Even at the boundary, no executable <script> token survives — either
    // the safe inner value remained or the boundary plain-text sanitization
    // stripped it.
    expect(serialized).not.toMatch(/<script>/i);
  });

  it('returns null/undefined inputs untouched', () => {
    expect(pipe.transform(null, { type: 'body' })).toBeNull();
    expect(pipe.transform(undefined, { type: 'body' })).toBeUndefined();
  });

  it('preserves non-string primitives', () => {
    const input = {
      age: 42,
      active: true,
      score: 3.14,
      nothing: null,
      meta: undefined,
    };
    const out = pipe.transform(input, { type: 'body' });

    expect(out).toEqual(input);
  });

  it('does not recurse into class instances', () => {
    class User {
      constructor(public name: string, public bio: string) {}
    }
    const u = new User('<b>Carol</b>', '<script>bad</script>dev');
    const out = pipe.transform(u, { type: 'body' });

    // Class instances retain their original references for caller to handle.
    expect(out).toBe(u);
  });

  it('handles a non-object payload (top-level string)', () => {
    const out = pipe.transform('<script>x</script>plain', {
      type: 'body',
    });
    expect(out).toBe('plain');
  });
});
