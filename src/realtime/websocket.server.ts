import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../common/logger';
import { realtimeAgentService } from '../modules/realtime/realtime-agent.service';
import { integrityService, type IntegrityEventType } from '../modules/realtime/integrity.service';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
  // Idempotency guard for candidate:speech_final — see handler below.
  lastFinalCorrelationId?: string;
}

interface ClientMessage {
  type:
  | 'candidate:device_ready'
  | 'candidate:speech_partial'
  | 'candidate:speech_final'
  | 'candidate:interrupt'
  | 'candidate:integrity_event'
  | 'ping';
  text?: string;
  eventType?: IntegrityEventType;
  metadata?: Record<string, unknown>;
  /** Client-generated id used to de-duplicate retried/resent messages after a reconnect. */
  correlationId?: string;
}

export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/realtime/interview',
  });

  logger.info('Real-time Interview WebSocket gateway initialized on /api/realtime/interview');

  // Heartbeat interval to drop dead connections (protocol-level ping/pong —
  // separate from, and unrelated to, the app-level {type:'ping'} message below).
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedSocket;
      if (client.isAlive === false) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', async (ws: AuthenticatedSocket, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    try {
      // 1. Authenticate connection via query params (?token=...&sessionId=...)
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      const sessionId = url.searchParams.get('sessionId');

      if (!token || !sessionId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication token and sessionId are required' }));
        ws.close(4001, 'Unauthorized');
        return;
      }

      let payload: { sub: string };
      try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired access token' }));
        ws.close(4001, 'Invalid token');
        return;
      }

      // 2. Validate session and ownership
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          userId: true,
          status: true,
          warningCount: true,
          maxWarnings: true,
        },
      });

      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Interview session not found' }));
        ws.close(4004, 'Session not found');
        return;
      }

      if (session.userId !== payload.sub) {
        ws.send(JSON.stringify({ type: 'error', message: 'Access forbidden: session belongs to another candidate' }));
        ws.close(4003, 'Forbidden');
        return;
      }

      if (session.status === 'COMPLETED' || session.status === 'TERMINATED') {
        ws.send(JSON.stringify({ type: 'error', message: `Interview session is already ${session.status.toLowerCase()}` }));
        ws.close(4000, `Session already ${session.status}`);
        return;
      }

      ws.userId = payload.sub;
      ws.sessionId = sessionId;

      logger.info('Candidate connected to real-time interview room', {
        userId: ws.userId,
        sessionId: ws.sessionId,
      });

      // Send connection acknowledgment
      ws.send(
        JSON.stringify({
          type: 'server:ready',
          sessionId: ws.sessionId,
          warningCount: session.warningCount,
          maxWarnings: session.maxWarnings,
        })
      );

      // Handle incoming candidate messages
      ws.on('message', async (data) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());

          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (msg.type === 'candidate:device_ready') {
            // Idempotency: a reconnect (page refresh, remount after a
            // transient network drop, etc.) must not re-run the greeting
            // and insert a SECOND `order: 1` AI message. Check for an
            // existing opening turn first and replay it instead of
            // regenerating one.
            const existingGreeting = await prisma.interviewMessage.findFirst({
              where: { sessionId, order: 1 },
            });

            if (existingGreeting) {
              ws.send(JSON.stringify({ type: 'ai:state', state: 'SPEAKING' }));
              ws.send(
                JSON.stringify({
                  type: 'ai:speech_start',
                  text: existingGreeting.text,
                  topic: existingGreeting.topic,
                  order: existingGreeting.order,
                  action: 'ASK_NEW_TOPIC',
                  isFollowUp: false,
                  resumed: true,
                })
              );
              return;
            }

            ws.send(JSON.stringify({ type: 'ai:state', state: 'THINKING' }));
            const greeting = await realtimeAgentService.getInitialGreeting(sessionId);

            ws.send(JSON.stringify({ type: 'ai:state', state: 'SPEAKING' }));
            ws.send(
              JSON.stringify({
                type: 'ai:speech_start',
                text: greeting.text,
                topic: greeting.topic,
                order: greeting.order,
                action: 'ASK_NEW_TOPIC',
                isFollowUp: false,
              })
            );
            return;
          }

          if (msg.type === 'candidate:interrupt') {
            // Candidate spoke while AI was speaking - immediately drop AI speech
            logger.info('Candidate interrupted AI speech', { sessionId });
            ws.send(JSON.stringify({ type: 'ai:state', state: 'LISTENING' }));
            return;
          }

          if (msg.type === 'candidate:speech_partial') {
            // Live stream transcript event
            ws.send(JSON.stringify({ type: 'candidate:speech_echo', text: msg.text }));
            return;
          }

          if (msg.type === 'candidate:speech_final') {
            const trimmedText = msg.text?.trim();

            if (!trimmedText || trimmedText.length < 2) {
              ws.send(JSON.stringify({ type: 'error', message: 'Answer was too short to submit.' }));
              return;
            }

            // Idempotency: the client resends its last unacknowledged
            // candidate:speech_final (same correlationId) after a
            // reconnect, in case the original send never reached us — or
            // did reach us but the response was lost on the way back. If
            // we've already processed this exact correlationId on this
            // connection, drop the duplicate instead of re-running the AI
            // turn and inserting duplicate candidate/AI messages.
            if (msg.correlationId && msg.correlationId === ws.lastFinalCorrelationId) {
              logger.info('Ignored duplicate candidate:speech_final', { sessionId, correlationId: msg.correlationId });
              return;
            }
            if (msg.correlationId) ws.lastFinalCorrelationId = msg.correlationId;

            // Candidate finished speaking an answer turn
            ws.send(JSON.stringify({ type: 'ai:state', state: 'THINKING' }));

            const result = await realtimeAgentService.processCandidateSpeech(sessionId, trimmedText);

            if (result.isInterviewComplete) {
              ws.send(JSON.stringify({ type: 'ai:state', state: 'SPEAKING' }));
              ws.send(
                JSON.stringify({
                  type: 'ai:speech_start',
                  text: result.aiResponse,
                  topic: result.topic,
                  order: result.order,
                  action: result.action,
                  isFollowUp: false,
                  isInterviewComplete: true,
                })
              );
              ws.send(
                JSON.stringify({
                  type: 'interview:completed',
                  sessionId,
                })
              );
            } else {
              ws.send(JSON.stringify({ type: 'ai:state', state: 'SPEAKING' }));
              ws.send(
                JSON.stringify({
                  type: 'ai:speech_start',
                  text: result.aiResponse,
                  topic: result.topic,
                  order: result.order,
                  action: result.action,
                  isFollowUp: result.isFollowUp,
                  isInterviewComplete: false,
                  latency: result.latency,
                })
              );
            }
            return;
          }

          if (msg.type === 'candidate:integrity_event' && msg.eventType) {
            const integrityResult = await integrityService.processIntegrityEvent(
              sessionId,
              msg.eventType,
              msg.metadata
            );

            if (integrityResult.warningIssued) {
              ws.send(
                JSON.stringify({
                  type: 'integrity:warning',
                  warningNumber: integrityResult.warningNumber,
                  maxWarnings: integrityResult.maxWarnings,
                  remainingWarnings: integrityResult.remainingWarnings,
                  reason: integrityResult.reason,
                  severity: integrityResult.severity,
                  terminated: integrityResult.terminated,
                })
              );

              if (integrityResult.terminated) {
                ws.send(
                  JSON.stringify({
                    type: 'interview:terminated',
                    reason: integrityResult.reason,
                    warningCount: integrityResult.warningNumber,
                  })
                );
                ws.close(4008, 'Terminated by proctoring policy');
              }
            }
            return;
          }
        } catch (msgErr) {
          logger.error('Error handling WebSocket message', {
            sessionId,
            error: msgErr instanceof Error ? msgErr.message : String(msgErr),
          });
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Failed to process message',
            })
          );
        }
      });

      ws.on('close', (code, reason) => {
        logger.info('Candidate disconnected from real-time interview', {
          userId: ws.userId,
          sessionId: ws.sessionId,
          code,
          reason: reason.toString(),
        });
      });
    } catch (err) {
      logger.error('Unhandled WebSocket connection error', {
        error: err instanceof Error ? err.message : String(err),
      });
      ws.close(1011, 'Internal server error');
    }
  });

  return wss;
}