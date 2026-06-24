const JSON_ERROR_PATTERNS: Array<{ pattern: RegExp; explanation: string; fix: string }> = [
  {
    pattern: /Unexpected token .* in JSON at position (\d+)/i,
    explanation: 'The parser hit a character that is not valid JSON at the given position — often a trailing comma, single quotes, or unescaped text.',
    fix: 'Check the character at that position. Replace single quotes with double quotes, remove trailing commas, and wrap unquoted keys in double quotes.',
  },
  {
    pattern: /Unexpected end of JSON input/i,
    explanation: 'The JSON string ended before a value, object, or array was fully closed.',
    fix: 'Look for missing closing braces `}`, brackets `]`, or an unfinished string literal at the end of your input.',
  },
  {
    pattern: /Expected .* after property name/i,
    explanation: 'A property name is not followed by a colon and value in valid JSON syntax.',
    fix: 'Ensure every key is followed by `: value`. Keys must be double-quoted strings.',
  },
  {
    pattern: /Bad control character in string literal/i,
    explanation: 'Raw control characters (like unescaped newlines or tabs) appear inside a JSON string.',
    fix: 'Escape special characters: use `\\n` for newlines, `\\t` for tabs, and `\\"` for quotes inside strings.',
  },
];

const REGEX_INTENT_PATTERNS: Array<{ keywords: RegExp; pattern: string; flags: string; explanation: string }> = [
  {
    keywords: /\b(email|e-mail|mail address)\b/i,
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    flags: 'i',
    explanation: 'Matches common email address shapes. For production validation, also verify the domain exists.',
  },
  {
    keywords: /\b(url|uri|link|http)\b/i,
    pattern: 'https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+',
    flags: 'i',
    explanation: 'Matches HTTP/HTTPS URLs. Tighten the character class if you only need specific path segments.',
  },
  {
    keywords: /\b(ipv4|ip address)\b/i,
    pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    flags: '',
    explanation: 'Matches dotted IPv4 notation. Add range checks separately — this pattern alone allows invalid octets like 999.',
  },
  {
    keywords: /\b(uuid|guid)\b/i,
    pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}',
    flags: '',
    explanation: 'Matches UUID v1–v5 format. Use the UUID Generator tool to create valid v4 identifiers.',
  },
  {
    keywords: /\b(phone|telephone|mobile)\b/i,
    pattern: '\\+?[1-9]\\d{6,14}',
    flags: '',
    explanation: 'Loose international phone pattern. Country-specific rules usually need a dedicated library.',
  },
  {
    keywords: /\b(digit|number|numeric|integer)\b/i,
    pattern: '\\d+',
    flags: '',
    explanation: 'Matches one or more digits. Use `\\d*` for optional digits or anchor with `^` and `$` for exact matches.',
  },
  {
    keywords: /\b(word|alphanumeric|identifier)\b/i,
    pattern: '[a-zA-Z_][a-zA-Z0-9_]*',
    flags: '',
    explanation: 'Matches typical programming identifiers (letters, digits, underscore; cannot start with a digit).',
  },
  {
    keywords: /\b(whitespace|space|blank)\b/i,
    pattern: '\\s+',
    flags: '',
    explanation: 'Matches one or more whitespace characters (spaces, tabs, newlines).',
  },
];

export function explainJsonError(errorMessage: string, input?: string): string | null {
  for (const { pattern, explanation, fix } of JSON_ERROR_PATTERNS) {
    const match = errorMessage.match(pattern);
    if (match) {
      let positionHint = '';
      const position = match[1];
      if (position && input) {
        const pos = Number.parseInt(position, 10);
        if (Number.isFinite(pos) && pos >= 0 && pos < input.length) {
          const snippet = input.slice(Math.max(0, pos - 20), Math.min(input.length, pos + 20));
          positionHint = `\n\nContext around position ${pos}:\n\`${snippet.replace(/\n/g, '\\n')}\``;
        }
      }
      return `**Diagnosis:** ${explanation}\n\n**Fix:** ${fix}${positionHint}`;
    }
  }

  if (/invalid/i.test(errorMessage)) {
    return '**Diagnosis:** The input is not valid JSON.\n\n**Fix:** Validate structure — double-quoted keys, no trailing commas, and properly closed `{}` / `[]`. Paste into the JSON Formatter and use Format to pinpoint the error.';
  }

  return null;
}

export function suggestRegexFromNaturalLanguage(query: string): string | null {
  for (const entry of REGEX_INTENT_PATTERNS) {
    if (entry.keywords.test(query)) {
      return `**Suggested pattern:** \`/${entry.pattern}/${entry.flags}\`\n\n${entry.explanation}\n\nOpen the **Regex Tester** tool to try it against sample text and inspect capture groups.`;
    }
  }

  if (/\b(match|find|extract|regex|regular expression|pattern)\b/i.test(query)) {
    return 'Describe what you want to match more specifically — for example "email address", "URL", "UUID", or "digits only" — and I can suggest a starting pattern for the Regex Tester.';
  }

  return null;
}

export function explainJwtToken(token: string): string | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return `**Diagnosis:** A JWT must have exactly three dot-separated segments (header.payload.signature). Found ${parts.length}.\n\n**Fix:** Ensure you copied the full token without line breaks or extra spaces.`;
  }

  try {
    const decodePart = (part: string) => {
      const padded = part.replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
      return JSON.parse(json) as Record<string, unknown>;
    };

    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    const lines: string[] = [
      '**Header:**',
      `\`${JSON.stringify(header, null, 2)}\``,
      '',
      '**Payload (claims):**',
      `\`${JSON.stringify(payload, null, 2)}\``,
      '',
      '**Note:** DevSolve JWT Decoder does not verify signatures. For production auth, always validate signatures server-side.',
    ];

    if (typeof payload.exp === 'number') {
      const expDate = new Date(payload.exp * 1000);
      const expired = expDate.getTime() < Date.now();
      lines.push('', `**exp:** ${expDate.toISOString()} (${expired ? 'expired' : 'still valid by clock'})`);
    }

    if (typeof payload.iat === 'number') {
      lines.push(`**iat:** ${new Date(payload.iat * 1000).toISOString()}`);
    }

    return lines.join('\n');
  } catch {
    return '**Diagnosis:** One or both of the header/payload segments are not valid Base64URL-encoded JSON.\n\n**Fix:** Confirm this is a standard JWT (not an opaque token) and that no characters were truncated.';
  }
}

export function summarizeDiff(left: string, right: string): string {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  let added = 0;
  let removed = 0;
  let changed = 0;
  const maxLen = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < maxLen; i++) {
    const l = leftLines[i];
    const r = rightLines[i];
    if (l === undefined && r !== undefined) added++;
    else if (l !== undefined && r === undefined) removed++;
    else if (l !== r) changed++;
  }

  const total = added + removed + changed;
  if (total === 0) {
    return 'Both inputs are identical line-by-line. No differences detected.';
  }

  return `**Diff summary:** ${total} line-level change(s) — ${added} added, ${removed} removed, ${changed} modified.\n\nTip: Normalize line endings (LF vs CRLF) before comparing config files to avoid phantom diffs.`;
}
