import { prisma } from '../../config/prisma';
import { logger } from '../../common/logger';

export type IntegrityEventType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'SCREEN_SHARE_STOPPED'
  | 'CAMERA_DISABLED'
  | 'MICROPHONE_DISABLED'
  | 'FULLSCREEN_EXIT'
  | 'FACE_NOT_DETECTED'
  | 'MULTIPLE_FACES';

export type IntegritySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IntegrityRecordResult {
  warningIssued: boolean;
  warningNumber: number;
  maxWarnings: number;
  remainingWarnings: number;
  terminated: boolean;
  reason: string;
  severity: IntegritySeverity;
}

export class IntegrityService {
  /**
   * Evaluates and records an integrity signal for a session.
   * High-severity signals (tab switch, window blur, screen share stop, fullscreen exit)
   * trigger an authoritative backend warning. The 3rd warning terminates the interview.
   */
  async processIntegrityEvent(
    sessionId: string,
    type: IntegrityEventType,
    metadata?: Record<string, unknown>
  ): Promise<IntegrityRecordResult> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        warningCount: true,
        maxWarnings: true,
      },
    });

    if (!session) {
      throw new Error(`Interview session ${sessionId} not found`);
    }

    // Determine severity and reason
    let severity: IntegritySeverity = 'MEDIUM';
    let reason = 'Proctoring signal detected';
    let isWarningEligible = false;

    switch (type) {
      case 'TAB_SWITCH':
        severity = 'HIGH';
        reason = 'Candidate switched browser tabs or minimized the interview window.';
        isWarningEligible = true;
        break;
      case 'WINDOW_BLUR':
        severity = 'HIGH';
        reason = 'Interview window lost active focus.';
        isWarningEligible = true;
        break;
      case 'SCREEN_SHARE_STOPPED':
        severity = 'HIGH';
        reason = 'Mandatory screen sharing was disconnected or stopped.';
        isWarningEligible = true;
        break;
      case 'FULLSCREEN_EXIT':
        severity = 'MEDIUM';
        reason = 'Candidate exited fullscreen mode during the interview.';
        isWarningEligible = true;
        break;
      case 'CAMERA_DISABLED':
        severity = 'MEDIUM';
        reason = 'Video stream was paused or camera access was revoked.';
        isWarningEligible = false;
        break;
      case 'MICROPHONE_DISABLED':
        severity = 'LOW';
        reason = 'Microphone was temporarily muted or disconnected.';
        isWarningEligible = false;
        break;
      case 'FACE_NOT_DETECTED':
        severity = 'LOW';
        reason = 'Candidate face not detected in camera frame for an extended period.';
        isWarningEligible = false;
        break;
      case 'MULTIPLE_FACES':
        severity = 'MEDIUM';
        reason = 'Multiple individuals detected in candidate video frame.';
        isWarningEligible = false;
        break;
    }

    // Log the event in database
    await prisma.interviewIntegrityEvent.create({
      data: {
        sessionId,
        type,
        severity,
        reason,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });

    let newWarningCount = session.warningCount;
    let shouldTerminate = false;

    if (isWarningEligible && session.status === 'IN_PROGRESS') {
      newWarningCount += 1;
      shouldTerminate = newWarningCount >= session.maxWarnings;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          warningCount: newWarningCount,
          integrityStatus: shouldTerminate ? 'TERMINATED' : 'FLAGGED',
          status: shouldTerminate ? 'TERMINATED' : session.status,
          roomState: shouldTerminate ? 'TERMINATED' : undefined,
          terminationReason: shouldTerminate
            ? `Interview terminated: Maximum allowable integrity warnings (${session.maxWarnings}/${session.maxWarnings}) reached.`
            : undefined,
          completedAt: shouldTerminate ? new Date() : undefined,
        },
      });

      logger.warn('Integrity warning issued for session', {
        sessionId,
        type,
        warningNumber: newWarningCount,
        maxWarnings: session.maxWarnings,
        terminated: shouldTerminate,
      });
    }

    return {
      warningIssued: isWarningEligible,
      warningNumber: newWarningCount,
      maxWarnings: session.maxWarnings,
      remainingWarnings: Math.max(0, session.maxWarnings - newWarningCount),
      terminated: shouldTerminate,
      reason,
      severity,
    };
  }
}

export const integrityService = new IntegrityService();
