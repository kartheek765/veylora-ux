import { db } from '../db/index.js';

export interface PrivacySettings {
  id: string;
  aiAssistanceEnabled: boolean;
  shareFindingsText: boolean;
  shareDomSummaries: boolean;
  shareScreenshots: boolean;
  retainEvidenceDays: number;
  redactSensitiveFields: boolean;
  updatedAt: string;
}

export class PrivacyService {
  /**
   * Get current privacy settings from SQLite
   */
  public static getSettings(): PrivacySettings {
    const row = db.prepare('SELECT * FROM privacy_settings WHERE id = ?').get('default') as any;
    if (!row) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO privacy_settings (id, ai_assistance_enabled, share_findings_text, share_dom_summaries, share_screenshots, retain_evidence_days, redact_sensitive_fields, updated_at)
        VALUES ('default', 1, 1, 1, 0, 30, 1, ?)
      `).run(now);
      return {
        id: 'default',
        aiAssistanceEnabled: true,
        shareFindingsText: true,
        shareDomSummaries: true,
        shareScreenshots: false,
        retainEvidenceDays: 30,
        redactSensitiveFields: true,
        updatedAt: now
      };
    }

    return {
      id: row.id,
      aiAssistanceEnabled: row.ai_assistance_enabled === 1,
      shareFindingsText: row.share_findings_text === 1,
      shareDomSummaries: row.share_dom_summaries === 1,
      shareScreenshots: row.share_screenshots === 1,
      retainEvidenceDays: row.retain_evidence_days,
      redactSensitiveFields: row.redact_sensitive_fields === 1,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update privacy settings
   */
  public static updateSettings(updates: Partial<Omit<PrivacySettings, 'id' | 'updatedAt'>>): PrivacySettings {
    const current = this.getSettings();
    const now = new Date().toISOString();

    const aiAssistanceEnabled = updates.aiAssistanceEnabled !== undefined ? (updates.aiAssistanceEnabled ? 1 : 0) : (current.aiAssistanceEnabled ? 1 : 0);
    const shareFindingsText = updates.shareFindingsText !== undefined ? (updates.shareFindingsText ? 1 : 0) : (current.shareFindingsText ? 1 : 0);
    const shareDomSummaries = updates.shareDomSummaries !== undefined ? (updates.shareDomSummaries ? 1 : 0) : (current.shareDomSummaries ? 1 : 0);
    const shareScreenshots = updates.shareScreenshots !== undefined ? (updates.shareScreenshots ? 1 : 0) : (current.shareScreenshots ? 1 : 0);
    const retainEvidenceDays = updates.retainEvidenceDays !== undefined ? Math.max(1, Math.min(365, updates.retainEvidenceDays)) : current.retainEvidenceDays;
    const redactSensitiveFields = updates.redactSensitiveFields !== undefined ? (updates.redactSensitiveFields ? 1 : 0) : (current.redactSensitiveFields ? 1 : 0);

    db.prepare(`
      UPDATE privacy_settings
      SET ai_assistance_enabled = ?,
          share_findings_text = ?,
          share_dom_summaries = ?,
          share_screenshots = ?,
          retain_evidence_days = ?,
          redact_sensitive_fields = ?,
          updated_at = ?
      WHERE id = 'default'
    `).run(
      aiAssistanceEnabled,
      shareFindingsText,
      shareDomSummaries,
      shareScreenshots,
      retainEvidenceDays,
      redactSensitiveFields,
      now
    );

    return this.getSettings();
  }

  /**
   * Delete specific evidence item with referential integrity checks
   */
  public static deleteEvidence(evidenceId: string): { success: boolean; error?: string } {
    const ev = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as any;
    if (!ev) {
      return { success: false, error: 'Evidence record not found' };
    }

    // Clear reference from findings first
    db.prepare('UPDATE findings SET evidence_id = NULL WHERE evidence_id = ?').run(evidenceId);
    // Clear reference from action_events
    db.prepare('UPDATE action_events SET evidence_id = NULL WHERE evidence_id = ?').run(evidenceId);

    // Delete record
    db.prepare('DELETE FROM evidence WHERE id = ?').run(evidenceId);

    return { success: true };
  }

  /**
   * Clean expired evidence based on retain_evidence_days setting
   */
  public static cleanExpiredEvidence(): { deletedCount: number } {
    const settings = this.getSettings();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.retainEvidenceDays);
    const cutoffIso = cutoffDate.toISOString();

    const expiredRows = db.prepare('SELECT id FROM evidence WHERE timestamp < ?').all(cutoffIso) as any[];
    for (const row of expiredRows) {
      this.deleteEvidence(row.id);
    }

    return { deletedCount: expiredRows.length };
  }
}
