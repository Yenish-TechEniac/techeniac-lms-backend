import type { MenteePerformanceRow } from './schemas/performance.schemas';

export class ExportService {
  /**
   * Converts mentee performance records into RFC 4180 compliant CSV format (FR-11.6, PER-05).
   */
  generatePerformanceCsv(rows: MenteePerformanceRow[]): string {
    const headers = [
      'Mentee Name',
      'Mentee Email',
      'Batch',
      'Assigned Courses',
      'Completed Courses',
      'Completion %',
      'Average Marks',
      'Total Submissions',
      'On-Time Submissions',
      'On-Time Rate %',
      'Overdue Count',
      'Latest Grade',
    ];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvLines = [headers.map(escapeCsv).join(',')];

    for (const row of rows) {
      csvLines.push(
        [
          escapeCsv(row.menteeName),
          escapeCsv(row.menteeEmail),
          escapeCsv(row.batchName ?? 'Unbatched'),
          escapeCsv(row.assignedCoursesCount),
          escapeCsv(row.completedCoursesCount),
          escapeCsv(`${row.completionPercentage}%`),
          escapeCsv(row.averageMarks !== null ? row.averageMarks : 'N/A'),
          escapeCsv(row.totalSubmissions),
          escapeCsv(row.onTimeSubmissions),
          escapeCsv(`${row.onTimeRate}%`),
          escapeCsv(row.overdueCount),
          escapeCsv(row.latestGrade ?? 'N/A'),
        ].join(','),
      );
    }

    return csvLines.join('\n');
  }
}

export const exportService = new ExportService();
