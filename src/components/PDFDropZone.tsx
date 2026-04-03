import React, { useCallback, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PDFDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const PDFDropZone: React.FC<PDFDropZoneProps> = ({ onFilesSelected, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf'
      );
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onFilesSelected(files);
      e.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all duration-300',
        'bg-dropzone border-dropzone-border hover:border-dropzone-active hover:bg-accent',
        isDragging && 'border-dropzone-active bg-accent scale-[1.02] shadow-lg',
        isProcessing && 'opacity-50 pointer-events-none'
      )}
    >
      <input
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        {isProcessing ? (
          <FileText className="h-8 w-8 text-primary animate-pulse" />
        ) : (
          <Upload className="h-8 w-8 text-primary" />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">
          {isProcessing ? 'Analyse en cours...' : 'Glissez vos bons de commande ici'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          ou cliquez pour sélectionner des fichiers PDF
        </p>
      </div>
    </label>
  );
};

export default PDFDropZone;
