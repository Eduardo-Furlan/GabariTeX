export interface Point {
  x: number;
  y: number;
}

export interface SheetCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface BubbleCoordinates {
  questionNumber: number;
  optionLabel: 'A' | 'B' | 'C' | 'D' | 'E';
  centerXPercent: number;
  centerYPercent: number;
  radiusPercent: number;
}

export interface OmrRawDetection {
  questionNumber: number;
  fillRatios: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  detectedMark: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  status: 'marked' | 'blank' | 'multiple';
}

export interface DecryptedQrPayload {
  examId: string;
  version: string;
  key: Record<number, string>;
  points?: Record<number, number>;
}
