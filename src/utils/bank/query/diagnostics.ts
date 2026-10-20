export interface Diagnostic {
  start: number;
  end: number;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  suggestion?: string;
}
