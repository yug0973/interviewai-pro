import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';
import { signAccessToken } from '../../common/utils/jwt';
import { integrityService } from './integrity.service';
import { realtimeAgentService } from './realtime-agent.service';

jest.mock('../../config/prisma', () => ({
  prisma: {
    interviewSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    interviewIntegrityEvent: {
      create: jest.fn(),
    },
    interviewMessage: {
      create: jest.fn(),
    },
    interviewEvaluation: {
      upsert: jest.fn(),
    },
    resume: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    status: 'ready',
  },
}));

jest.mock('../../config/env', () => {
  const actual = jest.requireActual('../../config/env');
  return {
    ...actual,
    env: {
      ...actual.env,
      AI_PROVIDER: 'mock',
    },
  };
});

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const app = createApp();

const USER_ID = 'user-realtime-1';
const accessToken = signAccessToken({ sub: USER_ID, role: 'CANDIDATE' as any });
const authHeader = `Bearer ${accessToken}`;

describe('Realtime Interview Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('REST Endpoints', () => {
    it('rejects unauthenticated requests to create session', async () => {
      const res = await request(app).post('/api/realtime/sessions').send({
        targetRole: 'Senior Backend Engineer',
      });
      expect(res.status).toBe(401);
    });

    it('creates a new realtime interview session', async () => {
      const mockCreated = {
        id: 'session-rt-1',
        userId: USER_ID,
        targetRole: 'Senior Backend Engineer',
        difficulty: 'medium',
        interviewType: 'technical',
        mode: 'REALTIME',
        roomState: 'DEVICE_CHECK',
        status: 'IN_PROGRESS',
        warningCount: 0,
        maxWarnings: 3,
        integrityStatus: 'PASSED',
      };

      (mockedPrisma.interviewSession.create as jest.Mock).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/realtime/sessions')
        .set('Authorization', authHeader)
        .send({
          targetRole: 'Senior Backend Engineer',
          interviewType: 'technical',
          difficulty: 'medium',
        });

      expect(res.status).toBe(201);
      expect(res.body.session.id).toBe('session-rt-1');
      expect(res.body.wsPath).toBe('/api/realtime/interview');
    });

    it('fetches session state with messages and proctoring audit', async () => {
      const mockSession = {
        id: 'session-rt-1',
        userId: USER_ID,
        targetRole: 'Senior Backend Engineer',
        status: 'IN_PROGRESS',
        warningCount: 1,
        messages: [
          { id: 'm1', speaker: 'AI', text: 'Hi! Tell me about your project.', order: 1 },
        ],
        events: [
          { id: 'e1', type: 'TAB_SWITCH', severity: 'HIGH', reason: 'Switched tabs' },
        ],
        evaluation: null,
      };

      (mockedPrisma.interviewSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

      const res = await request(app)
        .get('/api/realtime/sessions/session-rt-1')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.session.messages.length).toBe(1);
      expect(res.body.session.events.length).toBe(1);
    });
  });

  describe('Integrity Service (3-Warning Enforcement)', () => {
    it('issues warning 1 on tab switch', async () => {
      (mockedPrisma.interviewSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        status: 'IN_PROGRESS',
        warningCount: 0,
        maxWarnings: 3,
      });

      (mockedPrisma.interviewIntegrityEvent.create as jest.Mock).mockResolvedValue({});
      (mockedPrisma.interviewSession.update as jest.Mock).mockResolvedValue({});

      const result = await integrityService.processIntegrityEvent('session-1', 'TAB_SWITCH');

      expect(result.warningIssued).toBe(true);
      expect(result.warningNumber).toBe(1);
      expect(result.remainingWarnings).toBe(2);
      expect(result.terminated).toBe(false);
      expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ warningCount: 1, integrityStatus: 'FLAGGED' }),
        })
      );
    });

    it('terminates interview on 3rd warning strike', async () => {
      (mockedPrisma.interviewSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        status: 'IN_PROGRESS',
        warningCount: 2,
        maxWarnings: 3,
      });

      (mockedPrisma.interviewIntegrityEvent.create as jest.Mock).mockResolvedValue({});
      (mockedPrisma.interviewSession.update as jest.Mock).mockResolvedValue({});

      const result = await integrityService.processIntegrityEvent('session-1', 'WINDOW_BLUR');

      expect(result.warningIssued).toBe(true);
      expect(result.warningNumber).toBe(3);
      expect(result.remainingWarnings).toBe(0);
      expect(result.terminated).toBe(true);
      expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warningCount: 3,
            integrityStatus: 'TERMINATED',
            status: 'TERMINATED',
            roomState: 'TERMINATED',
          }),
        })
      );
    });
  });

  describe('Realtime Agent Service', () => {
    it('generates personalized initial greeting on device ready', async () => {
      (mockedPrisma.interviewSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        targetRole: 'Backend Engineer',
        user: { name: 'Alex' },
        resume: {
          analysis: { technicalSkills: ['Node.js', 'PostgreSQL', 'Redis'] },
        },
      });

      (mockedPrisma.interviewMessage.create as jest.Mock).mockResolvedValue({
        id: 'm1',
        order: 1,
      });

      (mockedPrisma.interviewSession.update as jest.Mock).mockResolvedValue({});

      const greeting = await realtimeAgentService.getInitialGreeting('session-1');

      expect(greeting.text).toContain('Hi Alex');
      expect(greeting.text).toContain('Backend Engineer');
      expect(greeting.order).toBe(1);
    });

    it('processes candidate speech turn and returns AI follow-up response', async () => {
      (mockedPrisma.interviewSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        targetRole: 'Backend Engineer',
        difficulty: 'medium',
        interviewType: 'technical',
        maxQuestions: 10,
        resume: null,
        messages: [
          { id: 'm1', speaker: 'AI', text: 'Tell me about your project.', order: 1, isFollowUp: false },
        ],
      });

      (mockedPrisma.interviewMessage.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'm2', order: 2 })
        .mockResolvedValueOnce({ id: 'm3', order: 3 });

      const turn = await realtimeAgentService.processCandidateSpeech(
        'session-1',
        'I designed a distributed cache using Redis and PostgreSQL.'
      );

      expect(turn.aiResponse).toBeTruthy();
      expect(turn.order).toBe(3);
      expect(turn.action).toBe('ASK_FOLLOW_UP');
      expect(turn.topic).toContain('Caching');
      expect(turn.isInterviewComplete).toBe(false);
    });
  });
});
