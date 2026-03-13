/**
 * Generic CSV export utility
 */
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
