import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StorageService } from '../../services/storageService';
import { SyntheticAgent } from '../../types';
import { SyntheticAgentCard } from './SyntheticAgentCard';
import { SyntheticAgentEditorModal } from './SyntheticAgentEditorModal';
import { Plus, Sliders } from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const SyntheticAgentsPage: React.FC = () => {
  const [syntheticAgents, setSyntheticAgents] = useState<SyntheticAgent[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SyntheticAgent | null>(null);

  useEffect(() => {
    setSyntheticAgents(StorageService.getSyntheticAgents());
  }, []);

  const refreshAgents = () => {
    setSyntheticAgents(StorageService.getSyntheticAgents());
  };

  const handleToggleEnable = (agent: SyntheticAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...agent, enabled: !agent.enabled };
    StorageService.saveSyntheticAgent(updated);
    refreshAgents();
    toast.info(`Synthetic Agent "${agent.name}" ${updated.enabled ? 'enabled' : 'disabled'}`);
  };

  const handleDuplicate = (agent: SyntheticAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: SyntheticAgent = {
      ...agent,
      id: `agent-${Date.now().toString().slice(-6)}`,
      name: `${agent.name} (Copy)`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveSyntheticAgent(duplicated);
    refreshAgents();
    toast.success(`Duplicated as "${duplicated.name}"`);
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete synthetic agent "${name}"?`)) {
      StorageService.deleteSyntheticAgent(id);
      refreshAgents();
      toast.info(`Synthetic agent "${name}" deleted`);
    }
  };

  const handleEdit = (agent: SyntheticAgent) => {
    setEditingAgent(agent);
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Synthetic Agent Sandbox</h1>
            <Badge variant="indigo" size="sm">Task-Oriented Behavioral Models</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Synthetic agents evaluate prototypes with explicit goals, reading tendencies, and patience budgets
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setEditingAgent(null);
            setIsEditorOpen(true);
          }}
        >
          + Create Synthetic Agent
        </Button>
      </div>

      {/* Notice on Ethical, Non-Stereotyped Synthetic Agents */}
      <div className="p-3.5 rounded-xl bg-surface-subtle border border-border text-xs text-text-secondary flex items-start gap-2.5">
        <Sliders size={16} className="text-accent-light shrink-0 mt-0.5" />
        <div>
          <strong>Non-Stereotyped Behavioral Modeling:</strong> Veylora UX synthetic agents represent functional navigation tendencies, cognitive reading styles, and device contexts. Traits reflect task behavior rather than demographic assumptions.
        </div>
      </div>

      {/* Synthetic Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {syntheticAgents.map((agent) => (
          <SyntheticAgentCard
            key={agent.id}
            agent={agent}
            onToggleEnable={handleToggleEnable}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <SyntheticAgentEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        agentToEdit={editingAgent}
        onSaved={refreshAgents}
      />
    </div>
  );
};

// Aliases for backwards compatibility
export const PersonasPage = SyntheticAgentsPage;
export const AgentSandboxPage = SyntheticAgentsPage;
