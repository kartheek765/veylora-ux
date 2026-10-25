export type SourceType = 'website' | 'figma' | 'export';

export type ViewportPreset = 'desktop-1440' | 'laptop-1280' | 'tablet-768' | 'mobile-390';

export interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  allowedDomains: string[];
  viewport: ViewportPreset;
  readinessStatus: 'demo-ready' | 'needs-review' | 'not-configured' | 'configuration-error';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type FamiliarityLevel = 'novice' | 'moderate' | 'expert';
export type PatienceLevel = 'low' | 'medium' | 'high';
export type ReadingTendency = 'skimmer' | 'methodical' | 'minimalist';
export type NavigationConfidence = 'hesitant' | 'exploratory' | 'confident';

export interface SyntheticAgentTraits {
  familiarity: FamiliarityLevel;
  patience: PatienceLevel;
  readingTendency: ReadingTendency;
  navigationConfidence: NavigationConfidence;
  accessibilityNeeds: string[];
  deviceContext: string;
  language: string;
  constraints?: string;
}

export type PersonaTraits = SyntheticAgentTraits;
export type AgentTraits = SyntheticAgentTraits;

export interface SyntheticAgent {
  id: string;
  projectId?: string;
  name: string;
  shortProfile: string;
  primaryGoal: string;
  secondaryGoal?: string;
  traits: SyntheticAgentTraits;
  enabled: boolean;
  version: number;
  isTemplate?: boolean;
  avatarColor?: string;
  createdAt: string;
  updatedAt: string;
}

export type Persona = SyntheticAgent;
export type Agent = SyntheticAgent;

export type StepActionType = 
  | 'click' 
  | 'type_test_data' 
  | 'navigate' 
  | 'wait_for_visible' 
  | 'verify_text' 
  | 'assert_visible'
  | 'assert_url'
  | 'select'
  | 'check'
  | 'scroll'
  | 'capture_screenshot';

export interface ScenarioStep {
  id: string;
  sequenceNo: number;
  actionType: StepActionType;
  targetDescription: string;
  targetSelector?: string;
  value?: string;
  optionalCheckpoint?: boolean;
}

export interface NegativePathConfig {
  missingRequiredField: boolean;
  invalidFormat: boolean;
  emptyStateCheck: boolean;
  backNavigation: boolean;
  responsiveLayout: boolean;
}

