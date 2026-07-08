import { MockAIProvider } from './providers/mock.provider';
import { parseAndValidate, resumeAnalysisSchema, interviewQuestionSchema, answerEvaluationSchema, jobMatchSchema } from './schemas';
import { InstrumentedAIProvider } from './instrumented-provider';
import { FallbackAIProvider } from './fallback-provider';
import { AIProviderError } from './types';

describe('AI Integration Unit Tests', () => {
  const mockProvider = new MockAIProvider();

  describe('MockAIProvider contract tests', () => {
    it('analyzes resume and returns valid schema result', async () => {
      const res = await mockProvider.analyzeResume({ resumeText: 'Senior engineer with Node.js and PostgreSQL experience' });
      expect(res.data.atsScore).toBeGreaterThanOrEqual(0);
      expect(res.data.atsScore).toBeLessThanOrEqual(100);
      expect(res.data.technicalSkills.length).toBeGreaterThan(0);
      expect(res.data.rewriteSuggestions.length).toBeGreaterThan(0);
      expect(() => resumeAnalysisSchema.parse(res.data)).not.toThrow();
    });

    it('generates interview question with category and difficulty', async () => {
      const res = await mockProvider.generateInterviewQuestion({ role: 'Backend Engineer', difficulty: 'hard', topics: ['System Design'] });
      expect(res.data.question).toBeDefined();
      expect(res.data.difficulty).toBe('hard');
      expect(() => interviewQuestionSchema.parse(res.data)).not.toThrow();
    });

    it('evaluates answer with calibrated score and strengths/improvements', async () => {
      const res = await mockProvider.evaluateAnswer({
        question: 'Explain rate limiting',
        answerText: 'I would use Redis with a token bucket algorithm to rate limit per client IP with headers for remaining tokens.',
        role: 'Backend Engineer',
      });
      expect(res.data.score).toBeGreaterThan(50);
      expect(res.data.strengths.length).toBeGreaterThan(0);
      expect(res.data.idealAnswerSummary).toBeDefined();
      expect(() => answerEvaluationSchema.parse(res.data)).not.toThrow();
    });

    it('matches job description and returns matchScore and actionable improvements', async () => {
      const res = await mockProvider.matchJobDescription({
        resumeText: 'Node.js and PostgreSQL backend engineer',
        jobDescriptionText: 'We are looking for a Senior Backend Engineer proficient in Node.js, PostgreSQL, Redis, and Kubernetes.',
      });
      expect(res.data.matchScore).toBeGreaterThan(0);
      expect(res.data.matchingSkills).toContain('Node.js');
      expect(res.data.resumeImprovements.length).toBeGreaterThan(0);
      expect(() => jobMatchSchema.parse(res.data)).not.toThrow();
    });
  });

  describe('parseAndValidate utility', () => {
    it('strips markdown json code fences and parses valid payload', () => {
      const raw = '```json\n{"question": "How does Raft work?", "category": "Distributed Systems", "difficulty": "hard"}\n```';
      const parsed = parseAndValidate(raw, interviewQuestionSchema);
      expect(parsed.question).toBe('How does Raft work?');
      expect(parsed.difficulty).toBe('hard');
    });

    it('throws error when JSON is invalid or does not match schema', () => {
      const raw = '```json\n{"invalidField": true}\n```';
      expect(() => parseAndValidate(raw, interviewQuestionSchema)).toThrow();
    });
  });

  describe('FallbackAIProvider', () => {
    it('falls back to secondary provider when primary fails', async () => {
      const failingPrimary = {
        name: 'failing-primary',
        analyzeResume: jest.fn().mockRejectedValue(new AIProviderError('Quota exceeded', 'failing-primary', 'analyzeResume', true)),
        generateInterviewQuestion: jest.fn(),
        evaluateAnswer: jest.fn(),
        generateFollowUpQuestion: jest.fn(),
        summarizeInterview: jest.fn(),
        generateFeedback: jest.fn(),
        matchJobDescription: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(false),
      };

      const fallback = new FallbackAIProvider(failingPrimary as any, mockProvider);
      const res = await fallback.analyzeResume({ resumeText: 'Test resume text' });

      expect(res.data.atsScore).toBeDefined();
      expect(failingPrimary.analyzeResume).toHaveBeenCalled();
    });
  });
});