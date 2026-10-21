import { describe, it, expect } from 'vitest';
import {
  getQuestionFigures,
  setQuestionFigures,
  collectQuestionImageRefs,
  figureKey,
  QuestionFigure,
} from '../src/utils/bank/figures';

describe('figures (forward-compat 1.3.0 module)', () => {
  it('getQuestionFigures returns empty array when no image', () => {
    expect(getQuestionFigures({})).toEqual([]);
    expect(getQuestionFigures({ prompt: 'Sem imagem' })).toEqual([]);
  });

  it('getQuestionFigures wraps legacy imageUrl and imageCaption', () => {
    const q = {
      imageUrl: 'data:image/png;base64,1234',
      imageCaption: 'Legenda teste',
    };
    expect(getQuestionFigures(q)).toEqual([
      { url: 'data:image/png;base64,1234', caption: 'Legenda teste' },
    ]);
  });

  it('setQuestionFigures sets legacy imageUrl and imageCaption', () => {
    const q: { imageUrl?: string; imageCaption?: string } = {};
    const figs: QuestionFigure[] = [{ url: 'asset:abc.png', caption: 'Figura 1' }];

    setQuestionFigures(q, figs);
    expect(q.imageUrl).toBe('asset:abc.png');
    expect(q.imageCaption).toBe('Figura 1');

    // Setting empty array cleans up legacy fields
    setQuestionFigures(q, []);
    expect(q.imageUrl).toBeUndefined();
    expect(q.imageCaption).toBeUndefined();
  });

  it('collectQuestionImageRefs returns slots with working setters', () => {
    const q = {
      imageUrl: 'data:image/png;base64,oldBytes',
      imageCaption: 'Foto',
    };

    const refs = collectQuestionImageRefs(q);
    expect(refs).toHaveLength(1);
    expect(refs[0].url).toBe('data:image/png;base64,oldBytes');
    expect(refs[0].caption).toBe('Foto');

    // Mutate via setter
    refs[0].setUrl('asset:hash123.png');
    expect(q.imageUrl).toBe('asset:hash123.png');
  });

  it('figureKey returns "none" when no figures', () => {
    expect(figureKey({})).toBe('none');
    expect(figureKey({ imageUrl: undefined })).toBe('none');
  });

  it('figureKey returns deterministic hash when figures are present', () => {
    const q1 = { imageUrl: 'data:image/png;base64,data1', imageCaption: 'Cap1' };
    const q2 = { imageUrl: 'data:image/png;base64,data1', imageCaption: 'Cap1' };
    const q3 = { imageUrl: 'data:image/png;base64,data2', imageCaption: 'Cap1' };

    expect(figureKey(q1)).toBe(figureKey(q2));
    expect(figureKey(q1)).not.toBe('none');
    expect(figureKey(q1)).not.toBe(figureKey(q3));
  });
});
