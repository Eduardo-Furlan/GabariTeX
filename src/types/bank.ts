import { QuestionType, QuestionOption } from './exam';

export type { QuestionType, QuestionOption };

/**
 * A group in the question bank taxonomy.
 * Forms an arbitrarily deep tree where parentId === null represents top-level.
 */
export interface BankGroup {
  id: string;
  /** Parent group ID, or null for root groups */
  parentId: string | null;
  /** 1..60 chars after trim, no "/", unique among siblings (case-insensitive) */
  name: string;
  /** Sibling ordering, dense 0..n-1 */
  order: number;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type TagColor = 'slate' | 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet' | 'pink';

/**
 * A reusable tag in the question bank.
 */
export interface BankTag {
  id: string;
  /** 1..40 chars, NFC-normalized, trimmed, internal whitespace collapsed; unique case-insensitive */
  name: string;
  color: TagColor;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single reusable question in the bank.
 */
export interface BankQuestion {
  id: string;
  /** Associated group ID, or null for "Sem Grupo" */
  groupId: string | null;
  type: QuestionType;
  /** Prompt text with LaTeX / KaTeX support */
  prompt: string;
  /** Default points when added to an exam */
  points: number;
  imageUrl?: string;
  imageCaption?: string;
  /** Objective questions: 2..5 options, exactly one correct */
  options?: QuestionOption[];
  /** Subjective questions: number of ruled lines */
  linesForAnswer?: number;
  /** Tag IDs attached to this question (max 20) */
  tagIds: string[];
  /** Private notes/source remarks (never printed on exams) */
  notes?: string;
  /** Private worked solution (never printed on exams) */
  solution?: string;
  /** Whether question is archived (excluded from generator unless explicitly requested) */
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Source expression defining question pool for a generator rule block.
 */
export type SourceExpr =
  | { kind: 'group'; groupId: string; descendants: boolean }
  | { kind: 'all' }
  | { kind: 'or' | 'and' | 'xor'; operands: SourceExpr[] }
  | { kind: 'except'; base: SourceExpr; excluded: SourceExpr };

export interface QuotaFilter {
  /** Question must have ALL of these tags (intersection) */
  tagIds: string[];
  /** Question must have NONE of these tags */
  notTagIds: string[];
  /** Optional filter by question type */
  type?: QuestionType;
}

export interface QuotaLine {
  id: string;
  /** Integer count 1..40 */
  count: number;
  filter: QuotaFilter;
  /** Line-level points override */
  points?: number;
}

export interface RuleBlock {
  id: string;
  source: SourceExpr;
  /** Block-level points override */
  points?: number;
  /** At least 1 quota line */
  quotas: QuotaLine[];
}

export interface Blueprint {
  id: string;
  name: string;
  description?: string;
  /** At least 1 rule block */
  blocks: RuleBlock[];
  createdAt: string;
  updatedAt: string;
}

export type BankBlueprint = Blueprint;

export interface BankMeta {
  schema: 1;
  groups: BankGroup[];
  tags: BankTag[];
  blueprints: Blueprint[];
}

export interface BankData extends Omit<BankMeta, 'schema'> {
  questions: BankQuestion[];
}

/**
 * Manifest for sharing question bank subtrees (.gabaritex-bank.zip)
 */
export interface BankShareManifest {
  app: 'gabaritex';
  kind: 'question-bank';
  schema: 1;
  exportedAt: string;
  counts: {
    groups: number;
    tags: number;
    questions: number;
    assets: number;
  };
  files: Record<string, string>;
}

