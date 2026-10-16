export type OmrErrorCode =
  | 'NO_FIDUCIALS'
  | 'NO_MARK_COLUMNS'
  | 'ROWS_MISMATCH'
  | 'INVALID_IMAGE'
  | 'INVALID_GEOMETRY';

export class OmrDetectionError extends Error {
  code: OmrErrorCode;

  constructor(code: OmrErrorCode, message: string) {
    super(message);
    this.name = 'OmrDetectionError';
    this.code = code;
  }
}

