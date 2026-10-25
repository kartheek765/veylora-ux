const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001/api' : '/api');

export interface AskVeyloraConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  preview: string;
  messageCount: number;
}

export interface AskVeyloraMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  screenContext?: string;
  createdAt: string;
}

export const api = {
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch {
      return { status: 'offline', database: 'disconnected' };
    }
  },

  async getSystemStatus() {
    try {
      const res = await fetch(`${API_BASE}/system/status`);
      return await res.json();
    } catch {
      return null;
    }
  },

  // Projects API
  async getProjects() {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getProject(id: string) {
    try {
      const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async createProject(data: {
    name: string;
    sourceUrl: string;
    description?: string;
    sourceType?: string;
    viewport?: string;
    allowedDomains?: string[];
    readinessStatus?: string;
    notes?: string;
  }) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create project');
    }
    return await res.json();
  },

  async updateProject(id: string, updates: Record<string, any>) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update project');
    }
    return await res.json();
  },

  async deleteProject(id: string) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete project');
    }
    return await res.json();
  },

  async runSmokeTest(projectId: string) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/smoke-test`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Smoke test failed to start');
    }
    return await res.json();
  },

  // Synthetic Agents & Personas API
  async getPersonas() {
    try {
      const res = await fetch(`${API_BASE}/personas`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getSyntheticAgents() {
    return this.getPersonas();
  },

  async createPersona(data: {
    name: string;
    primaryGoal: string;
    shortProfile?: string;
    secondaryGoal?: string;
    traits?: Record<string, any>;
    avatarColor?: string;
  }) {
    const res = await fetch(`${API_BASE}/personas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create synthetic agent');
    }
    return await res.json();
  },

  async createSyntheticAgent(data: {
    name: string;
    primaryGoal: string;
    shortProfile?: string;
    secondaryGoal?: string;
    traits?: Record<string, any>;
    avatarColor?: string;
  }) {
    return this.createPersona(data);
  },

  async updatePersona(id: string, updates: Record<string, any>) {
    const res = await fetch(`${API_BASE}/personas/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  async updateSyntheticAgent(id: string, updates: Record<string, any>) {
    return this.updatePersona(id, updates);
  },

  async deletePersona(id: string) {
    const res = await fetch(`${API_BASE}/personas/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  async deleteSyntheticAgent(id: string) {
    return this.deletePersona(id);
  },

  // Scenarios API
  async getScenarios(projectId?: string) {
    try {
      const url = projectId ? `${API_BASE}/scenarios?projectId=${encodeURIComponent(projectId)}` : `${API_BASE}/scenarios`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getScenario(id: string) {
    try {
      const res = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async generateScenarioPlan(params: {
    naturalGoal: string;
    startingUrl: string;
    allowedDomains?: string[];
    personaName?: string;
    actionBudget?: number;
  }) {
    const res = await fetch(`${API_BASE}/scenarios/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate plan');
    }
    return await res.json();
  },

  async createScenario(data: {
    projectId: string;
    title: string;
    naturalGoal: string;
    startingUrl: string;
    successCondition?: string;
    actionBudget?: number;
    timeBudgetSeconds?: number;
    stopConditions?: string[];
    steps?: any[];
    testDataFixtures?: Record<string, string>;
    negativePaths?: any[];
  }) {
    const res = await fetch(`${API_BASE}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save scenario');
    }
    return await res.json();
  },

  async updateScenario(id: string, updates: Record<string, any>) {
    const res = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update scenario');
    }
    return await res.json();
  },

  async deleteScenario(id: string) {
    const res = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Ask Veylora API
  async listConversations(): Promise<AskVeyloraConversation[]> {
    try {
      const res = await fetch(`${API_BASE}/ask-veylora/conversations`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('[API] listConversations failed:', e);
      return [];
    }
  },

  async createConversation(title?: string): Promise<AskVeyloraConversation | null> {
    try {
      const res = await fetch(`${API_BASE}/ask-veylora/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[API] createConversation failed:', e);
      return null;
    }
  },

  async getConversation(id: string): Promise<{ conversation: AskVeyloraConversation; messages: AskVeyloraMessage[] } | null> {
    try {
      const res = await fetch(`${API_BASE}/ask-veylora/conversations/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[API] getConversation failed:', e);
      return null;
    }
  },

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/ask-veylora/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async sendChatMessage(params: {
    conversationId?: string;
    prompt: string;
    currentRoute: string;
    screenContextText?: string;
    languagePreference?: string;
  }): Promise<{ answer: string; conversationId: string; messageId: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/ask-veylora/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get answer from assistant');
      }
      return await res.json();
    } catch (e: any) {
      console.warn('[API] sendChatMessage failed:', e);
      throw e;
    }
  },

  // Instant URL Auto-Audit (Direct Execution, Zero AI Credits)
  async quickAudit(url: string): Promise<{
    success: boolean;
    runId: string;
    projectId: string;
    scenarioId?: string;
    targetUrl: string;
    hostname?: string;
    agentCount: number;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/assistant/quick-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Backend server returned HTTP ${res.status}`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `Quick audit rejected by server (HTTP ${res.status})`);
      }
      return data;
    } catch (e: any) {
      if (e.message?.includes('Failed to fetch') || e.name === 'TypeError') {
        throw new Error(`Backend server is offline or unreachable at ${API_BASE}. Please ensure backend is running with "npm run dev".`);
      }
      console.warn('[API] quickAudit failed:', e);
      throw e;
    }
  },

  // Playwright Run Execution
  async startRun(projectId: string, personaIds: string[], scenarioIds: string[], actionBudget = 15) {
    try {
      const res = await fetch(`${API_BASE}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, personaIds, scenarioIds, actionBudget })
      });
      return await res.json();
    } catch (e) {
      console.warn('[API] startRun failed:', e);
      throw e;
    }
  },

  async getRuns(projectId?: string) {
    const url = projectId ? `${API_BASE}/runs?projectId=${encodeURIComponent(projectId)}` : `${API_BASE}/runs`;
    const res = await fetch(url);
    return await res.json();
  },

  async getRun(runId: string) {
    const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}`);
    return await res.json();
  },

  async cancelRun(runId: string) {
    const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
    return await res.json();
  },

  async deleteRun(runId: string) {
    const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' });
    return await res.json();
  },

  // Findings API
  async getFindings(filters?: { runId?: string; projectId?: string; severity?: string; category?: string; status?: string; verificationStatus?: string; lifecycleStatus?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.runId) params.append('runId', filters.runId);
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.verificationStatus) params.append('verificationStatus', filters.verificationStatus);
      if (filters.lifecycleStatus) params.append('lifecycleStatus', filters.lifecycleStatus);
    }
    const res = await fetch(`${API_BASE}/findings?${params.toString()}`);
    return await res.json();
  },

  async updateFinding(id: string, updates: { status?: string; verificationStatus?: string; lifecycleStatus?: string }) {
    const res = await fetch(`${API_BASE}/findings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  async getFindingEvidence(id: string) {
    const res = await fetch(`${API_BASE}/findings/${encodeURIComponent(id)}/evidence`);
    return await res.json();
  },

  // Comparisons API (Regression Memory)
  async compareAudits(baselineRunId: string, currentRunId: string) {
    const res = await fetch(`${API_BASE}/comparisons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baselineRunId, currentRunId })
    });
    return await res.json();
  },

  async listComparisons(projectId?: string) {
    const url = projectId ? `${API_BASE}/comparisons?projectId=${encodeURIComponent(projectId)}` : `${API_BASE}/comparisons`;
    const res = await fetch(url);
    return await res.json();
  },

  // Accessibility API
  async getAccessibilityResults(runId: string) {
    const res = await fetch(`${API_BASE}/accessibility/${encodeURIComponent(runId)}`);
    return await res.json();
  },

  // Roadmap API
  async getRoadmap(projectId?: string) {
    const url = projectId ? `${API_BASE}/roadmap?projectId=${encodeURIComponent(projectId)}` : `${API_BASE}/roadmap`;
    const res = await fetch(url);
    return await res.json();
  },

  async generateRoadmap(projectId: string) {
    const res = await fetch(`${API_BASE}/roadmap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    return await res.json();
  },

  async updateRoadmapTask(taskId: string, updates: { status?: string; effortBand?: string; dependencies?: string[] }) {
    const res = await fetch(`${API_BASE}/roadmap/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  // Assistant Actions
  async validateAssistantAction(actionType: string, params: Record<string, any> = {}) {
    const res = await fetch(`${API_BASE}/assistant/actions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, params })
    });
    return await res.json();
  },

  async executeAssistantAction(actionType: string, params: Record<string, any> = {}, confirmed = false) {
    const res = await fetch(`${API_BASE}/assistant/actions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, params, confirmed })
    });
    return await res.json();
  },

  // Privacy API
  async getPrivacySettings() {
    const res = await fetch(`${API_BASE}/privacy/settings`);
    return await res.json();
  },

  async updatePrivacySettings(settings: Record<string, any>) {
    const res = await fetch(`${API_BASE}/privacy/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  },

  async deleteEvidence(id: string) {
    const res = await fetch(`${API_BASE}/evidence/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return await res.json();
  },

  async cleanExpiredEvidence() {
    const res = await fetch(`${API_BASE}/evidence/cleanup`, { method: 'POST' });
    return await res.json();
  },

  // Intent-to-Failure Detective API
  async createDetectiveSpec(params: {
    projectId: string;
    naturalGoal: string;
    startingUrl?: string;
    testData?: Record<string, string>;
    baselineInvestigationId?: string;
  }) {
    const res = await fetch(`${API_BASE}/detective/spec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  },

  async approveDetectiveInvestigation(id: string) {
    const res = await fetch(`${API_BASE}/detective/investigations/${encodeURIComponent(id)}/approve`, {
      method: 'POST'
    });
    return await res.json();
  },

  async executeDetectiveInvestigation(id: string) {
    const res = await fetch(`${API_BASE}/detective/investigations/${encodeURIComponent(id)}/execute`, {
      method: 'POST'
    });
    return await res.json();
  },

  async listDetectiveInvestigations(projectId: string) {
    const res = await fetch(`${API_BASE}/detective/investigations?projectId=${encodeURIComponent(projectId)}`);
    return await res.json();
  },

  async getDetectiveInvestigation(id: string) {
    const res = await fetch(`${API_BASE}/detective/investigations/${encodeURIComponent(id)}`);
    return await res.json();
  },

  async retestDetectiveInvestigation(id: string) {
    const res = await fetch(`${API_BASE}/detective/investigations/${encodeURIComponent(id)}/retest`, {
      method: 'POST'
    });
    return await res.json();
  },

  // Reports API
  async getReports(params?: { runId?: string; projectId?: string }) {
    try {
      const q = new URLSearchParams();
      if (params?.runId) q.append('runId', params.runId);
      if (params?.projectId) q.append('projectId', params.projectId);
      const res = await fetch(`${API_BASE}/reports?${q.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getReport(id: string) {
    try {
      const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  exportReportHtmlUrl(id: string) {
    return `${API_BASE}/reports/${encodeURIComponent(id)}/export-html`;
  },

  // Demo Seeding API
  async seedDemoData() {
    const res = await fetch(`${API_BASE}/demo/seed`, { method: 'POST' });
    return await res.json();
  },

  async clearDemoData() {
    const res = await fetch(`${API_BASE}/demo/seed`, { method: 'DELETE' });
    return await res.json();
  }
};


