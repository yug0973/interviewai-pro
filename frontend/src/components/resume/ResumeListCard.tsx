import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trash2, ChevronRight, FileText, Briefcase } from "lucide-react";
import { StatusIcon } from "@/components/ui/status-icon";
import type { Resume } from "@/lib/api";

interface ResumeListCardProps {
  resumes: Resume[];
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ResumeListCard({ resumes, onSetPrimary, onDelete }: ResumeListCardProps) {
  if (resumes.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto grid size-12 place-content-center rounded-2xl bg-void text-static">
          <FileText size={24} />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-signal">No resumes uploaded yet</h3>
        <p className="mt-1.5 text-xs text-static">
          Upload your resume in PDF or DOCX format to get your instant ATS score.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-signal">Your Resumes</h2>
          <p className="mt-0.5 text-xs text-static">Click any resume to inspect the deep ATS report.</p>
        </div>
        {resumes.length >= 2 ? (
          <Link
            to="/resumes/compare"
            className="font-mono text-xs uppercase tracking-wider text-alert hover:underline font-semibold"
          >
            Compare Resumes »
          </Link>
        ) : null}
      </div>

      <motion.div className="mt-6 space-y-3">
        <AnimatePresence>
          {resumes.map((resume) => (
            <motion.div
              key={resume.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-line-strong bg-void p-4 transition-all hover:border-static-dim"
            >
              <Link
                to={`/resumes/${resume.id}`}
                className="flex flex-1 items-center gap-3.5 min-w-0"
              >
                <StatusIcon status={resume.status} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-signal group-hover:text-alert transition-colors">
                      {resume.label}
                    </p>
                    {resume.isPrimary ? (
                      <span className="shrink-0 rounded-full bg-alert/15 border border-alert/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold text-alert">
                        Primary
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-xs text-static-dim">
                    {resume.status === "COMPLETED" && resume.analysis
                      ? `ATS Score ${resume.analysis.atsScore}/100 · ${resume.analysis.detectedRole}`
                      : resume.status === "FAILED"
                        ? (resume.failureReason ?? "Analysis failed")
                        : "Analyzing structure and keywords…"}
                  </p>
                </div>
              </Link>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                <Link
                  to={`/job-match?resumeId=${resume.id}`}
                  className="rounded-lg p-2 text-static hover:bg-surface hover:text-alert transition-colors"
                  title="Match with Job Description"
                >
                  <Briefcase size={16} />
                </Link>

                {!resume.isPrimary ? (
                  <button
                    onClick={() => onSetPrimary(resume.id)}
                    className="rounded-lg p-2 text-static hover:bg-surface hover:text-alert transition-colors"
                    title="Set as primary"
                  >
                    <Star size={16} />
                  </button>
                ) : null}

                <button
                  onClick={() => onDelete(resume.id)}
                  className="rounded-lg p-2 text-static hover:bg-surface hover:text-rose-400 transition-colors"
                  title="Delete resume"
                >
                  <Trash2 size={16} />
                </button>

                <Link
                  to={`/resumes/${resume.id}`}
                  className="rounded-lg p-2 text-static group-hover:text-signal transition-colors"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
