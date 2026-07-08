-- AlterTable
ALTER TABLE "interview_questions" ADD COLUMN     "evaluationImprovements" TEXT[],
ADD COLUMN     "evaluationStrengths" TEXT[],
ADD COLUMN     "idealAnswerSummary" TEXT,
ADD COLUMN     "score" INTEGER;
