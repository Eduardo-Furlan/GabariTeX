import { Diagnostic } from './diagnostics';

export type TokenType =
  | 'FROM'
  | 'INCLUDE'
  | 'POINTS'
  | 'OR'
  | 'AND'
  | 'XOR'
  | 'EXCEPT'
  | 'ONLY'
  | 'ALL'
  | 'NOT'
  | 'TAG'
  | 'TYPE'
  | 'QUESTIONS'
  | 'INT'
  | 'NUMBER'
  | 'STRING'
  | 'WORD'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'DOT'
  | 'SLASH'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string | number;
  raw: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export const KEYWORD_MAP: Record<string, TokenType> = {
  de: 'FROM',
  from: 'FROM',
  ou: 'OR',
  or: 'OR',
  e: 'AND',
  and: 'AND',
  xou: 'XOR',
  xor: 'XOR',
  exceto: 'EXCEPT',
  except: 'EXCEPT',
  somente: 'ONLY',
  only: 'ONLY',
  todas: 'ALL',
  all: 'ALL',
  incluir: 'INCLUDE',
  include: 'INCLUDE',
  pontos: 'POINTS',
  points: 'POINTS',
  nao: 'NOT',
  not: 'NOT',
  etiqueta: 'TAG',
  tag: 'TAG',
  tipo: 'TYPE',
  type: 'TYPE',
  questoes: 'QUESTIONS',
  questao: 'QUESTIONS',
  questions: 'QUESTIONS',
  question: 'QUESTIONS',
};

export function foldAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenize(
  input: string,
  diagnostics: Diagnostic[] = []
): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  function advance(count = 1): void {
    for (let i = 0; i < count; i++) {
      if (input[pos] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      pos++;
    }
  }

  function peek(offset = 0): string {
    return input[pos + offset] || '';
  }

  while (pos < input.length) {
    const ch = input[pos];

    // Whitespace
    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    const startPos = pos;
    const startLine = line;
    const startCol = column;

    // Single-character punctuation
    if (ch === '(') {
      advance();
      tokens.push({ type: 'LPAREN', value: '(', raw: '(', start: startPos, end: pos, line: startLine, column: startCol });
      continue;
    }
    if (ch === ')') {
      advance();
      tokens.push({ type: 'RPAREN', value: ')', raw: ')', start: startPos, end: pos, line: startLine, column: startCol });
      continue;
    }
    if (ch === ',') {
      advance();
      tokens.push({ type: 'COMMA', value: ',', raw: ',', start: startPos, end: pos, line: startLine, column: startCol });
      continue;
    }
    if (ch === '.') {
      advance();
      tokens.push({ type: 'DOT', value: '.', raw: '.', start: startPos, end: pos, line: startLine, column: startCol });
      continue;
    }
    if (ch === '/') {
      advance();
      tokens.push({ type: 'SLASH', value: '/', raw: '/', start: startPos, end: pos, line: startLine, column: startCol });
      continue;
    }

    // String literals: "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(); // skip open quote
      let strVal = '';
      let closed = false;

      while (pos < input.length) {
        const c = input[pos];
        if (c === '\\') {
          advance();
          if (pos < input.length) {
            strVal += input[pos];
            advance();
          }
        } else if (c === quote) {
          advance(); // skip closing quote
          closed = true;
          break;
        } else {
          strVal += c;
          advance();
        }
      }

      if (!closed) {
        diagnostics.push({
          start: startPos,
          end: pos,
          line: startLine,
          column: startCol,
          severity: 'error',
          code: 'unclosed_string',
          message: 'Texto entre aspas não foi fechado.',
        });
      }

      const raw = input.slice(startPos, pos);
      tokens.push({
        type: 'STRING',
        value: strVal,
        raw,
        start: startPos,
        end: pos,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    // Numbers: digits with optional decimal point
    if (/[0-9]/.test(ch)) {
      let numStr = '';
      while (pos < input.length && /[0-9]/.test(input[pos])) {
        numStr += input[pos];
        advance();
      }

      // Check decimal point followed by a digit
      if (input[pos] === '.' && /[0-9]/.test(peek(1))) {
        numStr += '.';
        advance();
        while (pos < input.length && /[0-9]/.test(input[pos])) {
          numStr += input[pos];
          advance();
        }
        tokens.push({
          type: 'NUMBER',
          value: parseFloat(numStr),
          raw: numStr,
          start: startPos,
          end: pos,
          line: startLine,
          column: startCol,
        });
      } else {
        tokens.push({
          type: 'INT',
          value: parseInt(numStr, 10),
          raw: numStr,
          start: startPos,
          end: pos,
          line: startLine,
          column: startCol,
        });
      }
      continue;
    }

    // Identifiers, keywords, or words
    if (/[\p{L}_-]/u.test(ch)) {
      let word = '';
      while (pos < input.length && /[\p{L}\p{N}_-]/u.test(input[pos])) {
        word += input[pos];
        advance();
      }

      const folded = foldAccents(word);
      const kwType = KEYWORD_MAP[folded];

      if (kwType) {
        tokens.push({
          type: kwType,
          value: word,
          raw: word,
          start: startPos,
          end: pos,
          line: startLine,
          column: startCol,
        });
      } else {
        tokens.push({
          type: 'WORD',
          value: word,
          raw: word,
          start: startPos,
          end: pos,
          line: startLine,
          column: startCol,
        });
      }
      continue;
    }

    // Unexpected character
    diagnostics.push({
      start: startPos,
      end: pos + 1,
      line: startLine,
      column: startCol,
      severity: 'error',
      code: 'unexpected_character',
      message: `Caractere inesperado: "${ch}".`,
    });
    advance();
  }

  tokens.push({
    type: 'EOF',
    value: '',
    raw: '',
    start: pos,
    end: pos,
    line,
    column,
  });

  return tokens;
}
