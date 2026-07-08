import type {
  AIProvider,
  AIResult,
  AnalyzeResumeInput,
  ResumeAnalysisResult,
  GenerateQuestionInput,
  InterviewQuestionResult,
  EvaluateAnswerInput,
  AnswerEvaluationResult,
  FollowUpInput,
  SummarizeInterviewInput,
  InterviewSummaryResult,
  GenerateFeedbackInput,
  FeedbackResult,
  MatchJobDescriptionInput,
  JobMatchResult,
  RealtimeAgentTurnInput,
  RealtimeAgentTurnResult,
  RealtimeEvaluationInput,
  RealtimeEvaluationResult,
} from '../types';

function wrap<T>(data: T): AIResult<T> {
  return {
    data,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    costUsd: 0,
    provider: 'mock',
    model: 'mock-model',
    latencyMs: 1,
  };
}

/**
 * Returns realistic-shaped, deterministic fake data instantly. Used as the
 * default provider (AI_PROVIDER=mock) so the whole app - including every
 * feature that will eventually call a real LLM - runs and is testable with
 * zero API keys and zero cost.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async analyzeResume(input: AnalyzeResumeInput): Promise<AIResult<ResumeAnalysisResult>> {
    return wrap<ResumeAnalysisResult>({
      atsScore: 72,
      summary: 'Solid technical foundation with strong backend fundamentals, but needs quantified impact metrics.',
      detectedRole: input.targetRole ?? 'Backend Engineer',
      experienceLevel: 'mid',
      skills: ['Node.js', 'React', 'PostgreSQL', 'Docker', 'Redis', 'TypeScript', 'REST APIs', 'System Design'],
      technicalSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Kafka', 'Redis', 'AWS'],
      softSkills: ['Communication', 'Team Leadership', 'Cross-functional Collaboration'],
      missingKeywords: input.targetRole ? [`${input.targetRole} distributed systems`, 'CI/CD pipelines', 'Kubernetes'] : ['CI/CD pipelines', 'Kubernetes'],
      certifications: ['AWS Certified Solutions Architect Associate'],
      educationReview: 'Education section is clear and relevant. Good foundation in Computer Science principles.',
      projectReview: 'Projects demonstrate real-world infrastructure experience but lack specific metrics on latency and scale.',
      experienceReview: 'Strong hands-on experience in API development and database optimization; would benefit from measurable business impact figures.',
      grammarIssues: [],
      formattingIssues: ['Minor bullet formatting inconsistencies in project section'],
      strengths: [
        'Clear project descriptions with concrete technology choices',
        'Strong backend stack depth (PostgreSQL, Redis, Kafka, Docker)',
        'Demonstrated understanding of asynchronous architectures',
      ],
      weaknesses: ['Lacks quantified metrics (latency reduction, traffic handled)', 'Action verbs could be more impactful'],
      suggestions: [
        'Add measurable scale figures to each project bullet (e.g. 10k requests/sec, 99.9% uptime)',
        'Highlight database indexing and query optimization achievements explicitly',
        'Incorporate CI/CD pipeline experience in the skills and experience sections',
      ],
      rewriteSuggestions: [
        {
          original: 'Worked on a real-time notification engine using Redis and Node.js.',
          rewritten:
            'Architected a distributed notification pipeline with Redis Pub/Sub and Node.js handling 15,000 msg/sec with sub-50ms latency.',
        },
        {
          original: 'Handled database operations and created PostgreSQL tables.',
          rewritten:
            'Designed PostgreSQL schemas, optimized query plans with composite indexes, and reduced average API latency by 35%.',
        },
      ],
    });
  }

  async generateInterviewQuestion(
    input: GenerateQuestionInput
  ): Promise<AIResult<InterviewQuestionResult>> {
    const focus = input.topics?.[0] || 'System Architecture';
    return wrap<InterviewQuestionResult>({
      question: `How would you design a fault-tolerant caching and rate-limiting tier for a high-traffic ${input.role} service?`,
      category: focus,
      difficulty: input.difficulty,
    });
  }

  async evaluateAnswer(input: EvaluateAnswerInput): Promise<AIResult<AnswerEvaluationResult>> {
    const trimmed = input.answerText.trim();
    if (trimmed.length < 20) {
      return wrap<AnswerEvaluationResult>({
        score: 25,
        strengths: [],
        improvements: [
          'Provide a more detailed answer with specific technical architecture',
          'Explain trade-offs between different caching strategies',
        ],
        idealAnswerSummary: `A comprehensive answer for "${input.question}" should explain token bucket/leaky bucket algorithms, Redis cluster storage, and fallback mechanisms when cache nodes fail.`,
      });
    }

    return wrap<AnswerEvaluationResult>({
      score: 78,
      strengths: [
        'Correctly identified distributed state challenges and token bucket algorithm',
        'Good understanding of Redis as an in-memory coordination layer',
      ],
      improvements: [
        'Elaborate on cache invalidation strategies under network partitions',
        'Discuss client-side vs gateway-level rate limiting trade-offs',
      ],
      idealAnswerSummary: `A strong answer covers algorithm selection (e.g. Sliding Window Counter), centralized in-memory storage via Redis clusters, and graceful degradation headers (Retry-After, X-RateLimit-Remaining).`,
    });
  }

  async generateFollowUpQuestion(
    input: FollowUpInput
  ): Promise<AIResult<InterviewQuestionResult>> {
    return wrap<InterviewQuestionResult>({
      question: `You mentioned using in-memory state for rate limiting - what happens if the Redis cluster suffers a failover during a peak traffic event?`,
      category: 'Resilience & Edge Cases',
      difficulty: 'medium',
    });
  }

  async summarizeInterview(
    input: SummarizeInterviewInput
  ): Promise<AIResult<InterviewSummaryResult>> {
    return wrap<InterviewSummaryResult>({
      overallScore: 78,
      categoryScores: [
        { category: 'Technical Knowledge', score: 82, feedback: 'Strong grasp of core data structures and distributed protocols.' },
        { category: 'Problem Solving', score: 80, feedback: 'Structured approach to breaking down edge cases.' },
        { category: 'Communication', score: 75, feedback: 'Clear responses, could be slightly more structured with STAR format.' },
        { category: 'Depth & Architecture', score: 76, feedback: 'Understands high-level systems; dive deeper into failure modes.' },
        { category: 'Role Knowledge', score: 80, feedback: 'Solid alignment with industry expectations for the target role.' },
      ],
      strengths: [
        'Clear conceptual understanding of scalability and distributed caching',
        'Proactively discusses performance bottlenecks and data isolation',
        'Articulates trade-offs when choosing tools and architectural patterns',
      ],
      weaknesses: [
        'Could explore cascading failure modes more thoroughly',
        'Tendency to gloss over observability and metrics monitoring',
      ],
      recommendation: `Strong Hire - Demonstrates solid mid-to-senior technical competence for a ${input.role} role.`,
      nextRecommendedTopic: 'Distributed Systems Design - Chaos Engineering & Network Partitions',
    });
  }

  async generateFeedback(input: GenerateFeedbackInput): Promise<AIResult<FeedbackResult>> {
    return wrap<FeedbackResult>({
      feedback: `You have strong foundations in core backend architecture. Focus on quantifying project impact and proactively explaining edge cases during technical discussions.`,
      actionItems: input.focusAreas?.length
        ? input.focusAreas.map((area) => `Practice: ${area}`)
        : ['Quantify metrics on projects', 'Practice mock interviews focusing on distributed failovers'],
    });
  }

  async matchJobDescription(input: MatchJobDescriptionInput): Promise<AIResult<JobMatchResult>> {
    return wrap<JobMatchResult>({
      matchScore: 84,
      roleTitle: input.targetRole || 'Senior Backend Engineer',
      experienceLevelMatch: 'Strong fit for Mid/Senior Backend Engineer',
      summary: `The candidate's backend background in Node.js, PostgreSQL, Redis, and distributed systems aligns strongly with the core requirements of this role. Minor gaps exist in Kubernetes orchestration and production Terraform management.`,
      matchingSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'REST APIs', 'System Design'],
      missingSkills: ['Kubernetes / Helm', 'Terraform (IaC)', 'GraphQL'],
      missingKeywords: ['CI/CD Pipeline Automation', 'High Availability SLA', 'Infrastructure as Code'],
      experienceGaps: ['Experience managing multi-region Kubernetes clusters in production', 'Public cloud cost optimization'],
      relevantProjects: [
        'Real-time analytics engine with Kafka and Redis',
        'High-concurrency PostgreSQL data layer optimization',
      ],
      resumeImprovements: [
        {
          what: 'Highlight Docker container orchestration in existing projects',
          why: 'The job description places strong emphasis on containerized deployment workflows.',
          how: 'Add a bullet describing Docker Compose / container lifecycle management in the primary backend project.',
        },
        {
          what: 'Include specific SLA and uptime achievements',
          why: 'The target role requires experience maintaining 99.9% uptime services.',
          how: 'Mention uptime SLA metrics and monitoring strategies used in previous applications.',
        },
      ],
      likelyInterviewQuestions: [
        {
          question: 'How do you design a database schema migration pipeline with zero downtime for high-traffic tables?',
          category: 'Data Engineering & Migrations',
          why: 'The job description requires experience with large-scale relational database maintenance.',
        },
        {
          question: 'Walk us through how you would architect a distributed rate-limiting middleware in a microservices environment.',
          category: 'System Architecture',
          why: 'The role heavily involves building high-throughput public API endpoints.',
        },
      ],
    });
  }

  async realtimeAgentTurn(
    input: RealtimeAgentTurnInput
  ): Promise<AIResult<RealtimeAgentTurnResult>> {
    const isEnding = input.questionsCount >= 8;
    if (isEnding) {
      return wrap<RealtimeAgentTurnResult>({
        aiResponse: `That covers all the core technical topics I wanted to explore today. You've provided great depth on your architecture and decision-making process. Thanks for your time, and I'll submit your evaluation right now.`,
        action: 'CONCLUDE_INTERVIEW',
        topic: 'Wrap Up & Conclusion',
        isFollowUp: false,
        technicalDepth: 8,
        confidenceScore: 9,
        evaluationSnippet: 'Completed all required competency probes with high technical clarity.',
        isInterviewComplete: true,
      });
    }

    if (input.candidateSpeech.toLowerCase().includes('redis') || input.candidateSpeech.toLowerCase().includes('cache')) {
      return wrap<RealtimeAgentTurnResult>({
        aiResponse: `You mentioned using Redis for caching. How did you handle cache invalidation when the underlying database records updated, and what trade-offs did you consider with TTL expiration?`,
        action: 'ASK_FOLLOW_UP',
        topic: 'Distributed Caching & Invalidation',
        isFollowUp: true,
        technicalDepth: 8,
        confidenceScore: 8,
        evaluationSnippet: 'Candidate discussed in-memory storage; probing cache consistency strategy.',
        isInterviewComplete: false,
      });
    }

    if (input.candidateSpeech.toLowerCase().includes('scale') || input.candidateSpeech.toLowerCase().includes('traffic')) {
      return wrap<RealtimeAgentTurnResult>({
        aiResponse: `Interesting. If peak traffic surged by 10x and database connections became saturated, how would you re-architect your data access layer to prevent cascading failures?`,
        action: 'CHALLENGE_ANSWER',
        topic: 'Scalability & Resilience',
        isFollowUp: true,
        technicalDepth: 9,
        confidenceScore: 8,
        evaluationSnippet: 'Challenging on high-concurrency connection pooling and circuit breaking.',
        isInterviewComplete: false,
      });
    }

    return wrap<RealtimeAgentTurnResult>({
      aiResponse: `Makes sense. Let's shift gears to system design. How would you design a scalable background job processing queue that guarantees at-least-once message delivery?`,
      action: 'ASK_NEW_TOPIC',
      topic: 'Asynchronous Processing & Message Queues',
      isFollowUp: false,
      technicalDepth: 7,
      confidenceScore: 8,
      evaluationSnippet: 'Transitioning to message queue processing.',
      isInterviewComplete: false,
    });
  }

  async evaluateRealtimeInterview(
    input: RealtimeEvaluationInput
  ): Promise<AIResult<RealtimeEvaluationResult>> {
    const isTerminated = input.warningCount >= 3;
    return wrap<RealtimeEvaluationResult>({
      overallScore: isTerminated ? 30 : 85,
      technicalScore: isTerminated ? 35 : 88,
      problemSolvingScore: isTerminated ? 30 : 86,
      communicationScore: isTerminated ? 40 : 82,
      confidenceScore: isTerminated ? 35 : 84,
      depthScore: isTerminated ? 30 : 87,
      strengths: [
        'Articulated architectural trade-offs between relational storage and distributed caches clearly',
        'Structured responses with concrete engineering metrics and failure mitigation techniques',
        'Demonstrated strong problem-solving under progressive follow-up scrutiny',
      ],
      weaknesses: [
        'Could dive deeper into observability telemetry and distributed tracing standards (OpenTelemetry)',
        'Brief hesitation when discussing multi-region replication consistency models',
      ],
      technicalGaps: [
        'Distributed Consensus protocols (Raft/Paxos) nuance',
        'Zero-downtime database migration tooling',
      ],
      communicationFeedback:
        'Communicates with high technical clarity and conciseness. Avoids unnecessary filler words and explains architectural trade-offs proactively.',
      recommendedTopics: [
        'Distributed Consensus & Event Sourcing',
        'Database Partitioning and Sharding Patterns',
        'Chaos Engineering and Fault Injection Testing',
      ],
      evidenceSummary:
        'Candidate successfully navigated in-depth technical probes on Redis caching, concurrency management, and async worker queue design with specific implementation examples.',
      integritySummary: isTerminated
        ? 'Interview was terminated due to reaching the maximum allowable integrity warnings (3/3).'
        : input.warningCount > 0
        ? `Interview completed with ${input.warningCount} minor integrity warning(s) logged.`
        : 'Session verified with zero integrity flags or abnormal environment disruptions.',
      integrityStatus: isTerminated ? 'TERMINATED' : input.warningCount > 1 ? 'FLAGGED' : 'PASSED',
    });
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
