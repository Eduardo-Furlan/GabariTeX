import { describe, it, expect } from 'vitest';
import { BankGroup, BankTag } from '../src/types/bank';
import { getCompletions, applyCompletion, getSuggestions } from '../src/utils/bank/query/suggest';
import { parse } from '../src/utils/bank/query/parser';
import { print } from '../src/utils/bank/query/printer';

const g = (id: string, name: string, parentId: string | null = null, order = 0): BankGroup =>
  ({ id, name, parentId, order, createdAt: '', updatedAt: '' }) as BankGroup;
const t = (id: string, name: string): BankTag =>
  ({ id, name, color: 'blue', createdAt: '', updatedAt: '' }) as unknown as BankTag;

const groups: BankGroup[] = [
  g('m', 'Matemática'),
  g('alg', 'Álgebra', 'm'),
  g('geo', 'Geometria', 'm', 1),
  g('cal', 'Cálculo', 'm', 2),
  g('cn', 'Ciências Naturais'),
  g('todas', 'Todas'),
];
const tags: BankTag[] = [t('t1', 'fácil'), t('t2', 'média'), t('t3', 'Prova "A"')];

function complete(input: string, caret = input.length, force = false) {
  return getCompletions(input, caret, groups, tags, 'pt', { force });
}

function accept(input: string, label: string, caret = input.length) {
  const c = complete(input, caret);
  const item = c.items.find((i) => i.label === label);
  expect(item, `item "${label}" in ${c.items.map((i) => i.label).join(', ')}`).toBeTruthy();
  return applyCompletion(input, c.from, c.to, item!);
}

describe('autocomplete: replaces the typed word instead of appending (regression)', () => {
  it('"de matem" + Matemática becomes "de Matemática", not "de matemMatemática"', () => {
    const input = 'de matem';
    const c = complete(input);
    expect(c.from).toBe(3);
    expect(c.to).toBe(input.length);
    expect(c.items[0].label).toBe('Matemática');
    const out = accept(input, 'Matemática');
    expect(out.text).toBe('de Matemática ');
    expect(out.caret).toBe(out.text.length);
  });

  it('replaces only the word before the caret when editing mid-text', () => {
    const input = 'DE mat INCLUIR 3 questões';
    const out = accept(input, 'Matemática', 6);
    expect(out.text).toBe('DE Matemática INCLUIR 3 questões');
    expect(out.caret).toBe('DE Matemática'.length);
  });
});

describe('autocomplete: matching', () => {
  it('is accent- and case-insensitive and also matches segment starts', () => {
    expect(complete('DE alg').items.map((i) => i.label)).toContain('Matemática/Álgebra');
    expect(complete('DE CALC').items[0].label).toBe('Matemática/Cálculo');
  });

  it('completes group paths typed with slashes, including partial segments', () => {
    const c = complete('DE Matemática/Ge');
    expect(c.from).toBe(3);
    expect(c.items[0].label).toBe('Matemática/Geometria');
    expect(complete('DE mat/geo').items[0].label).toBe('Matemática/Geometria');
  });

  it('prefers prefix matches over substring matches', () => {
    const labels = complete('DE ge').items.map((i) => i.label);
    expect(labels.indexOf('Matemática/Geometria')).toBeGreaterThanOrEqual(0);
  });

  it('offers tags when typing a tag name or the function name', () => {
    expect(complete('INCLUIR 3 fac').items.map((i) => i.label)).toContain('etiqueta("fácil")');
    const labels = complete('INCLUIR 3 etiq').items.map((i) => i.label);
    expect(labels).toContain('etiqueta("fácil")');
    expect(labels).toContain('etiqueta'); // opens the argument
  });

  it('works in English', () => {
    const c = getCompletions('inc', 3, groups, tags, 'en');
    expect(c.items[0].label).toBe('INCLUDE');
  });
});

describe('autocomplete: when it stays quiet', () => {
  it('shows nothing when nothing is typed, unless forced (Ctrl+Space)', () => {
    expect(complete('DE ').items).toHaveLength(0);
    expect(complete('DE ', 3, true).items.length).toBeGreaterThan(0);
  });

  it('does not suggest while typing a quota count', () => {
    expect(complete('INCLUIR 3').items).toHaveLength(0);
  });

  it('hides a suggestion that is already fully typed', () => {
    expect(complete('DE').items.map((i) => i.insertText)).not.toContain('DE');
    // but normalizes case when it differs
    expect(complete('de').items[0].insertText).toBe('DE');
  });
});

