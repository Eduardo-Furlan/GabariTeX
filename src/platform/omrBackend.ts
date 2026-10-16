import {
  OmrRawDetection,
  OmrDebugInfo,
  OmrTimingMarkDebug,
  OmrBubbleDebug,
  GradingEvidence,
} from '../types/omr';

export interface NativeOmrRequest {
  totalQuestions: number;
  subjectiveQuestions: number[];
  readQr: boolean;
  readOmr?: boolean;
  generateDebugImage: boolean;
}

export interface NativeOmrRawDetection {
  questionNumber: number;
  fillRatios: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  detectedMark: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  status: 'marked' | 'blank' | 'multiple';
}

export interface NativeOmrResponse {
  qrRawText: string | null;
  omrError: { code: string; message: string } | null;
  detections: NativeOmrRawDetection[];
  debugInfo: {
    method: string;
    logs: string[];
    timingMarks?: OmrTimingMarkDebug[];
    bubbles?: OmrBubbleDebug[];
  };
  debugImageDataUrl: string;
  rowCrops: Record<number, string>;
}

export async function processExamPhotoNative(
  imageBytes: Uint8Array,
  req: NativeOmrRequest
): Promise<NativeOmrResponse> {
  const { invoke } = await import('@tauri-apps/api/core');
  const payload = {
    ...req,
    readOmr: req.readOmr ?? true,
  };
  return await invoke<NativeOmrResponse>('process_exam_photo', imageBytes, {
    headers: {
      'x-omr-options': JSON.stringify(payload),
    },
  });
}

export function convertNativeResponse(
  res: NativeOmrResponse
): {
  detections: OmrRawDetection[];
  debugInfo: OmrDebugInfo;
  evidence: GradingEvidence;
} {
  const detections: OmrRawDetection[] = res.detections.map((d) => ({
    questionNumber: d.questionNumber,
    fillRatios: d.fillRatios,
    detectedMark: d.detectedMark,
    status: d.status,
  }));

  const debugInfo: OmrDebugInfo = {
    method: 'fiducials_timing_marks',
    timingMarks: res.debugInfo.timingMarks ?? [],
    bubbles: res.debugInfo.bubbles ?? [],
    logs: res.debugInfo.logs,
  };

  const evidence: GradingEvidence = {
    rowCrops: res.rowCrops,
    sheetThumbUrl: res.debugImageDataUrl || undefined,
  };

  return { detections, debugInfo, evidence };
}
