/**
 * Canonical Verification Statuses (Phase 2: Evidence + Confidence Guard)
 * Distinguishes objectively verified browser facts from AI hypotheses.
 */
export type VerificationStatus =
  | 'VERIFIED'
  | 'STRONGLY_SUPPORTED'
  | 'AI_HYPOTHESIS'
  | 'INCONCLUSIVE_BLOCKED'
  | 'NEEDS_REVIEW'
  | 'NOT_REPRODUCED'
  | 'INVALIDATED'
  | 'BLOCKED';

/**
 * Finding Lifecycle Statuses (Phase 1: UX Regression Memory)
 * Tracks issues across historical audits of the same target website.
 */
export type LifecycleStatus =
  | 'NEW'
  | 'PERSISTENT'
  | 'RESOLVED'
  | 'NO_LONGER_OBSERVED'
  | 'RECURRING'
  | 'MATERIALLY_CHANGED';

/**
 * Journey Execution Outcomes (Phase 3: Real Journey Stress Tester)
 */
export type JourneyOutcome =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'ERROR';

/**
 * Roadmap Task Statuses (Phase 6: Smart Fix Roadmap)
 */
export type TaskStatus =
  | 'OPEN'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'READY_FOR_VERIFICATION'
  | 'VERIFIED_FIXED'
  | 'DEFERRED'
  | 'REJECTED';

/**
 * Prioritization Bands
 */
export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';
export type EffortBand = 'LOW' | 'MEDIUM' | 'HIGH';
