import { db } from '../db/index.js';
import { VerificationStatus, LifecycleStatus, TaskStatus } from '../types/canonical.js';

export interface FixTask {
  id: string;
  projectId: string;
  title: string;
  rootCauseGroup: string;
  recommendedAction: string;
  severity: string;
  confidence: string;
  priorityScore: number;
  priorityTier: 'P0' | 'P1' | 'P2' | 'P3';
  priorityRationale: string;
  effortBand: 'xs' | 's' | 'm' | 'l';
  status: 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'READY_FOR_VERIFICATION' | 'VERIFIED_FIXED' | 'DEFERRED' | 'REJECTED';
  dependencies: string[];
  associatedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export class RoadmapService {
  /**
   * Calculate transparent priority score and explanation
   * Formula:
   * Score = (Severity * 4) + (Confidence * 2.5) + (RecurrenceBonus * 2) + (DomainBonus * 2.5) - (Effort * 1.5)
   */
  public static calculatePriority(
    severity: string,
    confidence: string,
    lifecycleStatus: string = 'NEW',
    category: string = 'usability',
    effortBand: 'xs' | 's' | 'm' | 'l' = 's'
  ): { score: number; tier: 'P0' | 'P1' | 'P2' | 'P3'; rationale: string } {
    // Severity weight (1 - 4)
    let sevWeight = 2; // moderate default
    const sevLower = severity.toLowerCase();
    if (sevLower === 'critical') sevWeight = 4;
    else if (sevLower === 'serious') sevWeight = 3;
    else if (sevLower === 'moderate') sevWeight = 2;
    else if (sevLower === 'minor') sevWeight = 1;

    // Confidence weight (1 - 3)
    let confWeight = 2;
    const confLower = confidence.toLowerCase();
    if (confLower === 'verified' || confLower === 'high') confWeight = 3;
    else if (confLower === 'medium' || confLower === 'ai_hypothesis') confWeight = 2;
    else confWeight = 1;

    // Recurrence Bonus (0 - 2)
    let recurrenceBonus = 0;
    if (lifecycleStatus === 'RECURRING') recurrenceBonus = 2;
    else if (lifecycleStatus === 'PERSISTENT') recurrenceBonus = 1;

    // Domain / Compliance Bonus (A11y or Security)
    let domainBonus = 0;
    const catLower = category.toLowerCase();
    if (catLower.includes('access') || catLower.includes('a11y') || catLower.includes('security')) {
      domainBonus = 2;
    }

    // Effort penalty (1 - 4)
    let effortVal = 2;
    if (effortBand === 'xs') effortVal = 1;
    else if (effortBand === 's') effortVal = 2;
    else if (effortBand === 'm') effortVal = 3;
    else if (effortBand === 'l') effortVal = 4;

    const rawScore =
      (sevWeight * 4.0) +
      (confWeight * 2.5) +
      (recurrenceBonus * 2.0) +
      (domainBonus * 2.5) -
      (effortVal * 1.5);

    const score = Math.round(rawScore * 10) / 10;

    let tier: 'P0' | 'P1' | 'P2' | 'P3' = 'P2';
    if (score >= 20) tier = 'P0';
    else if (score >= 14) tier = 'P1';
    else if (score >= 8) tier = 'P2';
    else tier = 'P3';

    const reasons: string[] = [];
    reasons.push(`Severity weight: ${sevWeight}/4 (+${sevWeight * 4} pts)`);
    reasons.push(`Verification confidence: ${confWeight}/3 (+${confWeight * 2.5} pts)`);
    if (recurrenceBonus > 0) {
      reasons.push(`Lifecycle penalty (${lifecycleStatus}): +${recurrenceBonus * 2} pts`);
    }
    if (domainBonus > 0) {
      reasons.push(`Domain bonus (${category}): +${domainBonus * 2.5} pts`);
    }
    reasons.push(`Effort discount (${effortBand}): -${effortVal * 1.5} pts`);

    const rationale = `Tier ${tier} (Score ${score}). Calculated from: ${reasons.join(', ')}.`;

    return { score, tier, rationale };
  }

  /**
   * Generates or refreshes roadmap fix tasks from findings for a project
   */
  public static generateRoadmapForProject(projectId: string): FixTask[] {
    const findings = db.prepare(`
      SELECT * FROM findings 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `).all(projectId) as any[];

    if (!findings || findings.length === 0) {
      return [];
    }

    // Conservative grouping by:
    // 1. rule_id if present (e.g., axe-core violation rule)
    // 2. OR (category + page_url + selector_summary)
    const groups = new Map<string, any[]>();

    for (const f of findings) {
      // Don't create open tasks for findings marked 'resolved' or 'INVALIDATED'
      if (f.status === 'resolved' || f.verification_status === 'INVALIDATED') {
        continue;
      }

      let groupKey = '';
      if (f.rule_id) {
        groupKey = `rule:${f.rule_id}:${f.page_url || ''}`;
      } else if (f.selector_summary && f.selector_summary.trim() !== '') {
        groupKey = `selector:${f.category}:${f.selector_summary}:${f.page_url || ''}`;
      } else {
        groupKey = `finding:${f.id}`;
      }

      const existing = groups.get(groupKey) || [];
      existing.push(f);
      groups.set(groupKey, existing);
    }

    const now = new Date().toISOString();
    const createdTasks: FixTask[] = [];

    // Query existing fix tasks for this project
    const existingTasks = db.prepare('SELECT * FROM fix_tasks WHERE project_id = ?').all(projectId) as any[];
    const existingGroupMap = new Map<string, any>();
    for (const t of existingTasks) {
      if (t.root_cause_group) {
        existingGroupMap.set(t.root_cause_group, t);
      }
    }

    for (const [groupKey, groupFindings] of groups.entries()) {
      // Sort findings by severity priority
      const leadFinding = groupFindings[0];
      const allFindingIds = groupFindings.map(f => f.id);

      // Estimate effort band
      let effortBand: 'xs' | 's' | 'm' | 'l' = 's';
      const catLower = (leadFinding.category || '').toLowerCase();
      if (catLower.includes('contrast') || catLower.includes('alt') || catLower.includes('label')) {
        effortBand = 'xs';
      } else if (catLower.includes('keyboard') || catLower.includes('focus') || catLower.includes('flow')) {
        effortBand = 's';
      } else if (catLower.includes('nav') || catLower.includes('form') || catLower.includes('state')) {
        effortBand = 'm';
      }

      const { score, tier, rationale } = this.calculatePriority(
        leadFinding.severity,
        leadFinding.verification_status || leadFinding.confidence,
        leadFinding.lifecycle_status || 'NEW',
        leadFinding.category,
        effortBand
      );

      const rootCauseName = leadFinding.rule_id 
        ? `WCAG Rule [${leadFinding.rule_id}] violation` 
        : leadFinding.title;

      const title = groupFindings.length > 1
        ? `Fix ${rootCauseName} (${groupFindings.length} occurrences)`
        : `Fix ${rootCauseName}`;

      const existingTask = existingGroupMap.get(groupKey);

      if (existingTask) {
        // Update associated finding IDs and score while preserving status
        db.prepare(`
          UPDATE fix_tasks 
          SET associated_finding_ids = ?, priority_score = ?, priority_tier = ?, priority_rationale = ?, updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(allFindingIds),
          score,
          tier,
          rationale,
          now,
          existingTask.id
        );

        createdTasks.push({
          id: existingTask.id,
          projectId,
          title: existingTask.title,
          rootCauseGroup: groupKey,
          recommendedAction: existingTask.recommended_action,
          severity: existingTask.severity,
          confidence: existingTask.confidence,
          priorityScore: score,
          priorityTier: tier,
          priorityRationale: rationale,
          effortBand: existingTask.effort_band as any,
          status: existingTask.status,
          dependencies: JSON.parse(existingTask.dependencies || '[]'),
          associatedFindingIds: allFindingIds,
          createdAt: existingTask.created_at,
          updatedAt: now
        });
      } else {
        const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        db.prepare(`
          INSERT INTO fix_tasks (
            id, project_id, title, root_cause_group, recommended_action,
            severity, confidence, priority_score, priority_tier, priority_rationale,
            effort_band, status, dependencies, associated_finding_ids, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', '[]', ?, ?, ?)
        `).run(
          taskId,
          projectId,
          title,
          groupKey,
          leadFinding.recommended_action || 'Inspect evidence and implement proposed code fix.',
          leadFinding.severity,
          leadFinding.verification_status || leadFinding.confidence,
          score,
          tier,
          rationale,
          effortBand,
          JSON.stringify(allFindingIds),
          now,
          now
        );

        createdTasks.push({
          id: taskId,
          projectId,
          title,
          rootCauseGroup: groupKey,
          recommendedAction: leadFinding.recommended_action || 'Inspect evidence and implement proposed code fix.',
          severity: leadFinding.severity,
          confidence: leadFinding.verification_status || leadFinding.confidence,
          priorityScore: score,
          priorityTier: tier,
          priorityRationale: rationale,
          effortBand,
          status: 'OPEN',
          dependencies: [],
          associatedFindingIds: allFindingIds,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Sort by priority score descending
    return createdTasks.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * List fix tasks with optional project filtering
   */
  public static getTasks(projectId?: string): FixTask[] {
    let rows: any[];
    if (projectId) {
      rows = db.prepare('SELECT * FROM fix_tasks WHERE project_id = ? ORDER BY priority_score DESC').all(projectId);
    } else {
      rows = db.prepare('SELECT * FROM fix_tasks ORDER BY priority_score DESC').all();
    }

    return rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      rootCauseGroup: r.root_cause_group,
      recommendedAction: r.recommended_action,
      severity: r.severity,
      confidence: r.confidence,
      priorityScore: r.priority_score,
      priorityTier: r.priority_tier,
      priorityRationale: r.priority_rationale,
      effortBand: r.effort_band,
      status: r.status,
      dependencies: JSON.parse(r.dependencies || '[]'),
      associatedFindingIds: JSON.parse(r.associated_finding_ids || '[]'),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * Update task status
   */
  public static updateTask(taskId: string, updates: {
    status?: 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'READY_FOR_VERIFICATION' | 'VERIFIED_FIXED' | 'DEFERRED' | 'REJECTED';
    effortBand?: 'xs' | 's' | 'm' | 'l';
    dependencies?: string[];
  }): FixTask | null {
    const existing = db.prepare('SELECT * FROM fix_tasks WHERE id = ?').get(taskId) as any;
    if (!existing) return null;

    const now = new Date().toISOString();
    const newStatus = updates.status || existing.status;
    const newEffort = updates.effortBand || existing.effort_band;
    const newDeps = updates.dependencies !== undefined ? JSON.stringify(updates.dependencies) : existing.dependencies;

    db.prepare(`
      UPDATE fix_tasks 
      SET status = ?, effort_band = ?, dependencies = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, newEffort, newDeps, now, taskId);

    // If marked VERIFIED_FIXED, we can update associated findings lifecycle_status to 'RESOLVED'
    if (newStatus === 'VERIFIED_FIXED') {
      try {
        const findingIds: string[] = JSON.parse(existing.associated_finding_ids || '[]');
        for (const fid of findingIds) {
          db.prepare(`
            UPDATE findings 
            SET status = 'resolved', lifecycle_status = 'RESOLVED', resolved_at = ?
            WHERE id = ?
          `).run(now, fid);
        }
      } catch (err) {
        console.error('Error updating associated findings on fix verification:', err);
      }
    }

    return this.getTaskById(taskId);
  }

  public static getTaskById(taskId: string): FixTask | null {
    const r = db.prepare('SELECT * FROM fix_tasks WHERE id = ?').get(taskId) as any;
    if (!r) return null;
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      rootCauseGroup: r.root_cause_group,
      recommendedAction: r.recommended_action,
      severity: r.severity,
      confidence: r.confidence,
      priorityScore: r.priority_score,
      priorityTier: r.priority_tier,
      priorityRationale: r.priority_rationale,
      effortBand: r.effort_band,
      status: r.status,
      dependencies: JSON.parse(r.dependencies || '[]'),
      associatedFindingIds: JSON.parse(r.associated_finding_ids || '[]'),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}
