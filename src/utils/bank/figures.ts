import { fnv1a32 } from '../fingerprint';

export interface QuestionFigure {
  id?: string;
  url: string;
  caption?: string;
}

export interface QuestionImageRef {
  url: string;
  caption?: string;
  setUrl: (newUrl: string) => void;
}

export interface QuestionWithLegacyFigures {
  imageUrl?: string;
  imageCaption?: string;
  [key: string]: any;
}

/**
 * Returns figures from question. Currently wraps legacy imageUrl and imageCaption fields.
 */
export function getQuestionFigures(
  q: QuestionWithLegacyFigures
): QuestionFigure[] {
  if (!q.imageUrl) return [];
  return [
    {
      url: q.imageUrl,
      caption: q.imageCaption,
    },
  ];
}

/**
 * Sets figures onto a question. Currently wraps legacy imageUrl and imageCaption fields.
 */
export function setQuestionFigures<T extends QuestionWithLegacyFigures>(
  q: T,
  figures: readonly QuestionFigure[]
): T {
  if (figures && figures.length > 0) {
    q.imageUrl = figures[0].url;
    q.imageCaption = figures[0].caption;
  } else {
    delete q.imageUrl;
    delete q.imageCaption;
  }
  return q;
}

/**
 * Collects all image-bearing slots from a question with mutable setters.
 * Used for asset externalization/internalization across zip and storage.
 */
export function collectQuestionImageRefs(
  q: QuestionWithLegacyFigures
): QuestionImageRef[] {
  if (!q.imageUrl) return [];
  return [
    {
      url: q.imageUrl,
      caption: q.imageCaption,
      setUrl: (newUrl: string) => {
        q.imageUrl = newUrl;
      },
    },
  ];
}

/**
 * Computes a hash key of the question's image data ('none' when no figures).
 */
export function figureKey(q: QuestionWithLegacyFigures): string {
  const figures = getQuestionFigures(q);
  if (figures.length === 0) {
    return 'none';
  }
  const payload = figures.map((f) => `${f.url}::${f.caption || ''}`).join('|');
  return fnv1a32(payload);
}
