export const SHEET = {
  MARK_PX: 10, // marca de linha (preta, sólida)
  MARK_GAP_PX: 6, // espaço entre marca e conteúdo
  LABEL_PX: 48, // "01."
  BUBBLE_PX: 24, // diâmetro externo da bolinha (inclui a borda)
  OPTIONS_PX: 176, // largura fixa da área das alternativas
  OPTIONS_COUNT: 5,
  MAX_QUESTIONS: 40,
  SINGLE_COLUMN_MAX: 12,
} as const;

export function getColumnLayout(total: number): { columns: 1 | 2; perColumn: number } {
  const columns: 1 | 2 = total <= SHEET.SINGLE_COLUMN_MAX ? 1 : 2;
  const perColumn = columns === 1 ? total : Math.ceil(total / 2);
  return { columns, perColumn };
}

export function rowWidthPx(): number {
  return (
    SHEET.MARK_PX +
    SHEET.MARK_GAP_PX +
    SHEET.LABEL_PX +
    SHEET.OPTIONS_PX +
    SHEET.MARK_GAP_PX +
    SHEET.MARK_PX
  );
}

export function markSpanPx(): number {
  return rowWidthPx() - SHEET.MARK_PX;
}

export function optionCenterOffsetsPx(): number[] {
  const leftStart = SHEET.MARK_PX / 2 + SHEET.MARK_GAP_PX + SHEET.LABEL_PX;
  const freeSpace = SHEET.OPTIONS_PX - SHEET.OPTIONS_COUNT * SHEET.BUBBLE_PX;
  const gap = freeSpace / SHEET.OPTIONS_COUNT;
  const step = SHEET.BUBBLE_PX + gap;
  const firstCenter = gap / 2 + SHEET.BUBBLE_PX / 2;

  const offsets: number[] = [];
  for (let i = 0; i < SHEET.OPTIONS_COUNT; i++) {
    offsets.push(Number((leftStart + firstCenter + i * step).toFixed(1)));
  }
  return offsets;
}

export function bubbleRadiusPx(): number {
  return SHEET.BUBBLE_PX / 2;
}

