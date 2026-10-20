import { db } from '../db/index.js';
import { config } from '../config.js';

export type ServiceType = 'ux_analysis' | 'ask_veylora';

export interface ActiveModelStage {
  serviceType: ServiceType;
  stage: 1 | 2 | 3 | 'exhausted';
  modelId: string;
  usageInStage: number;
  stageLimit: number;
  windowStartedAt: string;
}

export class ModelUsageService {
  /**
   * Evaluates the active model stage based on rolling 24-hour usage records.
   * Auto-resets windows that have exceeded 24 hours.
   */
  static getActiveStage(serviceType: ServiceType, customNow?: Date): ActiveModelStage {
    const now = customNow || new Date();
    const windowHours = serviceType === 'ux_analysis'
      ? config.geminiDailyWindowHours
      : config.askVeyloraDailyWindowHours;
    const stageLimit = serviceType === 'ux_analysis'
      ? config.geminiDailyRequestLimit
      : config.askVeyloraDailyRequestLimit;

    const stagesConfig = serviceType === 'ux_analysis'
      ? [
          { stage: 1, modelId: config.geminiModel },
          { stage: 2, modelId: config.geminiFallback1 },
          { stage: 3, modelId: config.geminiFallback2 },
        ]
      : [
          { stage: 1, modelId: config.askVeyloraModel },
          { stage: 2, modelId: config.askVeyloraFallback1 },
          { stage: 3, modelId: config.askVeyloraFallback2 },
        ];

    for (const item of stagesConfig) {
      const record = db.prepare(`
        SELECT * FROM model_usage_records WHERE service_type = ? AND stage = ?
      `).get(serviceType, item.stage) as {
        successful_requests: number;
        window_started_at: string;
        last_used_at: string;
      } | undefined;

      if (!record) {
        // Initialize clean record
        db.prepare(`
          INSERT INTO model_usage_records (id, service_type, stage, model_id, successful_requests, window_started_at, last_used_at)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `).run(
          `${serviceType}-stage-${item.stage}`,
          serviceType,
          item.stage,
          item.modelId,
          now.toISOString(),
          now.toISOString()
        );

        return {
          serviceType,
          stage: item.stage as 1 | 2 | 3,
          modelId: item.modelId,
          usageInStage: 0,
          stageLimit,
          windowStartedAt: now.toISOString(),
        };
      }

      // Check rolling 24-hour window expiration
      const windowStart = new Date(record.window_started_at).getTime();
      const elapsedHours = (now.getTime() - windowStart) / (1000 * 60 * 60);

      if (elapsedHours >= windowHours) {
        // Rolling 24-hour window expired: reset counters
        db.prepare(`
          UPDATE model_usage_records 
          SET successful_requests = 0, window_started_at = ?, last_used_at = ?
          WHERE service_type = ? AND stage = ?
        `).run(now.toISOString(), now.toISOString(), serviceType, item.stage);

        return {
          serviceType,
          stage: item.stage as 1 | 2 | 3,
          modelId: item.modelId,
          usageInStage: 0,
          stageLimit,
          windowStartedAt: now.toISOString(),
        };
      }

      // If this stage still has available credits (< stageLimit), return it
      if (record.successful_requests < stageLimit) {
        return {
          serviceType,
          stage: item.stage as 1 | 2 | 3,
          modelId: item.modelId,
          usageInStage: record.successful_requests,
          stageLimit,
          windowStartedAt: record.window_started_at,
        };
      }
    }

    // All 3 stages exhausted for this 24-hour window
    return {
      serviceType,
      stage: 'exhausted',
      modelId: 'local-rule-engine',
      usageInStage: stageLimit,
      stageLimit,
      windowStartedAt: now.toISOString(),
    };
  }

  /**
   * Concurrency-safe atomic recording of a completed successful AI request.
   * Only called AFTER the provider generation succeeds.
   */
  static recordSuccessfulRequest(serviceType: ServiceType, stage: number, customNow?: Date): void {
    const now = (customNow || new Date()).toISOString();
    db.prepare(`
      UPDATE model_usage_records 
      SET successful_requests = successful_requests + 1, last_used_at = ?
      WHERE service_type = ? AND stage = ?
    `).run(now, serviceType, stage);
  }

  /**
   * Resets usage records for testing or maintenance.
   */
  static resetService(serviceType: ServiceType): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE model_usage_records
      SET successful_requests = 0, window_started_at = ?, last_used_at = ?
      WHERE service_type = ?
    `).run(now, now, serviceType);
  }
}
