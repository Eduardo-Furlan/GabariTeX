import { describe, it, expect } from 'vitest';
import {
  tokenize,
  parse,
  print,
  levenshteinDistance,
  findClosestMatch,
  getSuggestions,
} from '../src/utils/bank/query';
import {
  BankGroup,
  BankTag,
  RuleBlock,
  SourceExpr,
  QuotaLine,
} from '../src/types/bank';
import { normalizeBlueprint, normalizeSourceExpr } from '../src/utils/bank/blueprint';
import { mulberry32 } from '../src/utils/prng';

describe('Bank Query Language - Lexer & Diagnostics (Phase 7 Step 1)', () => {
  it('tokenizes keywords in Portuguese and English with accent folding', () => {
    const ptInput = 'DE TODAS INCLUIR 5 questoes NAO etiqueta("facil") PONTOS 2';
    const tokens = tokenize(ptInput);

    expect(tokens.map((t) => t.type)).toEqual([
      'FROM',
      'ALL',
      'INCLUDE',
      'INT',
      'QUESTIONS',
      'NOT',
      'TAG',
      'LPAREN',
      'STRING',
      'RPAREN',
      'POINTS',
      'INT',
      'EOF',
    ]);
  });

  it('tokenizes numbers with decimal points correctly', () => {
    const input = '3 PONTOS 1.5, 4 PONTOS 2.25';
    const tokens = tokenize(input);

    expect(tokens.find((t) => t.value === 1.5)?.type).toBe('NUMBER');
    expect(tokens.find((t) => t.value === 2.25)?.type).toBe('NUMBER');
    expect(tokens.find((t) => t.value === 3)?.type).toBe('INT');
  });

  it('reports unclosed string literal diagnostic without crashing', () => {
    const diagnostics: any[] = [];
    tokenize('etiqueta("aberto)', diagnostics);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('unclosed_string');
  });
});

