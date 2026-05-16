import { useState, useRef } from 'react';
import { uploadApi } from '@/api';
import { Paperclip, X, FileText, Image, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// FileAttachmentZone: Drag-and-drop or click-to-upload zone
// Props:
//   files: array of { name, url, size, mimeType } — controlled
//   onChange: (files) => void — called with updated files array
//   maxFiles?: number (default 5)
//   label?: string (default "Attach Files")
export function FileAttachmentZone({ files = [], onChange, maxFiles = 5, label = "Attach Files", className }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    if (uploading || files.length >= maxFiles) return;
    const toUpload = Array.from(fileList).slice(0, maxFiles - files.length);
    setUploading(true);
    try {
      const results = await Promise.all(toUpload.map(f => uploadApi.upload(f).then(r => r.data)));
      onChange([...files, ...results]);
    } catch (e) {
      // If backend not available (dev), use blob URLs as fallback
      const fallback = toUpload.map(f => ({
        name: f.name,
        url: URL.createObjectURL(f),
        size: f.size,
        mimeType: f.type,
      }));
      onChange([...files, ...fallback]);
    } finally {
      setUploading(false);
    }
  }

  function removeFile(idx) {
    onChange(files.filter((_, i) => i !== idx));
  }

  const isImage = (f) => f.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "opacity-60 pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Uploading...</span></>
        ) : (
          <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{label} · drag & drop or click · max {maxFiles} files</span></>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs max-w-[200px]">
              {isImage(f) ? <Image className="w-3 h-3 text-blue-500 shrink-0" /> : <FileText className="w-3 h-3 text-orange-500 shrink-0" />}
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline text-foreground" title={f.name}>{f.name}</a>
              <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
