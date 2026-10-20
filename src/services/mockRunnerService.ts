import { Run, ActionEvent, Finding, EvidenceItem } from '../types';
import { StorageService } from './storageService';

export interface RunProgressCallback {
  (updatedRun: Run): void;
}

class MockRunnerService {
  private activeTimers: Map<string, NodeJS.Timeout[]> = new Map();
  private cancelFlags: Map<string, boolean> = new Map();

  startDemoRun(
    runConfig: Partial<Run> & { projectId: string; personaIds: string[]; scenarioIds: string[] },
    onProgress: RunProgressCallback
  ): Run {
    const runId = `run-${Date.now().toString().slice(-6)}`;
    const scenario = StorageService.getScenario(runConfig.scenarioIds[0]);
    const stepsCount = scenario?.steps.length || 6;

    const initialRun: Run = {
      id: runId,
      projectId: runConfig.projectId,
      personaIds: runConfig.personaIds,
      scenarioIds: runConfig.scenarioIds,
      status: 'preparing',
      currentStepIndex: 0,
      totalSteps: stepsCount,
      currentPersonaId: runConfig.personaIds[0],
      currentScenarioId: runConfig.scenarioIds[0],
      viewport: runConfig.viewport || 'desktop-1440',
      browser: runConfig.browser || 'Chromium',
      modelMode: runConfig.modelMode || 'rule-based',
      actionBudget: runConfig.actionBudget || 15,
      actionsExecuted: 0,
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      taskOutcome: 'in-progress',
      consoleErrorsCount: 0,
      networkErrorsCount: 0,
      findingsCount: { critical: 0, high: 0, medium: 0, low: 0 },
      liveEvents: [],
      isDemoRun: true,
    };

    StorageService.saveRun(initialRun);
    onProgress(initialRun);

    this.cancelFlags.set(runId, false);
    const timers: NodeJS.Timeout[] = [];
    this.activeTimers.set(runId, timers);

    // Bounded deterministic state machine
    // 1. Preparing -> Validating (400ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const updated = { ...initialRun, status: 'validating' as const };
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 500)
    );

    // 2. Validating -> Queued (1000ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const updated = { ...initialRun, status: 'queued' as const };
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 1100)
    );

    // 3. Queued -> Running (1600ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const updated = { ...initialRun, status: 'running' as const, currentStepIndex: 1, actionsExecuted: 1 };
        
        // Add step 1 event
        const ev1: ActionEvent = {
          id: `act-${Date.now()}-1`,
          runId,
          personaId: runConfig.personaIds[0],
          sequenceNo: 1,
          actionType: 'navigate',
          targetSummary: 'Loaded starting URL (Isolated Chromium Profile)',
          result: 'success',
          observedStateChange: 'DOM Content Loaded, HTTP 200 OK',
          url: scenario?.startingUrl || 'https://staging.app.local',
          timestamp: new Date().toLocaleTimeString(),
          durationMs: 380,
        };
        updated.liveEvents = [ev1];
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 1700)
    );

    // 4. Running Step 2 (2600ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const current = StorageService.getRun(runId) || initialRun;
        const ev2: ActionEvent = {
          id: `act-${Date.now()}-2`,
          runId,
          personaId: runConfig.personaIds[0],
          sequenceNo: 2,
          actionType: 'type_test_data',
          targetSummary: 'Typed synthetic test fixture into form',
          result: 'success',
          observedStateChange: 'Synthetic credentials sanitized and typed',
          url: scenario?.startingUrl || 'https://staging.app.local',
          timestamp: new Date().toLocaleTimeString(),
          durationMs: 240,
        };
        const updated = {
          ...current,
          currentStepIndex: 2,
          actionsExecuted: 2,
          liveEvents: [...current.liveEvents, ev2],
        };
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 2800)
    );

    // 5. Running Step 3 & Capturing Demo Evidence (4000ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const current = StorageService.getRun(runId) || initialRun;
        const ev3: ActionEvent = {
          id: `act-${Date.now()}-3`,
          runId,
          personaId: runConfig.personaIds[0],
          sequenceNo: 3,
          actionType: 'click',
          targetSummary: 'Clicked primary submission CTA',
          result: 'friction',
          observedStateChange: 'Target button entered disabled state without inline validation feedback',
          url: (scenario?.startingUrl || 'https://staging.app.local') + '/next',
          timestamp: new Date().toLocaleTimeString(),
          durationMs: 890,
        };
        const updated = {
          ...current,
          status: 'capturing' as const,
          currentStepIndex: 3,
          actionsExecuted: 3,
          liveEvents: [...current.liveEvents, ev3],
        };
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 4200)
    );

    // 6. Analyzing Signals (5500ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const current = StorageService.getRun(runId) || initialRun;
        const updated = {
          ...current,
          status: 'analyzing' as const,
          findingsCount: { critical: 0, high: 1, medium: 1, low: 0 },
        };
        StorageService.saveRun(updated);
        onProgress(updated);
      }, 5600)
    );

    // 7. Completed (6800ms)
    timers.push(
      setTimeout(() => {
        if (this.cancelFlags.get(runId)) return;
        const current = StorageService.getRun(runId) || initialRun;
        const updated: Run = {
          ...current,
          status: 'completed' as const,
          taskOutcome: 'blocked',
          currentStepIndex: stepsCount,
          actionsExecuted: stepsCount,
          endedAt: new Date().toISOString(),
          durationSeconds: 7,
          findingsCount: { critical: 0, high: 1, medium: 1, low: 0 },
        };
        StorageService.saveRun(updated);
        onProgress(updated);
        this.cleanRun(runId);
      }, 7000)
    );

    return initialRun;
  }

  cancelRun(runId: string, onProgress: RunProgressCallback): void {
    this.cancelFlags.set(runId, true);
    const timers = this.activeTimers.get(runId);
    if (timers) {
      timers.forEach(t => clearTimeout(t));
    }
    const current = StorageService.getRun(runId);
    if (current) {
      const cancelled: Run = {
        ...current,
        status: 'cancelled',
        taskOutcome: 'cancelled',
        endedAt: new Date().toISOString(),
      };
      StorageService.saveRun(cancelled);
      onProgress(cancelled);
    }
    this.cleanRun(runId);
  }

  private cleanRun(runId: string) {
    this.activeTimers.delete(runId);
    this.cancelFlags.delete(runId);
  }
}

export const mockRunner = new MockRunnerService();
