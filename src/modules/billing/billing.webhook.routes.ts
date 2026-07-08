import express, { Router } from 'express';
import { billingController } from './billing.controller';

const router = Router();

// Razorpay signs the exact raw request body bytes, so this route must NOT go
// through the app-wide express.json() parser - re-serializing a parsed
// object with JSON.stringify is not guaranteed to reproduce the same bytes,
// which would break signature verification. This router is mounted in
// app.ts BEFORE express.json() specifically so it never gets parsed first.
// Not behind requireAuth either: Razorpay calls this directly, with no user
// session - authenticity here comes entirely from the signature check.
router.post('/', express.raw({ type: 'application/json' }), billingController.webhook);

export { router as billingWebhookRoutes };