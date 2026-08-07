function tryDirectParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function tryFencedCodeBlock(raw: string): { ok: true; value: unknown } | { ok: false } {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!match) {
    return { ok: false };
  }
  return tryDirectParse(match[1].trim());
}

function findBalancedObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryBalancedObject(raw: string): { ok: true; value: unknown } | { ok: false } {
  const candidate = findBalancedObject(raw);
  if (!candidate) {
    return { ok: false };
  }
  return tryDirectParse(candidate);
}

export function parseTolerantJson(raw: string): unknown {
  const direct = tryDirectParse(raw);
  if (direct.ok) {
    return direct.value;
  }

  const fenced = tryFencedCodeBlock(raw);
  if (fenced.ok) {
    return fenced.value;
  }

  const balanced = tryBalancedObject(raw);
  if (balanced.ok) {
    return balanced.value;
  }

  const preview = raw.slice(0, 200);
  throw new Error(`No se pudo recuperar JSON del texto recibido: "${preview}"`);
}
