import { db } from '../db/index.js';
import { PlaywrightRunnerService } from './playwrightRunnerService.js';
import { RoadmapService } from './roadmapService.js';
import { RegressionMemoryService } from './regressionMemoryService.js';
import { SSRFProtectionService } from './ssrfProtectionService.js';

export type AssistantActionType =
  | 'GET_AUDIT_SUMMARY'
  | 'GET_FINDING_EVIDENCE'
  | 'COMPARE_AUDITS'
  | 'GET_JOURNEY_RESULTS'
  | 'GET_ACCESSIBILITY_RESULTS'
  | 'GET_ROADMAP'
  | 'PROPOSE_JOURNEY_RUN'
  | 'REQUEST_RETEST';

export interface ProposedAction {
  actionType: AssistantActionType;
  params: Record<string, any>;
  description: string;
  requiresConfirmation: boolean;
  isSafe: boolean;
  warnings?: string[];
}

export interface ActionResult {
  success: boolean;
  actionType: AssistantActionType;
  data?: any;
  error?: string;
  jobId?: string;
}

export class AssistantActionService {
  private static readonly ALLOWED_ACTIONS: Set<AssistantActionType> = new Set([
    'GET_AUDIT_SUMMARY',
    'GET_FINDING_EVIDENCE',
    'COMPARE_AUDITS',
    'GET_JOURNEY_RESULTS',
    'GET_ACCESSIBILITY_RESULTS',
    'GET_ROADMAP',
    'PROPOSE_JOURNEY_RUN',
    'REQUEST_RETEST'
  ]);

  /**
   * Validate a proposed action against strict allowlists and safety policies
   */
  public static validateAction(actionType: string, params: Record<string, any>): {
    valid: boolean;
    error?: string;
    proposedAction?: ProposedAction;
  } {
    if (!this.ALLOWED_ACTIONS.has(actionType as AssistantActionType)) {
      return {
        valid: false,
        error: `Action "${actionType}" is not on the authorized allowlist. Arbitrary code, SQL, or commands are strictly prohibited.`
      };
    }

    const type = actionType as AssistantActionType;
    let description = '';
    let requiresConfirmation = false;
    const warnings: string[] = [];

    switch (type) {
      case 'GET_AUDIT_SUMMARY':
        if (!params.runId) return { valid: false, error: 'runId is required for GET_AUDIT_SUMMARY' };
        description = `Inspect audit metrics and execution summary for run ${params.runId}`;
        break;

      case 'GET_FINDING_EVIDENCE':
        if (!params.findingId) return { valid: false, error: 'findingId is required for GET_FINDING_EVIDENCE' };
        description = `Retrieve verified evidence artifacts for finding ${params.findingId}`;
        break;

      case 'COMPARE_AUDITS':
        if (!params.baselineRunId || !params.currentRunId) {
          return { valid: false, error: 'baselineRunId and currentRunId are required for COMPARE_AUDITS' };
        }
        description = `Run regression comparison between baseline ${params.baselineRunId} and current ${params.currentRunId}`;
        break;

      case 'GET_JOURNEY_RESULTS':
        if (!params.runId) return { valid: false, error: 'runId is required for GET_JOURNEY_RESULTS' };
        description = `Retrieve step-by-step action events and telemetry for journey run ${params.runId}`;
        break;

      case 'GET_ACCESSIBILITY_RESULTS':
        if (!params.runId) return { valid: false, error: 'runId is required for GET_ACCESSIBILITY_RESULTS' };
        description = `Retrieve axe-core automated WCAG rule violations for run ${params.runId}`;
        break;

      case 'GET_ROADMAP':
        description = 'Fetch transparent P0-P3 prioritized fix tasks for the active project';
        break;

      case 'PROPOSE_JOURNEY_RUN':
        if (!params.projectId) return { valid: false, error: 'projectId is required for PROPOSE_JOURNEY_RUN' };
        // Check project origin against SSRF
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.projectId) as any;
        if (!project) return { valid: false, error: 'Project not found' };

        const ssrfCheck = SSRFProtectionService.validateUrl(project.source_url, JSON.parse(project.allowed_domains || '[]'));
        if (!ssrfCheck.safe) {
          return { valid: false, error: `Cannot run journey: Target URL failed security validation (${ssrfCheck.reason})` };
        }

        requiresConfirmation = true;
        description = `Trigger real Playwright journey run for project "${project.name}" (${project.source_url})`;
        warnings.push('This action initiates live browser automation in Chromium and consumes local resources.');
        break;

      case 'REQUEST_RETEST':
        if (!params.findingId) return { valid: false, error: 'findingId is required for REQUEST_RETEST' };
        const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(params.findingId) as any;
        if (!finding) return { valid: false, error: 'Finding not found' };

        requiresConfirmation = true;
        description = `Trigger retest journey for finding "${finding.title}" on ${finding.page_url}`;
        warnings.push('Retest will launch a fresh browser journey to check if the defect still reproduces.');
        break;
    }

    return {
      valid: true,
      proposedAction: {
        actionType: type,
        params,
        description,
        requiresConfirmation,
        isSafe: true,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    };
  }

