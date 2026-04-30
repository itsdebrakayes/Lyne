import * as React from 'react';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  onExport: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}

export function ExportButton({ 
  onExport, 
  loading = false, 
  label = 'Export CSV',
  className 
}: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onExport}
      disabled={loading}
      className={cn('gap-2', className)}
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exporting...' : label}
    </Button>
  );
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
