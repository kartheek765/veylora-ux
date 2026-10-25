import { 
  Project, 
  Persona, 
  SyntheticAgent,
  Scenario, 
  Run, 
  Finding, 
  EvidenceItem, 
  Report 
} from '../types';
import { 
  SEED_PROJECTS, 
  STARTER_PERSONAS, 
  SEED_SCENARIOS, 
  SEED_RUNS, 
  SEED_FINDINGS, 
  SEED_EVIDENCE, 
  SEED_REPORTS 
} from '../data/seedData';

const STORAGE_KEYS = {
  PROJECTS: 'veylora_projects_v1',
  PERSONAS: 'veylora_personas_v1',
  SCENARIOS: 'veylora_scenarios_v1',
  RUNS: 'veylora_runs_v1',
  FINDINGS: 'veylora_findings_v1',
  EVIDENCE: 'veylora_evidence_v1',
  REPORTS: 'veylora_reports_v1',
  SETTINGS: 'veylora_settings_v1',
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Veylora Storage] Failed to parse key ${key}, using fallback`, e);
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Veylora Storage] Failed to persist key ${key}`, e);
  }
}

export class StorageService {
  // Initialize storage if empty - clean zero-mock default
  static init(): void {
    // Zero-mock start: do not automatically seed fabricated projects or runs
  }

  static resetAllToSeed(): void {
    safeSet(STORAGE_KEYS.PROJECTS, SEED_PROJECTS);
    safeSet(STORAGE_KEYS.PERSONAS, STARTER_PERSONAS);
    safeSet(STORAGE_KEYS.SCENARIOS, SEED_SCENARIOS);
    safeSet(STORAGE_KEYS.RUNS, SEED_RUNS);
    safeSet(STORAGE_KEYS.FINDINGS, SEED_FINDINGS);
    safeSet(STORAGE_KEYS.EVIDENCE, SEED_EVIDENCE);
    safeSet(STORAGE_KEYS.REPORTS, SEED_REPORTS);
  }

  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  }

  // Projects
  static getProjects(): Project[] {
    return safeGet<Project[]>(STORAGE_KEYS.PROJECTS, []);
  }

  static getProject(id: string): Project | undefined {
    return this.getProjects().find(p => p.id === id);
  }

  static saveProject(project: Project): void {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = { ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.unshift(project);
    }
    safeSet(STORAGE_KEYS.PROJECTS, projects);
  }

  static deleteProject(id: string): void {
    const projects = this.getProjects().filter(p => p.id !== id);
    safeSet(STORAGE_KEYS.PROJECTS, projects);
    // Also cleanup linked scenarios and runs
    const scenarios = this.getScenarios().filter(s => s.projectId !== id);
    safeSet(STORAGE_KEYS.SCENARIOS, scenarios);
  }

  // Personas & Synthetic Agents
  static getPersonas(): Persona[] {
    return safeGet<Persona[]>(STORAGE_KEYS.PERSONAS, STARTER_PERSONAS);
  }

  static getPersona(id: string): Persona | undefined {
    return this.getPersonas().find(p => p.id === id);
  }

  static savePersona(persona: Persona): void {
    const personas = this.getPersonas();
    const idx = personas.findIndex(p => p.id === persona.id);
    if (idx >= 0) {
      personas[idx] = { ...persona, updatedAt: new Date().toISOString() };
    } else {
      personas.unshift(persona);
    }
    safeSet(STORAGE_KEYS.PERSONAS, personas);
  }

  static deletePersona(id: string): void {
    const personas = this.getPersonas().filter(p => p.id !== id);
    safeSet(STORAGE_KEYS.PERSONAS, personas);
  }

  // Synthetic Agents (clean aliases)
  static getSyntheticAgents(): SyntheticAgent[] {
    return this.getPersonas();
  }

  static getSyntheticAgent(id: string): SyntheticAgent | undefined {
    return this.getPersona(id);
  }

  static saveSyntheticAgent(agent: SyntheticAgent): void {
    this.savePersona(agent);
  }

  static deleteSyntheticAgent(id: string): void {
    this.deletePersona(id);
  }

  // Scenarios
  static getScenarios(): Scenario[] {
    return safeGet<Scenario[]>(STORAGE_KEYS.SCENARIOS, []);
  }

  static getScenario(id: string): Scenario | undefined {
    return this.getScenarios().find(s => s.id === id);
  }

  static saveScenario(scenario: Scenario): void {
    const scenarios = this.getScenarios();
    const idx = scenarios.findIndex(s => s.id === scenario.id);
    if (idx >= 0) {
      scenarios[idx] = { ...scenario, updatedAt: new Date().toISOString() };
    } else {
      scenarios.unshift(scenario);
    }
    safeSet(STORAGE_KEYS.SCENARIOS, scenarios);
  }

  static deleteScenario(id: string): void {
    const scenarios = this.getScenarios().filter(s => s.id !== id);
    safeSet(STORAGE_KEYS.SCENARIOS, scenarios);
  }

  // Runs
  static getRuns(): Run[] {
    return safeGet<Run[]>(STORAGE_KEYS.RUNS, []);
  }

  static getRun(id: string): Run | undefined {
    return this.getRuns().find(r => r.id === id);
  }

  static saveRun(run: Run): void {
    const runs = this.getRuns();
    const idx = runs.findIndex(r => r.id === run.id);
    if (idx >= 0) {
      runs[idx] = run;
    } else {
      runs.unshift(run);
    }
    safeSet(STORAGE_KEYS.RUNS, runs);
  }

  static deleteRun(id: string): void {
    const runs = this.getRuns().filter(r => r.id !== id);
    safeSet(STORAGE_KEYS.RUNS, runs);
  }

  // Findings
  static getFindings(): Finding[] {
    return safeGet<Finding[]>(STORAGE_KEYS.FINDINGS, []);
  }

  static getFinding(id: string): Finding | undefined {
    return this.getFindings().find(f => f.id === id);
  }

  static saveFinding(finding: Finding): void {
    const findings = this.getFindings();
    const idx = findings.findIndex(f => f.id === finding.id);
    if (idx >= 0) {
      findings[idx] = finding;
    } else {
      findings.unshift(finding);
    }
    safeSet(STORAGE_KEYS.FINDINGS, findings);
  }

  // Evidence
  static getEvidence(): EvidenceItem[] {
    return safeGet<EvidenceItem[]>(STORAGE_KEYS.EVIDENCE, []);
  }

  static getEvidenceItem(id: string): EvidenceItem | undefined {
    return this.getEvidence().find(e => e.id === id);
  }

  // Reports
  static getReports(): Report[] {
    return safeGet<Report[]>(STORAGE_KEYS.REPORTS, []);
  }

  static getReport(id: string): Report | undefined {
    return this.getReports().find(r => r.id === id);
  }
}
