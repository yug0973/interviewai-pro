import { useRef, useState, type DragEvent } from "react";
import { FileText, Upload, X, Sparkles } from "lucide-react";
import { resumeApi, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

interface ResumeUploadCardProps {
  onUploaded: () => void;
}

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function isAccepted(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".pdf") ||
    file.name.endsWith(".docx")
  );
}

export function ResumeUploadCard({ onUploaded }: ResumeUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const toast = useToast();

  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  function handleFile(file: File) {
    if (!isAccepted(file)) {
      setError("Only PDF and DOCX resume formats are supported.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File size exceeds the 10MB limit.");
      return;
    }
    setError("");
    setPendingFile(file);
    if (!label) {
      setLabel(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setError("");
    try {
      await resumeApi.upload(pendingFile, {
        label: label || pendingFile.name.replace(/\.[^/.]+$/, ""),
        targetRole: targetRole || undefined,
      });
      setPendingFile(null);
      setTargetRole("");
      setLabel("");
      toast.success("Resume uploaded!", "ATS analysis is running in the background.");
      onUploaded();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed. Please try again.";
      setError(msg);
      toast.error("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-signal">Upload Resume</h2>
        <span className="rounded-full bg-alert/15 border border-alert/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-alert font-semibold">
          AI-Powered
        </span>
      </div>
      <p className="mt-1 text-xs text-static">
        Upload your PDF or DOCX resume to get an instant calibrated ATS score and keyword gap analysis.
      </p>

      {!pendingFile ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setIsDragging(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={`mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center transition-all ${
            isDragging
              ? "border-alert bg-alert/10 scale-[1.01]"
              : "border-line-strong hover:border-static bg-void/50 hover:bg-void"
          }`}
        >
          <div className="grid size-12 place-content-center rounded-2xl bg-alert/15 text-alert">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-signal">
              {isDragging ? "Drop your resume here" : "Click to browse or drag & drop"}
            </p>
            <p className="mt-1 font-mono text-xs text-static-dim">PDF or DOCX (max 10MB)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-void px-4 py-3.5">
            <div className="grid size-10 place-content-center rounded-lg bg-alert/15 text-alert shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-signal">{pendingFile.name}</p>
              <p className="font-mono text-xs text-static-dim">{(pendingFile.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={() => setPendingFile(null)}
              className="shrink-0 p-1.5 text-static hover:text-rose-400 transition-colors"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-static">
                Label / Version Name
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Backend Lead 2026"
                className="w-full rounded-lg border border-line-strong bg-void px-3.5 py-2.5 text-sm text-signal placeholder-static-dim outline-none transition-colors focus:border-alert"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wider text-static">
                Target Role (Optional)
              </label>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded-lg border border-line-strong bg-void px-3.5 py-2.5 text-sm text-signal placeholder-static-dim outline-none transition-colors focus:border-alert"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-alert py-3 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-void border-t-transparent" />
                <span>Uploading & Analyzing…</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Run Deep ATS Analysis</span>
              </>
            )}
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
