import { z } from 'zod';

// Field names match Razorpay Checkout's success-handler response object
// exactly, so the frontend can forward that object to this endpoint as-is.
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>['body'];