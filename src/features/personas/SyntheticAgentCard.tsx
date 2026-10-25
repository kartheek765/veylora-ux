import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SyntheticAgent } from '../../types';
import { Edit3, Copy, Trash2 } from 'lucide-react';

export interface SyntheticAgentCardProps {
  agent: SyntheticAgent;
  onToggleEnable: (agent: SyntheticAgent, e: React.MouseEvent) => void;
  onDuplicate: (agent: SyntheticAgent, e: React.MouseEvent) => void;
  onDelete: (id: string, name: string, e: React.MouseEvent) => void;
  onEdit: (agent: SyntheticAgent) => void;
}

export const SyntheticAgentCard: React.FC<SyntheticAgentCardProps> = ({
  agent,
  onToggleEnable,
  onDuplicate,
  onDelete,
  onEdit,
}) => {
  return (
    <Card
      className={`flex flex-col justify-between transition-all ${
        !agent.enabled ? 'opacity-60 bg-surface/50' : ''
      }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-subtle shrink-0"
              style={{ backgroundColor: agent.avatarColor || '#6366F1' }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary leading-tight">
                {agent.name}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono mt-0.5">
                <span>v{agent.version}</span>
                <span>•</span>
                <span>{agent.traits.language}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => onToggleEnable(agent, e)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                agent.enabled
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'bg-surface border border-border text-text-muted'
              }`}
            >
              {agent.enabled ? 'Active' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Profile Description */}
        <p className="text-xs text-text-secondary leading-relaxed mb-3">
          {agent.shortProfile}
        </p>

        {/* Goals */}
        <div className="p-2.5 rounded-lg bg-surface-subtle border border-border space-y-1.5 text-xs mb-3">
          <div>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
              Primary Goal
            </span>
            <span className="text-text-primary font-medium text-[11px] leading-tight block">
              {agent.primaryGoal}
            </span>
          </div>
          {agent.secondaryGoal && (
            <div className="pt-1.5 border-t border-border">
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                Secondary Verification
              </span>
              <span className="text-text-secondary text-[11px] block">
                {agent.secondaryGoal}
              </span>
            </div>
          )}
        </div>

        {/* Trait Pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" size="sm" className="capitalize">
            {agent.traits.familiarity} familiarity
          </Badge>
          <Badge variant="outline" size="sm" className="capitalize">
            {agent.traits.patience} patience
          </Badge>
          <Badge variant="outline" size="sm" className="capitalize">
            {agent.traits.readingTendency}
          </Badge>
          <Badge variant="outline" size="sm" className="capitalize">
            {agent.traits.navigationConfidence}
          </Badge>
        </div>

        {/* Accessibility & Device */}
        <div className="text-[11px] text-text-muted space-y-1">
          <div className="truncate">
            <span className="text-text-secondary">Device:</span> {agent.traits.deviceContext}
          </div>
          {agent.traits.accessibilityNeeds.length > 0 && (
            <div className="truncate text-amber-400">
              <span>A11y:</span> {agent.traits.accessibilityNeeds.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs">
        <span className="text-[11px] text-text-muted font-mono">
          {agent.isTemplate ? 'Starter Template' : 'Custom Agent'}
        </span>

        <div className="flex items-center gap-1">
          <button
            title="Edit Synthetic Agent"
            onClick={() => onEdit(agent)}
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <Edit3 size={13} />
          </button>
          <button
            title="Duplicate Synthetic Agent"
            onClick={(e) => onDuplicate(agent, e)}
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <Copy size={13} />
          </button>
          <button
            title="Delete Synthetic Agent"
            onClick={(e) => onDelete(agent.id, agent.name, e)}
            className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Card>
  );
};

// Aliases for backwards compatibility and ergonomics
export const AgentCard = SyntheticAgentCard;
export const PersonaCard = SyntheticAgentCard;
