import {
  RuleBlock,
  QuotaLine,
  SourceExpr,
  BankGroup,
  BankTag,
  QuestionType,
} from '../../../types/bank';
import { pathOf } from '../tree';
import { generateBankId } from '../ids';
import { MAX_QUESTIONS } from '../../examLimits';
import { Token, tokenize } from './lexer';
import { Diagnostic } from './diagnostics';
import { findClosestMatch } from './suggest';

export interface ParseResult {
  blocks: RuleBlock[];
  diagnostics: Diagnostic[];
}

function normalizeName(str: string): string {
  return str.normalize('NFC').trim().toLowerCase();
}

export function parse(
  input: string,
  groups: readonly BankGroup[],
  tags: readonly BankTag[]
): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const tokens = tokenize(input, diagnostics);
  let pos = 0;

  // Build group paths lookup
  const groupPathMap = new Map<string, string>(); // normalized path -> groupId
  const groupPathsList: string[] = [];

  for (const g of groups) {
    const p = pathOf(groups, g.id);
    groupPathMap.set(normalizeName(p), g.id);
    groupPathsList.push(p);
  }

  // Build tag names lookup
  const tagMap = new Map<string, string>(); // normalized name -> tagId
  const tagNamesList: string[] = [];

  for (const t of tags) {
    tagMap.set(normalizeName(t.name), t.id);
    tagNamesList.push(t.name);
  }

  function curr(): Token {
    return tokens[pos] || tokens[tokens.length - 1];
  }

  function peek(offset = 1): Token {
    return tokens[pos + offset] || tokens[tokens.length - 1];
  }

  function advance(): Token {
    const t = curr();
    if (pos < tokens.length - 1) pos++;
    return t;
  }

  function match(type: Token['type']): boolean {
    if (curr().type === type) {
      advance();
      return true;
    }
    return false;
  }

  function expect(type: Token['type'], message: string): Token | null {
    if (curr().type === type) {
      return advance();
    }
    diagnostics.push({
      start: curr().start,
      end: curr().end,
      line: curr().line,
      column: curr().column,
      severity: 'error',
      code: 'unexpected_token',
      message: `${message}. Encontrado: "${curr().raw || 'fim de texto'}".`,
    });
    return null;
  }

  // Parses a group path (e.g. Matemática/Geometria/Euclidiana or "Matemática/Geometria Plana")
  function parsePathRef(): { groupId: string | null; nodeStart: number; nodeEnd: number } {
    const startToken = curr();
    let segments: string[] = [];
    const nodeStart = startToken.start;
    let nodeEnd = startToken.end;

    if (curr().type === 'STRING') {
      const token = advance();
      nodeEnd = token.end;
      // May contain internal slashes
      segments = (token.value as string).split('/').map((s) => s.trim());
    } else if (curr().type === 'WORD') {
      segments.push(advance().value as string);
      while (curr().type === 'SLASH') {
        advance(); // consume '/'
        if (curr().type === 'WORD' || curr().type === 'STRING') {
          const part = advance();
          nodeEnd = part.end;
          segments.push(part.value as string);
        } else {
          diagnostics.push({
            start: curr().start,
            end: curr().end,
            line: curr().line,
            column: curr().column,
            severity: 'error',
            code: 'invalid_path',
            message: 'Esperado segmento de caminho de grupo após "/".',
          });
          break;
        }
      }
    } else {
      diagnostics.push({
        start: curr().start,
        end: curr().end,
        line: curr().line,
        column: curr().column,
        severity: 'error',
        code: 'expected_path',
        message: `Esperado nome ou caminho de grupo. Encontrado: "${curr().raw}".`,
      });
      return { groupId: null, nodeStart, nodeEnd };
    }

    const fullPath = segments.join('/');
    const norm = normalizeName(fullPath);
    const groupId = groupPathMap.get(norm);

    if (!groupId) {
      const matchSuggestion = findClosestMatch(fullPath, groupPathsList, 2);
      diagnostics.push({
        start: nodeStart,
        end: nodeEnd,
        line: startToken.line,
        column: startToken.column,
        severity: 'error',
        code: 'group_not_found',
        message: `Grupo não encontrado: "${fullPath}".`,
        suggestion: matchSuggestion ? `Você quis dizer "${matchSuggestion}"?` : undefined,
      });
      return { groupId: null, nodeStart, nodeEnd };
    }

    return { groupId, nodeStart, nodeEnd };
  }

  // Parses a source expression term
  function parseTerm(): SourceExpr {
    if (match('LPAREN')) {
      const inner = parseSource();
      expect('RPAREN', 'Esperado ")" após expressão de origem');
      return inner;
    }

    if (match('ALL')) {
      return { kind: 'all' };
    }

    if (match('ONLY')) {
      const { groupId } = parsePathRef();
      return { kind: 'group', groupId: groupId || 'broken', descendants: false };
    }

    const { groupId } = parsePathRef();
    return { kind: 'group', groupId: groupId || 'broken', descendants: true };
  }

  // Parses source with operators (OR, AND, XOR, EXCEPT)
  function parseSource(): SourceExpr {
    const left = parseTerm();

    if (curr().type === 'EXCEPT') {
      advance();
      const right = parseTerm();
      return { kind: 'except', base: left, excluded: right };
    }

    if (curr().type === 'OR' || curr().type === 'AND' || curr().type === 'XOR') {
      const op = curr().type;
      const operands: SourceExpr[] = [left];

      while (curr().type === 'OR' || curr().type === 'AND' || curr().type === 'XOR') {
        const nextOp = curr().type;
        if (nextOp !== op) {
          diagnostics.push({
            start: curr().start,
            end: curr().end,
            line: curr().line,
            column: curr().column,
            severity: 'error',
            code: 'mixed_operators',
            message: 'Use parênteses para combinar operadores diferentes.',
          });
        }
        advance();
        operands.push(parseTerm());
      }

      if (op === 'OR') return { kind: 'or', operands };
      if (op === 'AND') return { kind: 'and', operands };
      return { kind: 'xor', operands };
    }

    return left;
  }

  // Parses quota line: INT [ filter ] [ POINTS number ]
  function parseQuota(): QuotaLine | null {
    const intToken = curr();
    if (intToken.type !== 'INT') {
      diagnostics.push({
        start: intToken.start,
        end: intToken.end,
        line: intToken.line,
        column: intToken.column,
        severity: 'error',
        code: 'expected_count',
        message: `Esperada quantidade inteira de questões. Encontrado: "${intToken.raw}".`,
      });
      return null;
    }
    advance();

    const count = intToken.value as number;
    if (count < 1 || count > MAX_QUESTIONS) {
      diagnostics.push({
        start: intToken.start,
        end: intToken.end,
        line: intToken.line,
        column: intToken.column,
        severity: 'error',
        code: 'invalid_count',
        message: `A quantidade de questões deve ser um número inteiro entre 1 e ${MAX_QUESTIONS}.`,
      });
    }

    // Optional "questões" / "questions" word and optional "."
    if (curr().type === 'QUESTIONS') {
      advance();
      if (curr().type === 'DOT') {
        advance();
      }
    }

    const tagIds: string[] = [];
    const notTagIds: string[] = [];
    let qType: QuestionType | undefined;

    // Parse predicates
    function parsePredicate(): boolean {
      const isNot = match('NOT');

      if (match('TAG')) {
        expect('LPAREN', 'Esperado "(" após etiqueta');
        const strTok = expect('STRING', 'Esperado nome da etiqueta entre aspas');
        expect('RPAREN', 'Esperado ")" após nome da etiqueta');

        if (strTok) {
          const rawTagName = strTok.value as string;
          const norm = normalizeName(rawTagName);
          const tId = tagMap.get(norm);
          if (tId) {
            if (isNot) notTagIds.push(tId);
            else tagIds.push(tId);
          } else {
            const suggestion = findClosestMatch(rawTagName, tagNamesList, 2);
            diagnostics.push({
              start: strTok.start,
              end: strTok.end,
              line: strTok.line,
              column: strTok.column,
              severity: 'error',
              code: 'tag_not_found',
              message: `Etiqueta não encontrada: "${rawTagName}".`,
              suggestion: suggestion ? `Você quis dizer "${suggestion}"?` : undefined,
            });
          }
        }
        return true;
      }

      if (match('TYPE')) {
        expect('LPAREN', 'Esperado "(" após tipo');
        const strTok = expect('STRING', 'Esperado tipo da questão ("objetiva" ou "dissertativa")');
        expect('RPAREN', 'Esperado ")" após tipo da questão');

        if (strTok) {
          const norm = normalizeName(strTok.value as string);
          if (norm === 'objetiva' || norm === 'objective') {
            qType = 'objective';
          } else if (
            norm === 'dissertativa' ||
            norm === 'subjetiva' ||
            norm === 'subjective'
          ) {
            qType = 'subjective';
          } else {
            diagnostics.push({
              start: strTok.start,
              end: strTok.end,
              line: strTok.line,
              column: strTok.column,
              severity: 'error',
              code: 'invalid_type',
              message: `Tipo de questão desconhecido: "${strTok.value}". Use "objetiva" ou "dissertativa".`,
            });
          }
        }
        return true;
      }

      return false;
    }

    // Predicates loop
    while (curr().type === 'NOT' || curr().type === 'TAG' || curr().type === 'TYPE') {
      parsePredicate();
      // Check if followed by AND predicate
      if (curr().type === 'AND') {
        const next = peek(1);
        if (next.type === 'NOT' || next.type === 'TAG' || next.type === 'TYPE') {
          advance(); // consume 'AND'
        } else {
          break; // AND is next quota separator!
        }
      }
    }

    // Optional POINTS override
    let points: number | undefined;
    if (match('POINTS')) {
      const ptTok = curr();
      if (ptTok.type === 'NUMBER' || ptTok.type === 'INT') {
        advance();
        points = ptTok.value as number;
        if (points <= 0) {
          diagnostics.push({
            start: ptTok.start,
            end: ptTok.end,
            line: ptTok.line,
            column: ptTok.column,
            severity: 'error',
            code: 'invalid_points',
            message: 'A pontuação da linha deve ser um número positivo.',
          });
        }
      } else {
        diagnostics.push({
          start: ptTok.start,
          end: ptTok.end,
          line: ptTok.line,
          column: ptTok.column,
          severity: 'error',
          code: 'expected_points_number',
          message: 'Esperado número de pontos após PONTOS/POINTS.',
        });
      }
    }

    // Tag and notTag conflict check
    const tagSet = new Set(tagIds);
    for (const notId of notTagIds) {
      if (tagSet.has(notId)) {
        diagnostics.push({
          start: intToken.start,
          end: curr().end,
          line: intToken.line,
          column: intToken.column,
          severity: 'error',
          code: 'conflicting_tags',
          message: 'A mesma etiqueta não pode estar incluída e excluída na mesma cota.',
        });
      }
    }

    return {
      id: generateBankId(),
      count,
      filter: {
        tagIds,
        notTagIds,
        type: qType,
      },
      points,
    };
  }

  // Parses a single block
  function parseBlock(): RuleBlock | null {
    if (!match('FROM')) {
      diagnostics.push({
        start: curr().start,
        end: curr().end,
        line: curr().line,
        column: curr().column,
        severity: 'error',
        code: 'expected_block_start',
        message: `Esperado início de bloco "DE" ou "FROM". Encontrado: "${curr().raw || 'fim de texto'}".`,
      });
      // Skip until next FROM or EOF
      while (curr().type !== 'FROM' && curr().type !== 'EOF') advance();
      return null;
    }

    const source = parseSource();

    // Optional block POINTS override
    let blockPoints: number | undefined;
    if (match('POINTS')) {
      const ptTok = curr();
      if (ptTok.type === 'NUMBER' || ptTok.type === 'INT') {
        advance();
        blockPoints = ptTok.value as number;
        if (blockPoints <= 0) {
          diagnostics.push({
            start: ptTok.start,
            end: ptTok.end,
            line: ptTok.line,
            column: ptTok.column,
            severity: 'error',
            code: 'invalid_points',
            message: 'A pontuação do bloco deve ser um número positivo.',
          });
        }
      } else {
        diagnostics.push({
          start: ptTok.start,
          end: ptTok.end,
          line: ptTok.line,
          column: ptTok.column,
          severity: 'error',
          code: 'expected_points_number',
          message: 'Esperado número de pontos após PONTOS/POINTS.',
        });
      }
    }

    expect('INCLUDE', 'Esperado "INCLUIR" ou "INCLUDE" para definir as cotas do bloco');

    const quotas: QuotaLine[] = [];
    const firstQuota = parseQuota();
    if (firstQuota) quotas.push(firstQuota);

    while (curr().type !== 'EOF' && curr().type !== 'FROM') {
      if (match('COMMA')) {
        const nextQuota = parseQuota();
        if (nextQuota) quotas.push(nextQuota);
      } else if (curr().type === 'AND' && peek(1).type === 'INT') {
        advance(); // consume 'AND'
        const nextQuota = parseQuota();
        if (nextQuota) quotas.push(nextQuota);
      } else {
        break;
      }
    }

    if (quotas.length === 0) {
      diagnostics.push({
        start: curr().start,
        end: curr().end,
        line: curr().line,
        column: curr().column,
        severity: 'error',
        code: 'empty_block',
        message: 'O bloco deve conter pelo menos uma cota de questões.',
      });
    }

    return {
      id: generateBankId(),
      source,
      points: blockPoints,
      quotas,
    };
  }

  // Parse program: block { block }
  const blocks: RuleBlock[] = [];

  while (curr().type !== 'EOF') {
    const block = parseBlock();
    if (block) blocks.push(block);
  }

  // Check total question count across all blocks
  let totalQuestions = 0;
  for (const b of blocks) {
    for (const q of b.quotas) {
      totalQuestions += q.count;
    }
  }

  if (totalQuestions > MAX_QUESTIONS) {
    diagnostics.push({
      start: 0,
      end: input.length,
      line: 1,
      column: 1,
      severity: 'error',
      code: 'over_limit',
      message: `A soma total de questões (${totalQuestions}) excede o limite máximo de ${MAX_QUESTIONS} questões por prova.`,
    });
  }

  return { blocks, diagnostics };
}
