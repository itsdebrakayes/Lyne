import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileSpreadsheet, FileJson, FileText, Check, X, Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

type FormatType = 'csv' | 'json' | 'excel';
type StatusType = 'preparing' | 'downloading' | 'complete' | 'error';

const formatIcons: Record<FormatType, LucideIcon> = {
  csv: FileText,
  json: FileJson,
  excel: FileSpreadsheet,
};

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format?: FormatType;
  filename?: string;
  onExport?: () => void;
}

export const ExportModal = ({ 
  open, 
  onOpenChange, 
  format = 'csv',
  filename = 'export',
  onExport 
}: ExportModalProps) => {
  const [status, setStatus] = useState<StatusType>('preparing');
  const [progress, setProgress] = useState(0);
  const [fileSize, setFileSize] = useState('0 KB');

  const Icon = formatIcons[format] || FileText;

  useEffect(() => {
    if (open) {
      setStatus('preparing');
      setProgress(0);
      
      // Simulate export process
      const prepareTimeout = setTimeout(() => {
        setStatus('downloading');
        setFileSize('2.4 MB');
      }, 500);

      return () => clearTimeout(prepareTimeout);
    }
  }, [open]);

  useEffect(() => {
    if (status === 'downloading') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus('complete');
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [status]);

  const handleClose = () => {
    if (status === 'complete' && onExport) {
      onExport();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Export Data</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {/* File Icon */}
          <div className={cn(
            "w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
            status === 'complete' 
              ? "bg-status-light/20" 
              : status === 'error'
              ? "bg-status-busy/20"
              : "bg-primary/20"
          )}>
            {status === 'complete' ? (
              <Check className="w-10 h-10 text-status-light" />
            ) : status === 'error' ? (
              <X className="w-10 h-10 text-status-busy" />
            ) : status === 'downloading' ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <Icon className="w-10 h-10 text-primary" />
            )}
          </div>

          {/* Filename */}
          <p className="text-lg font-medium text-foreground mb-1">
            {filename}.{format}
          </p>

          {/* File Size */}
          <p className="text-sm text-muted-foreground mb-6">
            {fileSize}
          </p>

          {/* Progress Bar */}
          {(status === 'downloading' || status === 'complete') && (
            <div className="w-full mb-6">
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-2">
                {status === 'complete' ? 'Complete!' : `${progress}%`}
              </p>
            </div>
          )}

          {/* Status Text */}
          <p className="text-sm text-muted-foreground mb-4">
            {status === 'preparing' && 'Preparing your export...'}
            {status === 'downloading' && 'Downloading...'}
            {status === 'complete' && 'Your file is ready!'}
            {status === 'error' && 'Something went wrong. Please try again.'}
          </p>

          {/* Action Button */}
          {status === 'complete' && (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          )}
          {status === 'error' && (
            <Button 
              onClick={() => setStatus('preparing')} 
              variant="outline"
              className="w-full"
            >
              Retry
            </Button>
          )}
        </div>

        {/* Glow effect */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 rounded-full" />
      </DialogContent>
    </Dialog>
  );
};
