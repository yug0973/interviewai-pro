import Razorpay from 'razorpay';
import { env } from './env';

/**
 * Constructed lazily rather than at module load. Razorpay's constructor
 * throws immediately if key_id/key_secret are empty (not just when an API
 * call is made), so eagerly instantiating it at import time would mean
 * merely importing the billing module (e.g. transitively through app.ts)
 * crashes in any environment without real Razorpay keys set - including
 * every test suite that imports createApp(). See jobs/resume-analysis.queue.ts
 * for the same lazy-init pattern applied to BullMQ for the same reason.
 */
let client: Razorpay | undefined;

export function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID ?? '',
      key_secret: env.RAZORPAY_KEY_SECRET ?? '',
    });
  }
  return client;
}