  /**
   * Execute an authorized action with verification and confirmation enforcement
   */
  public static async executeAction(
    actionType: string,
    params: Record<string, any>,
    confirmed: boolean = false
  ): Promise<ActionResult> {
    const validation = this.validateAction(actionType, params);
    if (!validation.valid || !validation.proposedAction) {
      return {
        success: false,
        actionType: actionType as AssistantActionType,
        error: validation.error || 'Invalid action'
      };
    }

    const action = validation.proposedAction;

    // Enforce server-side user confirmation for state-changing/browser execution actions
    if (action.requiresConfirmation && !confirmed) {
      return {
        success: false,
        actionType: action.actionType,
        error: 'Confirmation required. This action has real browser side effects and must be explicitly confirmed by the user.'
      };
    }

    try {
      switch (action.actionType) {
        case 'GET_AUDIT_SUMMARY': {
          const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(params.runId) as any;
          if (!run) return { success: false, actionType: action.actionType, error: 'Run not found' };
          return {
            success: true,
            actionType: action.actionType,
            data: {
              id: run.id,
              projectId: run.project_id,
              status: run.status,
              durationSeconds: run.duration_seconds,
              taskOutcome: run.task_outcome,
              findingsCount: JSON.parse(run.findings_count || '{}'),
              startedAt: run.started_at,
              endedAt: run.ended_at
            }
          };
        }

        case 'GET_FINDING_EVIDENCE': {
          const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(params.findingId) as any;
          if (!finding) return { success: false, actionType: action.actionType, error: 'Finding not found' };

          let evidence: any = null;
          if (finding.evidence_id) {
            evidence = db.prepare('SELECT * FROM evidence WHERE id = ?').get(finding.evidence_id);
          }

          return {
            success: true,
            actionType: action.actionType,
            data: {
              finding: {
                id: finding.id,
                title: finding.title,
                category: finding.category,
                severity: finding.severity,
                verificationStatus: finding.verification_status,
                lifecycleStatus: finding.lifecycle_status,
                pageUrl: finding.page_url,
                observedFacts: finding.observed_facts,
                possibleCause: finding.possible_cause,
                recommendedAction: finding.recommended_action
              },
              evidence
            }
          };
        }

        case 'COMPARE_AUDITS': {
          const comparison = RegressionMemoryService.compareAudits(params.baselineRunId, params.currentRunId);
          return {
            success: true,
            actionType: action.actionType,
            data: comparison
          };
        }

        case 'GET_JOURNEY_RESULTS': {
          const events = db.prepare('SELECT * FROM action_events WHERE run_id = ? ORDER BY sequence_no ASC').all(params.runId) as any[];
          return {
            success: true,
            actionType: action.actionType,
            data: {
              runId: params.runId,
              eventsCount: events.length,
              events
            }
          };
        }

        case 'GET_ACCESSIBILITY_RESULTS': {
          const results = db.prepare('SELECT * FROM accessibility_results WHERE run_id = ?').all(params.runId) as any[];
          return {
            success: true,
            actionType: action.actionType,
            data: {
              runId: params.runId,
              totalViolations: results.length,
              results
            }
          };
        }

        case 'GET_ROADMAP': {
          const tasks = RoadmapService.getTasks(params.projectId);
          return {
            success: true,
            actionType: action.actionType,
            data: {
              totalTasks: tasks.length,
              tasks
            }
          };
        }

        case 'PROPOSE_JOURNEY_RUN': {
          const runId = `run-${Date.now()}`;
          const now = new Date().toISOString();
          const personaIds = params.personaIds || ['persona-1'];
          const scenarioIds = params.scenarioIds || [];

          db.prepare(`
            INSERT INTO runs (
              id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
              viewport, browser, model_mode, action_budget, actions_executed, started_at,
              task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
            ) VALUES (?, ?, ?, ?, 'queued', 0, 0, ?, 'chromium', 'live', ?, 0, ?, 'in_progress', 0, 0, '{"critical":0,"serious":0,"moderate":0,"minor":0}', 0)
          `).run(
            runId,
            params.projectId,
            JSON.stringify(personaIds),
            JSON.stringify(scenarioIds),
            params.viewport || 'desktop-1440',
            params.actionBudget || 15,
            now
          );

          // Asynchronously launch Playwright in background
          PlaywrightRunnerService.executeRun(runId).catch(err => {
            console.error(`[AssistantAction] Error running background Playwright run ${runId}:`, err);
          });

          return {
            success: true,
            actionType: action.actionType,
            jobId: runId,
            data: {
              runId,
              status: 'queued',
              startedAt: now,
              message: `Journey run ${runId} queued successfully.`
            }
          };
        }

        case 'REQUEST_RETEST': {
          const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(params.findingId) as any;
          if (!finding) return { success: false, actionType: action.actionType, error: 'Finding not found' };

          const runId = `run-retest-${Date.now()}`;
          const now = new Date().toISOString();

          db.prepare(`
            INSERT INTO runs (
              id, project_id, persona_ids, scenario_ids, status, current_step_index, total_steps,
              viewport, browser, model_mode, action_budget, actions_executed, started_at,
              task_outcome, console_errors_count, network_errors_count, findings_count, is_demo_run
            ) VALUES (?, ?, '["persona-1"]', '[]', 'queued', 0, 0, 'desktop-1440', 'chromium', 'live', 10, 0, ?, 'in_progress', 0, 0, '{"critical":0,"serious":0,"moderate":0,"minor":0}', 0)
          `).run(
            runId,
            finding.project_id,
            now
          );

          PlaywrightRunnerService.executeRun(runId).catch(err => {
            console.error(`[AssistantAction] Retest error for run ${runId}:`, err);
          });

          return {
            success: true,
            actionType: action.actionType,
            jobId: runId,
            data: {
              runId,
              findingId: finding.id,
              status: 'queued',
              startedAt: now,
              message: `Retest run ${runId} launched for finding ${finding.id}.`
            }
          };
        }

        default:
          return { success: false, actionType: action.actionType, error: 'Unhandled action' };
      }
    } catch (err: any) {
      console.error(`[AssistantActionService] Execution error:`, err);
      return {
        success: false,
        actionType: action.actionType,
        error: `Internal error executing action: ${err.message || String(err)}`
      };
    }
  }
}
