import { prisma } from '../../config/prisma';
import type { ResumeStatus, Prisma } from '@prisma/client';
import type { ResumeAnalysisResult } from '../../integrations/ai/types';

export interface CreateResumeData {
  userId: string;
  label: string;
  isPrimary?: boolean;
  targetRole?: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  extractionMethod: string;
  extractedText?: string;
}

export interface AnalysisMetadata {
  provider: string;
  model: string;
  costUsd: number;
}

export const resumeRepository = {
  createResume(data: CreateResumeData) {
    return prisma.resume.create({
      data: {
        userId: data.userId,
        label: data.label,
        isPrimary: data.isPrimary ?? false,
        targetRole: data.targetRole,
        originalFilename: data.originalFilename,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        cloudinaryPublicId: data.cloudinaryPublicId,
        cloudinaryUrl: data.cloudinaryUrl,
        extractionMethod: data.extractionMethod,
        extractedText: data.extractedText,
        status: 'PROCESSING',
      },
      include: { analysis: true },
    });
  },

  countResumesThisMonth(userId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return prisma.resume.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    });
  },

  findAllForUser(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      include: { analysis: true },
    });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.resume.findFirst({
      where: { id, userId },
      include: { analysis: true },
    });
  },

  findById(id: string) {
    return prisma.resume.findUnique({
      where: { id },
      include: { analysis: true },
    });
  },

  async setPrimary(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Unset existing primary resumes for this user
      await tx.resume.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set selected resume as primary
      return tx.resume.update({
        where: { id },
        data: { isPrimary: true },
        include: { analysis: true },
      });
    });
  },

  delete(id: string) {
    return prisma.resume.delete({ where: { id } });
  },

  updateExtractedText(id: string, extractedText: string) {
    return prisma.resume.update({
      where: { id },
      data: { extractedText },
    });
  },

  updateStatus(id: string, status: ResumeStatus, failureReason?: string) {
    return prisma.resume.update({
      where: { id },
      data: {
        status,
        failureReason: failureReason ?? null,
      },
    });
  },

  createAnalysis(resumeId: string, analysis: ResumeAnalysisResult, meta: AnalysisMetadata) {
    return prisma.resumeAnalysis.upsert({
      where: { resumeId },
      create: {
        resumeId,
        atsScore: Math.round(analysis.atsScore),
        summary: analysis.summary,
        detectedRole: analysis.detectedRole,
        experienceLevel: analysis.experienceLevel,
        skills: analysis.skills,
        technicalSkills: analysis.technicalSkills,
        softSkills: analysis.softSkills,
        missingKeywords: analysis.missingKeywords,
        certifications: analysis.certifications,
        educationReview: analysis.educationReview,
        projectReview: analysis.projectReview,
        experienceReview: analysis.experienceReview,
        grammarIssues: analysis.grammarIssues,
        formattingIssues: analysis.formattingIssues,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        rewriteSuggestions: analysis.rewriteSuggestions as unknown as Prisma.InputJsonValue,
        aiProvider: meta.provider,
        aiModel: meta.model,
        costUsd: meta.costUsd,
      },
      update: {
        atsScore: Math.round(analysis.atsScore),
        summary: analysis.summary,
        detectedRole: analysis.detectedRole,
        experienceLevel: analysis.experienceLevel,
        skills: analysis.skills,
        technicalSkills: analysis.technicalSkills,
        softSkills: analysis.softSkills,
        missingKeywords: analysis.missingKeywords,
        certifications: analysis.certifications,
        educationReview: analysis.educationReview,
        projectReview: analysis.projectReview,
        experienceReview: analysis.experienceReview,
        grammarIssues: analysis.grammarIssues,
        formattingIssues: analysis.formattingIssues,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        rewriteSuggestions: analysis.rewriteSuggestions as unknown as Prisma.InputJsonValue,
        aiProvider: meta.provider,
        aiModel: meta.model,
        costUsd: meta.costUsd,
      },
    });
  },
};