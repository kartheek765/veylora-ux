import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { Project, Persona, Scenario, ViewportPreset } from '../../types';
import { Play, Shield, Info, Monitor, Smartphone, Laptop, Tablet } from 'lucide-react';
import { toast } from '../../components/ui/Toast';

interface RunConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export const RunConfigModal: React.FC<RunConfigModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
}) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [viewport, setViewport] = useState<ViewportPreset>('desktop-1440');
  const [browser, setBrowser] = useState<'Chromium' | 'Firefox' | 'WebKit'>('Chromium');
  const [modelMode, setModelMode] = useState<'rule-based' | 'cloud-placeholder' | 'local-placeholder'>('rule-based');
  const [actionBudget, setActionBudget] = useState<number>(15);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    async function loadConfigData() {
      if (!isOpen) return;
      try {
        const [pList, perList, sList] = await Promise.all([
          api.getProjects(),
          api.getPersonas(),
          api.getScenarios()
        ]);

        setProjects(pList);
        setPersonas(perList);
        setScenarios(sList);

        const targetProjId = defaultProjectId || pList[0]?.id || '';
        setSelectedProjectId(targetProjId);
        setSelectedPersonaIds(perList.slice(0, 2).map((p: Persona) => p.id));
        
        const matchedScenario = sList.find((s: Scenario) => s.projectId === targetProjId) || sList[0];
        setSelectedScenarioId(matchedScenario?.id || '');
      } catch (err: any) {
        console.error('Failed to load run config options:', err);
      }
    }
    loadConfigData();
  }, [isOpen, defaultProjectId]);

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const filteredScenarios = scenarios.filter(s => s.projectId === selectedProjectId);

  const togglePersona = (id: string) => {
    setSelectedPersonaIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleStartRun = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }
    if (selectedPersonaIds.length === 0) {
      toast.error('Select at least one synthetic persona');
      return;
    }
    if (!selectedScenarioId) {
      toast.error('Please select a scenario for this project');
      return;
    }

    try {
      setIsLaunching(true);
      const res = await api.startRun(
        selectedProjectId,
        selectedPersonaIds,
        [selectedScenarioId],
        actionBudget
      );

      toast.success(`Run ${res.id} submitted to backend Playwright runner`);
      onClose();
      navigate(`/runs/${res.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start browser run');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Synthetic Journey Run"
      subtitle="Bind persona behaviors and bounded scenario execution to target source"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Project Selection */}
        <div>
          <Select
            label="Target Project"
            value={selectedProjectId}
            onChange={(e) => {
              const newProjId = e.target.value;
              setSelectedProjectId(newProjId);
              const matched = scenarios.find(s => s.projectId === newProjId);
              if (matched) setSelectedScenarioId(matched.id);
            }}
            options={projects.map(p => ({ value: p.id, label: `${p.name} (${p.sourceType})` }))}
          />
          {activeProject && (
            <div className="mt-2 p-2.5 rounded-lg bg-surface-subtle border border-border flex items-center justify-between text-xs">
              <span className="text-text-muted truncate">Source: <strong className="text-text-primary">{activeProject.sourceUrl}</strong></span>
              <span className="text-[11px] font-mono text-teal-300">Allowlist: {activeProject.allowedDomains.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Persona Multi-selection */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Select Synthetic Personas ({selectedPersonaIds.length} chosen)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {personas.map((persona) => {
              const isSelected = selectedPersonaIds.includes(persona.id);
              return (
                <div
                  key={persona.id}
                  onClick={() => togglePersona(persona.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-accent/15 border-accent/60 text-text-primary'
                      : 'bg-surface-subtle border-border text-text-secondary hover:border-border-light'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{persona.name}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded accent-accent"
                    />
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 line-clamp-2">{persona.shortProfile}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenario Selection */}
        <div>
          <Select
            label="Test Scenario"
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            options={filteredScenarios.map(s => ({ value: s.id, label: `${s.title} (${s.steps.length} steps)` }))}
          />
          {filteredScenarios.length === 0 && (
            <p className="text-[11px] text-amber-400 mt-1">
              No scenarios found for this project. Build a scenario first or run a Website Smoke Test from the project page.
            </p>
          )}
        </div>

        {/* Execution Constraints Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Viewport Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'desktop-1440', label: '1440px', icon: Monitor },
                { id: 'laptop-1280', label: '1280px', icon: Laptop },
                { id: 'tablet-768', label: '768px', icon: Tablet },
                { id: 'mobile-390', label: '390px', icon: Smartphone },
              ].map(v => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setViewport(v.id as ViewportPreset)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium ${
                      viewport === v.id ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface-subtle border-border text-text-secondary'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Select
              label="Browser Worker"
              value={browser}
              onChange={(e) => setBrowser(e.target.value as any)}
              options={[
                { value: 'Chromium', label: 'Chromium (Default Isolated)' },
                { value: 'Firefox', label: 'Firefox (Future Extension)' },
                { value: 'WebKit', label: 'WebKit (Future Extension)' },
              ]}
            />
          </div>

          <div>
            <Select
              label="Action Budget"
              value={actionBudget.toString()}
              onChange={(e) => setActionBudget(Number(e.target.value))}
              options={[
                { value: '10', label: '10 Actions (Strict Bounded)' },
                { value: '15', label: '15 Actions (Recommended)' },
                { value: '25', label: '25 Actions (Deep Journey)' },
              ]}
            />
          </div>
        </div>

        {/* Model Mode Selection */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-border">
          <label className="block text-xs font-medium text-text-secondary mb-2">Analysis Engine Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setModelMode('rule-based')}
              className={`p-2.5 rounded-lg border text-left text-xs ${
                modelMode === 'rule-based' ? 'bg-teal-500/15 border-teal/60 text-teal-300' : 'bg-surface border-border text-text-muted'
              }`}
            >
              <div className="font-semibold">Deterministic Rules</div>
              <div className="text-[10px] mt-0.5 opacity-80">Local-first, zero cloud calls</div>
            </button>
            <button
              type="button"
              onClick={() => setModelMode('cloud-placeholder')}
              className={`p-2.5 rounded-lg border text-left text-xs ${
                modelMode === 'cloud-placeholder' ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface border-border text-text-muted'
              }`}
            >
              <div className="font-semibold">Cloud LLM Mode</div>
              <div className="text-[10px] mt-0.5 opacity-80">UI Mock Placeholder</div>
            </button>
            <button
              type="button"
              onClick={() => setModelMode('local-placeholder')}
              className={`p-2.5 rounded-lg border text-left text-xs ${
                modelMode === 'local-placeholder' ? 'bg-accent/20 border-accent text-accent-light' : 'bg-surface border-border text-text-muted'
              }`}
            >
              <div className="font-semibold">Local Ollama Mode</div>
              <div className="text-[10px] mt-0.5 opacity-80">UI Mock Placeholder</div>
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 text-[11px] text-text-muted">
            <Shield size={14} className="text-teal shrink-0 mt-0.5" />
            <span>
              <strong>Safe Simulation Guard:</strong> Real financial transactions, irreversible POST forms, and external unallowlisted URLs are permanently blocked.
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={<Play size={14} fill="currentColor" />}
            onClick={handleStartRun}
            isLoading={isLaunching}
            disabled={isLaunching || filteredScenarios.length === 0}
          >
            Start Real Browser Run
          </Button>
        </div>
      </div>
    </Modal>
  );
};
