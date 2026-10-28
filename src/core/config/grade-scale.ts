export interface GradeThreshold {
  readonly minPercentage: number;
  readonly label: string;
}

/**
 * Fixed Grade Scale thresholds per PRD Line 358 & Fixed Decision #27.
 * Evaluates performance percentage: (marks / maxMarks) * 100.
 */
export const GRADE_SCALE: readonly GradeThreshold[] = [
  { minPercentage: 90, label: 'A+' },
  { minPercentage: 80, label: 'A' },
  { minPercentage: 70, label: 'B' },
  { minPercentage: 60, label: 'C' },
  { minPercentage: 50, label: 'D' },
  { minPercentage: 0, label: 'F' },
] as const;

/**
 * Computes the canonical letter-grade label from marks and assignment maxMarks.
 * Throws an error or defaults to 'F' if maxMarks is non-positive.
 */
export function calculateGradeLabel(marks: number, maxMarks: number): string {
  if (maxMarks <= 0) {
    return 'F';
  }
  const percentage = (marks / maxMarks) * 100;
  for (const threshold of GRADE_SCALE) {
    if (percentage >= threshold.minPercentage) {
      return threshold.label;
    }
  }
  return 'F';
}