describe('Bank Query Language - Parser & Resolver (Phase 7 Step 1)', () => {
  const groups: BankGroup[] = [
    { id: 'g-mat', name: 'Matemática', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-geo', name: 'Geometria', parentId: 'g-mat', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-euc', name: 'Euclidiana', parentId: 'g-geo', sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-hip', name: 'Hiperbólica', parentId: 'g-geo', sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'g-pla', name: 'Geometria Plana', parentId: 'g-mat', sortOrder: 2, createdAt: '', updatedAt: '' },
  ];

  const tags: BankTag[] = [
    { id: 't-facil', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
    { id: 't-media', name: 'Média', color: 'blue', createdAt: '', updatedAt: '' },
    { id: 't-dificil', name: 'Difícil', color: 'rose', createdAt: '', updatedAt: '' },
    { id: 't-revisar', name: 'Revisar', color: 'amber', createdAt: '', updatedAt: '' },
  ];

  it('parses complete Portuguese query into RuleBlocks', () => {
    const query = `
      DE (Matemática/Geometria/Euclidiana OU Matemática/Geometria/Hiperbólica)
        INCLUIR 3 etiqueta("Fácil"), 5 etiqueta("Média") PONTOS 1.5

      DE "Matemática/Geometria Plana" PONTOS 2
        INCLUIR 2 etiqueta("Difícil") E NÃO etiqueta("Revisar"), 1 tipo("dissertativa")
    `;

    const { blocks, diagnostics } = parse(query, groups, tags);
    expect(diagnostics).toHaveLength(0);
    expect(blocks).toHaveLength(2);

    // Block 1
    const b1 = blocks[0];
    expect(b1.source.kind).toBe('or');
    expect(b1.quotas).toHaveLength(2);
    expect(b1.quotas[0].count).toBe(3);
    expect(b1.quotas[0].filter.tagIds).toEqual(['t-facil']);
    expect(b1.quotas[1].count).toBe(5);
    expect(b1.quotas[1].filter.tagIds).toEqual(['t-media']);
    expect(b1.quotas[1].points).toBe(1.5);

    // Block 2
    const b2 = blocks[1];
    expect(b2.source).toEqual({ kind: 'group', groupId: 'g-pla', descendants: true });
    expect(b2.points).toBe(2);
    expect(b2.quotas).toHaveLength(2);
    expect(b2.quotas[0].count).toBe(2);
    expect(b2.quotas[0].filter.tagIds).toEqual(['t-dificil']);
    expect(b2.quotas[0].filter.notTagIds).toEqual(['t-revisar']);
    expect(b2.quotas[1].count).toBe(1);
    expect(b2.quotas[1].filter.type).toBe('subjective');
  });

  it('parses English equivalent query with AND quota separator', () => {
    const query = `
      FROM ALL
        INCLUDE 3 tag("Fácil") AND 2 tag("Média") POINTS 2
    `;

    const { blocks, diagnostics } = parse(query, groups, tags);
    expect(diagnostics).toHaveLength(0);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toEqual({ kind: 'all' });
    expect(blocks[0].quotas).toHaveLength(2);
    expect(blocks[0].quotas[0].count).toBe(3);
    expect(blocks[0].quotas[1].count).toBe(2);
    expect(blocks[0].quotas[1].points).toBe(2);
  });

  it('parses ONLY modifier for direct questions', () => {
    const query = 'DE SOMENTE Matemática/Geometria INCLUIR 5 questões';
    const { blocks, diagnostics } = parse(query, groups, tags);

    expect(diagnostics).toHaveLength(0);
    expect(blocks[0].source).toEqual({ kind: 'group', groupId: 'g-geo', descendants: false });
    expect(blocks[0].quotas[0].count).toBe(5);
  });

  it('parses EXCEPT operator for source subtraction', () => {
    const query = 'DE Matemática/Geometria EXCETO Matemática/Geometria/Hiperbólica INCLUIR 2 questões';
    const { blocks, diagnostics } = parse(query, groups, tags);

    expect(diagnostics).toHaveLength(0);
    expect(blocks[0].source).toEqual({
      kind: 'except',
      base: { kind: 'group', groupId: 'g-geo', descendants: true },
      excluded: { kind: 'group', groupId: 'g-hip', descendants: true },
    });
  });

  it('reports error when mixing different operators without parentheses', () => {
    const query = 'DE Matemática/Geometria OU Matemática/Geometria/Hiperbólica E Matemática INCLUIR 2 questões';
    const { diagnostics } = parse(query, groups, tags);

    expect(diagnostics.some((d) => d.code === 'mixed_operators')).toBe(true);
    expect(diagnostics[0].message).toContain('Use parênteses para combinar operadores diferentes');
  });

  it('provides did-you-mean suggestion for typo in group path', () => {
    // "Geometira" typo (edit distance 2 from Geometria)
    const query = 'DE Matemática/Geometira INCLUIR 2 questões';
    const { diagnostics } = parse(query, groups, tags);

    expect(diagnostics.some((d) => d.code === 'group_not_found')).toBe(true);
    const err = diagnostics.find((d) => d.code === 'group_not_found')!;
    expect(err.suggestion).toContain('Geometria');
  });

  it('provides did-you-mean suggestion for typo in tag name', () => {
    // "Fásil" typo (edit distance 1 from Fácil)
    const query = 'DE TODAS INCLUIR 2 etiqueta("Fásil")';
    const { diagnostics } = parse(query, groups, tags);

    expect(diagnostics.some((d) => d.code === 'tag_not_found')).toBe(true);
    const err = diagnostics.find((d) => d.code === 'tag_not_found')!;
    expect(err.suggestion).toContain('Fácil');
  });

  it('reports semantic error when total questions exceed 40', () => {
    const query = 'DE TODAS INCLUIR 25 questões, 20 questões';
    const { diagnostics } = parse(query, groups, tags);

    expect(diagnostics.some((d) => d.code === 'over_limit')).toBe(true);
  });

  it('reports semantic error for conflicting tag in included and excluded', () => {
    const query = 'DE TODAS INCLUIR 5 etiqueta("Fácil") E NÃO etiqueta("Fácil")';
    const { diagnostics } = parse(query, groups, tags);

    expect(diagnostics.some((d) => d.code === 'conflicting_tags')).toBe(true);
  });
});

describe('Bank Query Language - Canonical Printer (Phase 7 Step 2)', () => {
  const groups: BankGroup[] = [
    { id: 'g-mat', name: 'Matemática', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g-geo', name: 'Geometria Plana', parentId: 'g-mat', sortOrder: 0, createdAt: '', updatedAt: '' },
  ];

  const tags: BankTag[] = [
    { id: 't-facil', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
  ];

  it('prints canonical query in Portuguese', () => {
    const blocks: RuleBlock[] = [
      {
        id: 'b1',
        source: { kind: 'group', groupId: 'g-geo', descendants: true },
        points: 2,
        quotas: [
          {
            id: 'l1',
            count: 3,
            filter: { tagIds: ['t-facil'], notTagIds: [], type: 'objective' },
            points: 1.5,
          },
        ],
      },
    ];

    const out = print(blocks, groups, tags, { lang: 'pt' });
    expect(out).toContain('DE "Matemática/Geometria Plana" PONTOS 2');
    expect(out).toContain('INCLUIR 3 etiqueta("Fácil") E tipo("objetiva") PONTOS 1.5');
  });

  it('prints canonical query in English', () => {
    const blocks: RuleBlock[] = [
      {
        id: 'b1',
        source: { kind: 'all' },
        quotas: [
          {
            id: 'l1',
            count: 5,
            filter: { tagIds: [], notTagIds: [] },
          },
        ],
      },
    ];

    const out = print(blocks, groups, tags, { lang: 'en' });
    expect(out).toContain('FROM ALL');
    expect(out).toContain('INCLUDE 5 questions');
  });

  it('prints explicit placeholder for deleted group reference', () => {
    const blocks: RuleBlock[] = [
      {
        id: 'b1',
        source: { kind: 'group', groupId: 'deleted-group-id', descendants: true },
        quotas: [{ id: 'l1', count: 1, filter: { tagIds: [], notTagIds: [] } }],
      },
    ];

    const out = print(blocks, groups, tags);
    expect(out).toContain('@GRUPO_EXCLUIDO_deleted-group-id');
  });
});

describe('Bank Query Language - Suggestions & Autocomplete (Phase 7 Step 4)', () => {
  const groups: BankGroup[] = [
    { id: 'g-geo', name: 'Geometria', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
  ];
  const tags: BankTag[] = [
    { id: 't-facil', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
  ];

  it('calculates Levenshtein distance accurately', () => {
    expect(levenshteinDistance('Geometria', 'Geometria')).toBe(0);
    expect(levenshteinDistance('Geometria', 'Geometira')).toBe(2);
    expect(levenshteinDistance('Fácil', 'Facil')).toBe(1);
    expect(levenshteinDistance('', 'teste')).toBe(5);
  });

  it('finds closest match within max distance', () => {
    const match = findClosestMatch('Geometira', ['Álgebra', 'Geometria', 'Física']);
    expect(match).toBe('Geometria');

    const noMatch = findClosestMatch('CompletamenteDiferente', ['Álgebra', 'Geometria']);
    expect(noMatch).toBeNull();
  });

  it('returns filtered autocomplete suggestions matching input prefix', () => {
    const input = 'DE Geo';
    const suggestions = getSuggestions(input, input.length, groups, tags, 'pt');

    expect(suggestions.some((s) => s.label === 'Geometria')).toBe(true);
  });
});

describe('Bank Query Language - Round-Trip Verification (Phase 7 Step 3)', () => {
  const groups: BankGroup[] = [
    { id: 'g1', name: 'Álgebra', parentId: null, sortOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'g2', name: 'Geometria', parentId: null, sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'g3', name: 'Plana', parentId: 'g2', sortOrder: 0, createdAt: '', updatedAt: '' },
  ];

  const tags: BankTag[] = [
    { id: 't1', name: 'Fácil', color: 'emerald', createdAt: '', updatedAt: '' },
    { id: 't2', name: 'Média', color: 'blue', createdAt: '', updatedAt: '' },
    { id: 't3', name: 'Difícil', color: 'rose', createdAt: '', updatedAt: '' },
  ];

  it('round-trips print(parse(print(bp))) across seeded random rule trees in PT and EN', () => {
    const prng = mulberry32(42);

    function randomSource(): SourceExpr {
      const r = prng();
      if (r < 0.25) {
        return { kind: 'all' };
      }
      if (r < 0.6) {
        const g = groups[Math.floor(prng() * groups.length)];
        return { kind: 'group', groupId: g.id, descendants: prng() > 0.3 };
      }
      if (r < 0.8) {
        // Union of 2 groups
        return {
          kind: 'or',
          operands: [
            { kind: 'group', groupId: groups[0].id, descendants: true },
            { kind: 'group', groupId: groups[1].id, descendants: true },
          ],
        };
      }
      // Except
      return {
        kind: 'except',
        base: { kind: 'group', groupId: groups[1].id, descendants: true },
        excluded: { kind: 'group', groupId: groups[2].id, descendants: true },
      };
    }

    function randomQuota(): QuotaLine {
      const count = 1 + Math.floor(prng() * 5); // 1..5
      const hasTag = prng() > 0.3;
      const tag = hasTag ? tags[Math.floor(prng() * tags.length)] : null;
      const hasType = prng() > 0.5;
      const type = hasType ? (prng() > 0.5 ? 'objective' : 'subjective') : undefined;

      return {
        id: 'q-line',
        count,
        filter: {
          tagIds: tag ? [tag.id] : [],
          notTagIds: [],
          type,
        },
      };
    }

    // Run 50 random blueprints in Portuguese and English
    for (let i = 0; i < 50; i++) {
      const lang: 'pt' | 'en' = i % 2 === 0 ? 'pt' : 'en';
      const numBlocks = 1 + Math.floor(prng() * 2);
      const blocks: RuleBlock[] = [];

      for (let b = 0; b < numBlocks; b++) {
        blocks.push({
          id: `b${b}`,
          source: randomSource(),
          quotas: [randomQuota()],
        });
      }

      // 1. Print
      const text1 = print(blocks, groups, tags, { lang });

      // 2. Parse
      const parseResult = parse(text1, groups, tags);
      expect(parseResult.diagnostics).toHaveLength(0);

      // 3. Print again
      const text2 = print(parseResult.blocks, groups, tags, { lang });

      // Canonical text must be identical
      expect(text2).toBe(text1);

      // Rule trees normalized must match
      const normOriginal = blocks.map((b) => ({
        source: normalizeSourceExpr(b.source),
        quotas: b.quotas.map((q) => ({ count: q.count, filter: q.filter })),
      }));
      const normParsed = parseResult.blocks.map((b) => ({
        source: normalizeSourceExpr(b.source),
        quotas: b.quotas.map((q) => ({ count: q.count, filter: q.filter })),
      }));

      expect(normParsed).toEqual(normOriginal);
    }
  });
});