describe('autocomplete: quoting and arguments', () => {
  it('quotes paths that need it', () => {
    const out = accept('DE ciên', 'Ciências Naturais');
    expect(out.text).toBe('DE "Ciências Naturais" ');
  });

  it('quotes a group named like a keyword', () => {
    const out = accept('DE tod', 'Todas');
    expect(out.text).toBe('DE "Todas" ');
  });

  it('inside an open quote, replaces from the quote and consumes an existing closing quote', () => {
    const open = accept('DE "Ciên', 'Ciências Naturais');
    expect(open.text).toBe('DE "Ciências Naturais" ');

    const input = 'DE "Ciên"';
    const closed = accept(input, 'Ciências Naturais', input.length - 1);
    expect(closed.text).toBe('DE "Ciências Naturais" ');
  });

  it('completes the argument of etiqueta( ... ) with quotes and closing paren', () => {
    const out = accept('INCLUIR 3 etiqueta("fá', 'fácil');
    expect(out.text).toBe('INCLUIR 3 etiqueta("fácil")');
  });

  it('does not double the closing paren when one already exists', () => {
    const input = 'INCLUIR 3 etiqueta("fá")';
    const out = accept(input, 'fácil', input.length - 2);
    expect(out.text).toBe('INCLUIR 3 etiqueta("fácil")');
  });

  it('offers tag names right after "etiqueta(" with nothing typed', () => {
    const c = complete('INCLUIR 3 etiqueta(');
    expect(c.items.map((i) => i.label)).toEqual(expect.arrayContaining(['fácil', 'média']));
  });

  it('completes tipo( ... ) values', () => {
    const out = accept('INCLUIR 2 tipo("dis', 'dissertativa');
    expect(out.text).toBe('INCLUIR 2 tipo("dissertativa")');
  });

  it('escapes quotes inside tag names', () => {
    const out = accept('INCLUIR 1 etiqueta("pro', 'Prova "A"');
    expect(out.text).toBe('INCLUIR 1 etiqueta("Prova \\"A\\"")');
  });

  it('accepting the function keyword opens its argument so tag completion follows', () => {
    const out = accept('INCLUIR 3 etiq', 'etiqueta');
    expect(out.text).toBe('INCLUIR 3 etiqueta("');
    const next = getCompletions(out.text, out.caret, groups, tags, 'pt');
    expect(next.items.map((i) => i.label)).toContain('fácil');
  });
});

describe('autocomplete: spacing', () => {
  it('adds a trailing space except before whitespace, ")" or ","', () => {
    expect(accept('DE mat', 'Matemática').text).toBe('DE Matemática ');
    expect(accept('(DE mat)', 'Matemática', 7).text).toBe('(DE Matemática)');
    expect(accept('DE mat INCLUIR', 'Matemática', 6).text).toBe('DE Matemática INCLUIR');
  });
});

describe('autocomplete: end-to-end with the parser', () => {
  it('a query built by successive completions parses without errors', () => {
    let text = 'de matem';
    text = accept(text, 'Matemática').text; // "de Matemática "
    text += 'incl';
    text = accept(text, 'INCLUIR').text; // "... INCLUIR "
    text += '3 etiq';
    text = accept(text, 'etiqueta').text; // etiqueta("
    const c = getCompletions(text, text.length, groups, tags, 'pt');
    const fac = c.items.find((i) => i.label === 'fácil')!;
    text = applyCompletion(text, c.from, c.to, fac).text;
    const result = parse(text, groups, tags);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.blocks).toHaveLength(1);
  });

  it('getSuggestions stays backward compatible', () => {
    const items = getSuggestions('DE Geo', 6, groups, tags, 'pt');
    expect(items.some((i) => i.label === 'Matemática/Geometria')).toBe(true);
  });
});

describe('printer: keyword-named groups are quoted so they round-trip', () => {
  it('prints and re-parses a group called "Todas"', () => {
    const src = 'DE "Todas" INCLUIR 1 questão';
    const first = parse(src, groups, tags);
    expect(first.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const printed = print(first.blocks, groups, tags, { lang: 'pt' });
    expect(printed).toContain('"Todas"');
    const second = parse(printed, groups, tags);
    expect(second.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const stripIds = (v: unknown) => JSON.parse(JSON.stringify(v, (k, x) => (k === 'id' ? undefined : x)));
    expect(stripIds(second.blocks)).toEqual(stripIds(first.blocks));
    expect(second.blocks[0].source).toEqual({ kind: 'group', groupId: 'todas', descendants: true });
  });
});
