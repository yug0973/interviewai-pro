import { prisma } from '../../config/prisma';
import { aiProvider } from '../../integrations/ai/ai.factory';
import { logger } from '../../common/logger';
import type {
  RealtimeAgentAction,
  RealtimeAgentTurnResult,
  RealtimeEvaluationResult,
} from '../../integrations/ai/types';

export interface ProcessSpeechResult {
  aiResponse: string;
  action: RealtimeAgentAction;
  topic: string;
  isFollowUp: boolean;
  isInterviewComplete: boolean;
  order: number;
  latency: {
    processingMs: number;
  };
}

export class RealtimeAgentService {
  /**
   * Initializes the conversational opening when the candidate enters the room.
   */
  async getInitialGreeting(sessionId: string): Promise<{ text: string; topic: string; order: number }> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        resume: {
          include: { analysis: true },
        },
        user: { select: { name: true } },
      },
    });

    if (!session) throw new Error(`Session ${sessionId} not found`);

        const candidateName = session.user?.name?.split(' ')[0] || 'there';
    const role = session.targetRole;
    const resumeSkills = session.resume?.analysis?.technicalSkills || [];
    const difficulty = (session.difficulty || 'medium').toLowerCase();
    const interviewType = (session.interviewType || 'technical').toLowerCase();
    const randomSkill = resumeSkills.length > 0
      ? resumeSkills[Math.floor(Math.random() * resumeSkills.length)]
      : null;
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    const openers = [
      `Hey ${candidateName}, good to have you here. I'll be conducting your ${role} interview today — let's keep it conversational, so just think out loud as we go. To kick things off, tell me about yourself and what's been the most technically interesting project you've shipped recently.`,
      `${candidateName}, welcome! I'm excited to chat with you about the ${role} position. Let's jump right in — walk me through your background and give me a sense of a recent technical challenge that really pushed you.`,
      `Good ${timeOfDay}, ${candidateName}. I'll be your interviewer today for the ${role} role. ${randomSkill ? `I see you have experience with ${randomSkill} — we'll definitely get into that. ` : ''}But first, give me a quick picture of who you are and what you've been working on lately.`,
      `Hi ${candidateName}! Let's get started — this will be a ${difficulty}-level ${interviewType} session for the ${role} position. I like to keep things real and technical, so don't worry about sounding perfect. Start by telling me what you're most proud of building in the last year or two.`,
      `${candidateName}, great to meet you. ${randomSkill ? `You've got a background in ${randomSkill} — really curious to dig into that. ` : ''}Before we get into the technical stuff, introduce yourself — what are you working on these days and what drew you to this kind of role?`,
    ];

    const openingText = openers[Math.floor(Math.random() * openers.length)];

    // Persist AI opening turn
    const message = await prisma.interviewMessage.create({
      data: {
        sessionId,
        speaker: 'AI',
        text: openingText,
        order: 1,
        topic: 'Introduction & Project Overview',
        isFollowUp: false,
      },
    });

    // Update room state to IN_PROGRESS
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { roomState: 'IN_PROGRESS' },
    });

    return {
      text: openingText,
      topic: 'Introduction & Project Overview',
      order: message.order,
    };
  }

  /**
   * Processes a candidate's completed spoken answer, queries the AI Interviewer agent,
   * stores transcript turns, and determines if the session should conclude.
   */
  async processCandidateSpeech(
    sessionId: string,
    candidateSpeech: string
  ): Promise<ProcessSpeechResult> {
    const startProcessing = Date.now();

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        resume: {
          include: { analysis: true },
        },
        messages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentOrder = session.messages.length + 1;

    // 1. Record candidate's message
    await prisma.interviewMessage.create({
      data: {
        sessionId,
        speaker: 'CANDIDATE',
        text: candidateSpeech.trim(),
        order: currentOrder,
        topic: session.messages[session.messages.length - 1]?.topic || 'Technical Discussion',
      },
    });

    // 2. Build conversational history & context for AI agent
    const conversationHistory = session.messages.map((m) => ({
      speaker: m.speaker as 'AI' | 'CANDIDATE',
      text: m.text,
      topic: m.topic || undefined,
      isFollowUp: m.isFollowUp,
    }));
    conversationHistory.push({
      speaker: 'CANDIDATE',
      text: candidateSpeech.trim(),
      topic: session.messages[session.messages.length - 1]?.topic || undefined,
      isFollowUp: false,
    });

    const questionsCount = session.messages.filter((m) => m.speaker === 'AI').length;

    // 3. Call AI provider for next conversational move
    const aiResult = await aiProvider.realtimeAgentTurn({
      role: session.targetRole,
      difficulty: (session.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      interviewType: session.interviewType || 'technical',
      candidateSpeech: candidateSpeech.trim(),
      conversationHistory,
      resumeSkills: session.resume?.analysis?.technicalSkills || [],
      resumeProjects: session.resume?.analysis?.strengths || [],
      jobDescription: session.jobDescriptionText || undefined,
      questionsCount,
      currentTopic: session.messages[session.messages.length - 1]?.topic || undefined,
    });

    const aiTurn: RealtimeAgentTurnResult = aiResult.data;
    const processingMs = Date.now() - startProcessing;

    logger.info('AI Interviewer turn generated', {
      sessionId,
      action: aiTurn.action,
      topic: aiTurn.topic,
      isFollowUp: aiTurn.isFollowUp,
      latencyMs: processingMs,
    });

    // 4. Record AI's response turn
    const aiMessageOrder = currentOrder + 1;
    await prisma.interviewMessage.create({
      data: {
        sessionId,
        speaker: 'AI',
        text: aiTurn.aiResponse,
        order: aiMessageOrder,
        topic: aiTurn.topic,
        isFollowUp: aiTurn.isFollowUp,
        technicalDepth: aiTurn.technicalDepth,
        confidenceScore: aiTurn.confidenceScore,
      },
    });

    // 5. Check if interview should conclude
    const isComplete = aiTurn.isInterviewComplete || questionsCount >= session.maxQuestions;

    if (isComplete) {
      await this.finalizeRealtimeSession(sessionId);
    }

    return {
      aiResponse: aiTurn.aiResponse,
      action: aiTurn.action,
      topic: aiTurn.topic,
      isFollowUp: aiTurn.isFollowUp,
      isInterviewComplete: isComplete,
      order: aiMessageOrder,
      latency: {
        processingMs,
      },
    };
  }

  /**
   * Finalizes the real-time session, computes overall evaluations and integrity report.
   */
  async finalizeRealtimeSession(sessionId: string): Promise<RealtimeEvaluationResult> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { order: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) throw new Error(`Session ${sessionId} not found`);

    const evaluationResult = await aiProvider.evaluateRealtimeInterview({
      role: session.targetRole,
      interviewType: session.interviewType,
      messages: session.messages.map((m) => ({
        speaker: m.speaker as 'AI' | 'CANDIDATE',
        text: m.text,
        topic: m.topic || undefined,
        isFollowUp: m.isFollowUp,
      })),
      integrityEvents: session.events.map((e) => ({
        type: e.type,
        severity: e.severity,
        reason: e.reason,
        createdAt: e.createdAt,
      })),
      warningCount: session.warningCount,
    });

    const evalData = evaluationResult.data;

    // Save evaluation to database
    await prisma.interviewEvaluation.upsert({
      where: { sessionId },
      create: {
        sessionId,
        overallScore: evalData.overallScore,
        technicalScore: evalData.technicalScore,
        problemSolvingScore: evalData.problemSolvingScore,
        communicationScore: evalData.communicationScore,
        confidenceScore: evalData.confidenceScore,
        depthScore: evalData.depthScore,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        technicalGaps: evalData.technicalGaps,
        communicationFeedback: evalData.communicationFeedback,
        recommendedTopics: evalData.recommendedTopics,
        evidenceSummary: evalData.evidenceSummary,
        integritySummary: evalData.integritySummary,
      },
      update: {
        overallScore: evalData.overallScore,
        technicalScore: evalData.technicalScore,
        problemSolvingScore: evalData.problemSolvingScore,
        communicationScore: evalData.communicationScore,
        confidenceScore: evalData.confidenceScore,
        depthScore: evalData.depthScore,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        technicalGaps: evalData.technicalGaps,
        communicationFeedback: evalData.communicationFeedback,
        recommendedTopics: evalData.recommendedTopics,
        evidenceSummary: evalData.evidenceSummary,
        integritySummary: evalData.integritySummary,
      },
    });

    // Update session status to COMPLETED
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: session.status === 'TERMINATED' ? 'TERMINATED' : 'COMPLETED',
        roomState: session.status === 'TERMINATED' ? 'TERMINATED' : 'COMPLETED',
        overallScore: evalData.overallScore,
        strengths: evalData.strengths,
        weaknesses: evalData.weaknesses,
        recommendation: evalData.evidenceSummary.slice(0, 200),
        completedAt: new Date(),
      },
    });

    logger.info('Real-time interview evaluation finalized', {
      sessionId,
      overallScore: evalData.overallScore,
      integrityStatus: evalData.integrityStatus,
    });

    return evalData;
  }
}

export const realtimeAgentService = new RealtimeAgentService();
