import type {
  AnalyzeResumeInput,
  GenerateQuestionInput,
  EvaluateAnswerInput,
  FollowUpInput,
  SummarizeInterviewInput,
  GenerateFeedbackInput,
  MatchJobDescriptionInput,
  RealtimeAgentTurnInput,
  RealtimeEvaluationInput,
} from '../types';

/**
 * Every prompt instructs the model to return ONLY JSON matching a fixed shape.
 * Providers parse that JSON and validate it against a zod schema (see
 * `schemas.ts`) before it's ever handed back to application code.
 */

const JSON_ONLY_INSTRUCTION =
  'Respond with ONLY valid JSON matching the exact shape described. No markdown, no code fences, no commentary before or after the JSON.';

export const prompts = {
  analyzeResume(input: AnalyzeResumeInput): string {
    return `You are an expert technical recruiter and ATS (Applicant Tracking System) specialist.

Analyze the following resume${input.targetRole ? ` for a "${input.targetRole}" role` : ''} and return a JSON object with this exact shape:
{
  "atsScore": number (0-100, how well this resume would score in an automated ATS scan),
  "summary": string (2-3 sentence overall assessment),
  "detectedRole": string (the role this resume is best targeted at, based on its content),
  "experienceLevel": "entry" | "junior" | "mid" | "senior" | "lead",
  "skills": string[] (all skills mentioned or clearly implied, technical and non-technical),
  "technicalSkills": string[] (languages, frameworks, tools, infra),
  "softSkills": string[] (communication, leadership, collaboration, etc.),
  "missingKeywords": string[] (keywords/skills commonly expected for this role that are missing or underrepresented),
  "certifications": string[] (certifications found in the resume; empty array if none),
  "educationReview": string (assessment of the education section - clarity, relevance, gaps),
  "projectReview": string (assessment of the projects section - depth, impact, tech relevance),
  "experienceReview": string (assessment of the work experience section, or a note if there is none),
  "grammarIssues": string[] (specific grammar/spelling/tense problems found; empty array if none),
  "formattingIssues": string[] (specific formatting/layout/ATS-parsing problems found; empty array if none),
  "strengths": string[] (3-6 specific strengths),
  "weaknesses": string[] (3-6 specific weaknesses),
  "suggestions": string[] (3-6 concrete, actionable improvements),
  "rewriteSuggestions": Array<{ "original": string, "rewritten": string }> (2-5 actual weak bullet points from the resume paired with a stronger rewrite)
}

${JSON_ONLY_INSTRUCTION}

RESUME TEXT:
"""
${input.resumeText}
"""`;
  },

  generateInterviewQuestion(input: GenerateQuestionInput): string {
    return `You are conducting a technical interview for a "${input.role}" position.

Generate ONE interview question at "${input.difficulty}" difficulty${
      input.topics?.length ? ` focused on: ${input.topics.join(', ')}` : ''
    }.${
      input.candidateSkills?.length
        ? `\nThe candidate has demonstrated background in: ${input.candidateSkills.join(', ')}. Naturally tailor the question scenario to draw on this background where appropriate without stating it directly.`
        : ''
    }
${
  input.previousQuestions?.length
    ? `Do NOT repeat or closely resemble any of these already-asked questions:\n${input.previousQuestions.map((q) => `- ${q}`).join('\n')}`
    : ''
}

Return a JSON object with this exact shape:
{
  "question": string,
  "category": string (e.g. "System Design", "Algorithms", "Behavioral", "Backend Architecture", "Data Modeling"),
  "difficulty": "easy" | "medium" | "hard"
}

${JSON_ONLY_INSTRUCTION}`;
  },

  evaluateAnswer(input: EvaluateAnswerInput): string {
    return `You are a strict, calibrated technical interviewer evaluating a candidate's answer for a "${input.role}" role.

QUESTION: "${input.question}"

CANDIDATE'S ANSWER:
"""
${input.answerText}
"""

Scoring rubric - apply strictly:
- 0-15: Answer is empty, gibberish, random/unrelated text, a copy of the question, "I don't know", or shows no engagement with what was asked.
- 16-40: Answer attempts the topic but is largely incorrect, vague, or misses the core concept being tested.
- 41-60: Answer shows partial understanding but has significant gaps, errors, or lacks depth/specificity.
- 61-80: Answer is mostly correct and reasonably complete, with only minor gaps or room for more depth.
- 81-100: Answer is accurate, complete, well-reasoned, and demonstrates strong command of the topic.

Return a JSON object with this exact shape:
{
  "score": number (0-100),
  "strengths": string[] (what the answer got right - empty array if none, do not invent false strengths),
  "improvements": string[] (specific, actionable gaps),
  "idealAnswerSummary": string (2-4 sentence summary of what an exemplary answer would cover)
}

${JSON_ONLY_INSTRUCTION}`;
  },

  generateFollowUpQuestion(input: FollowUpInput): string {
    return `You are conducting a technical interview for a "${input.role}" position.

The candidate was asked: "${input.originalQuestion}"
They answered: "${input.candidateAnswer}"
${input.previousScore !== undefined ? `Evaluation score: ${input.previousScore}/100.` : ''}
${input.previousImprovements?.length ? `Identified gaps: ${input.previousImprovements.join(', ')}.` : ''}

Generate ONE natural follow-up question that probes deeper into their answer - either to test depth of understanding, challenge an assumption, or explore an edge case.

Return a JSON object with this exact shape:
{
  "question": string,
  "category": string,
  "difficulty": "easy" | "medium" | "hard"
}

${JSON_ONLY_INSTRUCTION}`;
  },

  summarizeInterview(input: SummarizeInterviewInput): string {
    const transcript = input.qaPairs
      .map(
        (qa, i) =>
          `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}${qa.score !== undefined ? ` (score: ${qa.score}/100)` : ''}`
      )
      .join('\n\n');

    return `You are summarizing a completed technical interview for a "${input.role}" position.

FULL TRANSCRIPT:
"""
${transcript}
"""

Return a JSON object with this exact shape:
{
  "overallScore": number (0-100),
  "categoryScores": [
    { "category": "Technical Knowledge", "score": number (0-100), "feedback": string },
    { "category": "Problem Solving", "score": number (0-100), "feedback": string },
    { "category": "Communication", "score": number (0-100), "feedback": string },
    { "category": "Depth & Architecture", "score": number (0-100), "feedback": string },
    { "category": "Role Knowledge", "score": number (0-100), "feedback": string }
  ],
  "strengths": string[] (3-6 clear patterns of strength),
  "weaknesses": string[] (3-6 clear patterns of weakness/gaps),
  "recommendation": string (honest hiring recommendation, e.g. "Strong Hire", "Hire - needs more depth in X", "Leaning No Hire - gaps in Y"),
  "nextRecommendedTopic": string (e.g. "Distributed Systems Design - Caching & Rate Limiting")
}

${JSON_ONLY_INSTRUCTION}`;
  },

  generateFeedback(input: GenerateFeedbackInput): string {
    return `You are a supportive but honest career coach.

CONTEXT:
"""
${input.context}
"""
${input.focusAreas?.length ? `\nFocus specifically on: ${input.focusAreas.join(', ')}` : ''}

Return a JSON object with this exact shape:
{
  "feedback": string (3-5 sentences, direct and specific),
  "actionItems": string[] (3-5 concrete next steps to act on this week)
}

${JSON_ONLY_INSTRUCTION}`;
  },

  matchJobDescription(input: MatchJobDescriptionInput): string {
    return `You are an expert technical hiring manager and recruitment specialist.

Compare the candidate's resume with the provided job description${input.targetRole ? ` for the "${input.targetRole}" position` : ''}.

JOB DESCRIPTION:
"""
${input.jobDescriptionText}
"""

CANDIDATE RESUME:
"""
${input.resumeText}
"""

Perform a deep match analysis and return a JSON object with this exact shape:
{
  "matchScore": number (0-100, calibrated overall match rating),
  "roleTitle": string (the exact target job title from the JD),
  "experienceLevelMatch": string (e.g. "Strong match for Senior level", "Junior with 2-year experience gap for this Mid/Senior role"),
  "summary": string (3-4 sentence comprehensive match assessment),
  "matchingSkills": string[] (skills found in both resume and JD),
  "missingSkills": string[] (hard requirements in JD not found in resume),
  "missingKeywords": string[] (important keywords/terms in JD missing from resume),
  "experienceGaps": string[] (domain/experience gaps between candidate and requirements),
  "relevantProjects": string[] (candidate projects/experiences that best match this role),
  "resumeImprovements": Array<{
    "what": string (concrete action item),
    "why": string (why this matters specifically for this job description),
    "how": string (specific example or phrasing to incorporate)
  }>,
  "likelyInterviewQuestions": Array<{
    "question": string (likely interview question for this specific JD and candidate background),
    "category": string (e.g. "System Architecture", "Hands-on Coding", "Culture/Leadership"),
    "why": string (why the interviewer will ask this given the candidate's background vs the JD)
  }>
}

${JSON_ONLY_INSTRUCTION}`;
  },

  realtimeAgentTurn(input: RealtimeAgentTurnInput): string {
    const historyText = input.conversationHistory.length
      ? input.conversationHistory
          .map((m) => `${m.speaker === 'AI' ? 'INTERVIEWER (YOU)' : 'CANDIDATE'}: "${m.text}"`)
          .join('\n')
      : '(No prior turns yet - this is the start of the interview)';

    const resumeContext = input.resumeSkills?.length
      ? `Candidate Skills: ${input.resumeSkills.join(', ')}`
      : '';

    return `You are a Principal Software Engineer and Lead Technical Recruiter conducting a live, voice-to-voice video interview for the position of "${input.role}" (${input.difficulty.toUpperCase()} difficulty, ${input.interviewType} focus).

CONTEXT:
${resumeContext ? `${resumeContext}\n` : ''}${input.jobDescription ? `Job Requirements:\n${input.jobDescription}\n` : ''}Questions Asked So Far: ${input.questionsCount}
Current Topic: ${input.currentTopic || 'General Architecture & Background'}

CONVERSATION HISTORY:
${historyText}

LATEST CANDIDATE SPEECH:
"${input.candidateSpeech}"

YOUR INSTRUCTIONS:
1. You are speaking out loud to the candidate via speech synthesis.
2. Keep your spoken response natural, punchy, and conversational (1 to 3 sentences maximum).
3. NEVER sound like a robotic questionnaire (e.g., do NOT say "Thank you for your answer. Question 4 is...").
4. If the candidate mentioned specific architecture, technologies, or trade-offs (e.g., PostgreSQL, Redis, Microservices, Kafka, Caching), PROBE DEEPER into how it works, edge cases, invalidation, or failure recovery.
5. If the candidate was vague or struggled, ask a clarifying or slightly simpler question.
6. If the candidate answered thoroughly and you have gathered enough depth on this topic, transition smoothly to the next core competency.
7. If total questions asked is >= 8 and you have solid evidence across core competencies, you can set action = "CONCLUDE_INTERVIEW", isInterviewComplete = true, and say a warm, professional closing statement.

Return a JSON object with this exact shape:
{
  "aiResponse": string (the exact words you will speak out loud right now),
  "action": "ASK_NEW_TOPIC" | "ASK_FOLLOW_UP" | "CHALLENGE_ANSWER" | "ASK_CLARIFICATION" | "CHANGE_DIFFICULTY" | "CONCLUDE_INTERVIEW",
  "topic": string (the competency domain being explored, e.g. "Distributed Caching", "Data Consistency", "API Design"),
  "isFollowUp": boolean (true if probing previous answer, false if new topic),
  "technicalDepth": number (1-10 rating of candidate's technical depth on this turn),
  "confidenceScore": number (1-10 rating of candidate's clarity and confidence),
  "evaluationSnippet": string (1-2 sentences internal technical assessment of this answer),
  "isInterviewComplete": boolean
}

${JSON_ONLY_INSTRUCTION}`;
  },

  evaluateRealtimeInterview(input: RealtimeEvaluationInput): string {
    const transcript = input.messages
      .map((m, i) => `${i + 1}. [${m.speaker}]: "${m.text}"${m.topic ? ` (${m.topic})` : ''}`)
      .join('\n');

    const integrityEvents = input.integrityEvents.length
      ? input.integrityEvents
          .map((e) => `- ${e.type} [Severity: ${e.severity}]: ${e.reason}`)
          .join('\n')
      : 'No integrity flags detected.';

    return `You are a Senior Engineering Director generating the final hiring evaluation for a candidate interviewed for "${input.role}" (${input.interviewType}).

FULL INTERVIEW TRANSCRIPT:
${transcript}

INTEGRITY & PROCTORING AUDIT:
Total Warnings Issued: ${input.warningCount}/3
Integrity Signals:
${integrityEvents}

Provide a comprehensive, objective assessment based on the actual transcript evidence.

Return a JSON object with this exact shape:
{
  "overallScore": number (0-100, calibrated overall score),
  "technicalScore": number (0-100),
  "problemSolvingScore": number (0-100),
  "communicationScore": number (0-100),
  "confidenceScore": number (0-100),
  "depthScore": number (0-100),
  "strengths": string[] (3-5 concrete technical strengths shown in the interview with direct examples),
  "weaknesses": string[] (2-4 specific areas where answers lacked depth, precision, or correctness),
  "technicalGaps": string[] (specific tools, concepts, or edge-cases candidate struggled with),
  "communicationFeedback": string (detailed analysis of candidate's clarity, conciseness, and articulation),
  "recommendedTopics": string[] (3-5 specific topics the candidate should practice next),
  "evidenceSummary": string (comprehensive summary of interview findings citing specific turns),
  "integritySummary": string (objective summary of proctoring events and test environment adherence),
  "integrityStatus": "PASSED" | "FLAGGED" | "TERMINATED"
}

${JSON_ONLY_INSTRUCTION}`;
  },
};