export interface Scenario {
  id: string;
  projectId: string;
  title: string;
  naturalGoal: string;
  startingUrl: string;
  successCondition: string;
  actionBudget: number;
  timeBudgetSeconds: number;
  stopConditions: string[];
  steps: ScenarioStep[];
  testDataFixtures: Record<string, string>;
  negativePaths: NegativePathConfig;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 
  | 'preparing' 
  | 'validating' 
  | 'queued' 
  | 'running' 
  | 'capturing' 
  | 'analyzing' 
  | 'completed' 
  | 'passed'
  | 'failed' 
  | 'blocked'
  | 'inconclusive'
  | 'cancelled';

export interface ActionEvent {
  id: string;
  runId: string;
  personaId: string;
  sequenceNo: number;
  actionType: StepActionType;
  targetSummary: string;
  result: 'success' | 'friction' | 'blocked' | 'warning';
  observedStateChange: string;
  url: string;
  timestamp: string;
  durationMs: number;
  evidenceId?: string;
}

export interface Run {
  id: string;
  projectId: string;
  personaIds: string[];
  scenarioIds: string[];
  status: RunStatus;
  currentStepIndex: number;
  totalSteps: number;
  currentPersonaId?: string;
  currentScenarioId?: string;
  viewport: ViewportPreset;
  browser: 'Chromium' | 'Firefox' | 'WebKit';
  modelMode: 'rule-based' | 'cloud-placeholder' | 'local-placeholder';
  actionBudget: number;
  actionsExecuted: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  taskOutcome: 'completed' | 'completed_goal' | 'passed' | 'failed' | 'smoke_passed' | 'smoke_failed' | 'blocked' | 'partial' | 'in-progress' | 'cancelled' | 'inconclusive';
  consoleErrorsCount: number;
  networkErrorsCount: number;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  liveEvents: ActionEvent[];
  isDemoRun: boolean;
}

export type FindingCategory =
  | 'task_blocked'
  | 'navigation_confusion'
  | 'non_responsive_control'
  | 'form_friction'
  | 'visual_layout_issue'
  | 'technical_error'
  | 'content_clarity'
  | 'accessibility_signal';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FindingConfidence = 'high' | 'medium' | 'low';
export type FindingStatus = 
  | 'needs_review' 
  | 'valid' 
  | 'false_positive' 
  | 'fixed' 
  | 'accepted_risk' 
  | 'needs_investigation';

export type VerificationStatus =
  | 'VERIFIED'
  | 'AI_HYPOTHESIS'
  | 'NEEDS_REVIEW'
  | 'NOT_REPRODUCED'
  | 'INVALIDATED'
  | 'BLOCKED';

export type LifecycleStatus =
  | 'NEW'
  | 'PERSISTENT'
  | 'RESOLVED'
  | 'NO_LONGER_OBSERVED'
  | 'RECURRING'
  | 'MATERIALLY_CHANGED';

export interface Finding {
  id: string;
  runId: string;
  projectId: string;
  personaId: string;
  scenarioId: string;
  actionEventId?: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  title: string;
  likelyImpact: string;
  observedFacts: string;
  possibleCause: string;
  recommendedAction: string;
  reproductionNotes: string;
  evidenceId?: string;
  pageUrl: string;
  stepNumber: number;
  status: FindingStatus;
  isHeuristic: boolean;
  fingerprint?: string;
  verificationStatus?: VerificationStatus;
  lifecycleStatus?: LifecycleStatus;
  selectorSummary?: string;
  ruleId?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

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

export interface AccessibilityResult {
  id: string;
  runId: string;
  projectId: string;
  ruleId: string;
  description: string;
  impact: string;
  helpUrl?: string;
  targetSelector: string;
  htmlSnippet?: string;
  failureSummary?: string;
  verificationStatus: string;
  wcagTags: string[];
  createdAt: string;
}


export interface EvidenceItem {
  id: string;
  runId: string;
  actionEventId?: string;
  type: 'screenshot' | 'dom_snapshot' | 'console_log' | 'network_trace';
  url: string;
  pageTitle: string;
  timestamp: string;
  stepNumber: number;
  redactionStatus: 'redacted' | 'clean' | 'none';
  localPath?: string;
  local_path?: string;
  svgMockupData?: {
    screenName: string;
    highlightArea?: { x: number; y: number; w: number; h: number; label: string; color: string };
    elements?: Array<{ type: string; label: string; state?: string }>;
  };
  caption: string;
}

export interface FindingComparisonResult {
  fingerprint: string;
  title: string;
  category: string;
  severity: string;
  baselineFindingId?: string;
  currentFindingId?: string;
  lifecycleStatus: LifecycleStatus;
  verificationStatus: VerificationStatus;
  pageUrl: string;
  explanation: string;
}

export interface AuditComparisonSummary {
  comparisonId: string;
  projectId: string;
  baselineRunId: string;
  currentRunId: string;
  baselineStartedAt: string;
  currentStartedAt: string;
  newCount: number;
  persistentCount: number;
  resolvedCount: number;
  recurringCount: number;
  inconclusiveCount: number;
  verifiedFixCount: number;
  results: FindingComparisonResult[];
}

export interface RunComparison {
  id: string;
  runAId: string;
  runBId: string;
  configMatch: boolean;
  configDifferences: string[];
  metrics: {
    runA: { outcome: string; duration: number; actions: number; findings: number };
    runB: { outcome: string; duration: number; actions: number; findings: number };
  };
  newFindings: Finding[];
  resolvedFindings: Finding[];
  persistentFindings: Finding[];
}

export interface Report {
  id: string;
  runId: string;
  projectId: string;
  title: string;
  purpose: string;
  generationTime: string;
  appVersion: string;
  reportSchemaVersion: string;
  executiveSummary: {
    totalPersonas: number;
    totalScenarios: number;
    taskOutcome: string;
    keyRisks: string[];
    criticalBlockers: number;
    averageFrictionScore: number;
  };
  limitationsNotice: string;
}

export interface DetectiveJourneyStep {
  stepNumber: number;
  actionType: 'navigate' | 'click' | 'fill' | 'assert' | 'scroll' | 'select';
  selectorOrTarget: string;
  value?: string;
  description: string;
  expectedOutcome: string;
}

export interface DetectiveDiagnosis {
  problemDescription: string;
  observedFacts: string;
  likelyRootCause: string;
  isHypothesis: boolean;
  suggestedFix: string;
  verificationStatus: 'VERIFIED' | 'STRONGLY_SUPPORTED' | 'AI_HYPOTHESIS' | 'INCONCLUSIVE_BLOCKED' | 'NEEDS_REVIEW';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  reproducibility: string;
  evidenceReferences: string[];
}

export interface DetectiveInvestigation {
  id: string;
  project_id: string;
  run_id?: string;
  baseline_investigation_id?: string;
  natural_goal: string;
  starting_url: string;
  preconditions_json: string;
  ordered_steps_json: string;
  expected_outcomes_json: string;
  failure_conditions_json: string;
  allowed_domains_json: string;
  max_steps: number;
  execution_budget: number;
  test_data_json: string;
  is_approved_by_user: number;
  has_consequential_actions: number;
  consequential_warning?: string;
  status: 'draft' | 'approved' | 'running' | 'completed' | 'failed';
  outcome?: 'GOAL_ACHIEVED' | 'FAILURE_DETECTED' | 'INCONCLUSIVE_BLOCKED' | 'PRECONDITION_FAILED';
  breaking_step_index?: number;
  breaking_action_summary?: string;
  observed_defect_summary?: string;
  evidence_id?: string;
  finding_id?: string;
  diagnosis_json?: string;
  retest_status?: 'BASELINE' | 'RESOLVED' | 'PERSISTING' | 'REGRESSION' | 'INCONCLUSIVE' | 'PENDING';
  comparison_notes?: string;
  created_at: string;
  completed_at?: string;
}

