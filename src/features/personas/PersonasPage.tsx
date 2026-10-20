import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StorageService } from '../../services/storageService';
import { Persona } from '../../types';
import { PersonaEditorModal } from './PersonaEditorModal';
import { 
  Users, 
  Plus, 
  Copy, 
  Trash2, 
  Edit3, 
  Eye, 
  ShieldAlert, 
  Sliders, 
  Compass, 
  EyeOff
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const PersonasPage: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  useEffect(() => {
    setPersonas(StorageService.getPersonas());
  }, []);

  const refreshPersonas = () => {
    setPersonas(StorageService.getPersonas());
  };

  const handleToggleEnable = (persona: Persona, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...persona, enabled: !persona.enabled };
    StorageService.savePersona(updated);
    refreshPersonas();
    toast.info(`Persona "${persona.name}" ${updated.enabled ? 'enabled' : 'disabled'}`);
  };

  const handleDuplicate = (persona: Persona, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: Persona = {
      ...persona,
      id: `persona-${Date.now().toString().slice(-6)}`,
      name: `${persona.name} (Copy)`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.savePersona(duplicated);
    refreshPersonas();
    toast.success(`Duplicated as "${duplicated.name}"`);
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete persona "${name}"?`)) {
      StorageService.deletePersona(id);
      refreshPersonas();
      toast.info(`Persona "${name}" deleted`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Persona Studio</h1>
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
            setEditingPersona(null);
            setIsEditorOpen(true);
          }}
        >
          Create Persona
        </Button>
      </div>

      {/* Notice on Ethical, Non-Stereotyped Personas */}
      <div className="p-3.5 rounded-xl bg-surface-subtle border border-border text-xs text-text-secondary flex items-start gap-2.5">
        <Sliders size={16} className="text-accent-light shrink-0 mt-0.5" />
        <div>
          <strong>Non-Stereotyped Behavioral Modeling:</strong> Veylora UX personas represent functional navigation tendencies, cognitive reading styles, and device contexts. Traits reflect task behavior rather than demographic assumptions.
        </div>
      </div>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {personas.map((persona) => (
          <Card
            key={persona.id}
            className={`flex flex-col justify-between transition-all ${
              !persona.enabled ? 'opacity-60 bg-surface/50' : ''
            }`}
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-subtle shrink-0"
                    style={{ backgroundColor: persona.avatarColor || '#6366F1' }}
                  >
                    {persona.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary leading-tight">
                      {persona.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono mt-0.5">
                      <span>v{persona.version}</span>
                      <span>•</span>
                      <span>{persona.traits.language}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleToggleEnable(persona, e)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      persona.enabled
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                        : 'bg-surface border border-border text-text-muted'
                    }`}
                  >
                    {persona.enabled ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Profile Description */}
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                {persona.shortProfile}
              </p>

              {/* Goals */}
              <div className="p-2.5 rounded-lg bg-surface-subtle border border-border space-y-1.5 text-xs mb-3">
                <div>
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                    Primary Goal
                  </span>
                  <span className="text-text-primary font-medium text-[11px] leading-tight block">
                    {persona.primaryGoal}
                  </span>
                </div>
                {persona.secondaryGoal && (
                  <div className="pt-1.5 border-t border-border">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                      Secondary Verification
                    </span>
                    <span className="text-text-secondary text-[11px] block">
                      {persona.secondaryGoal}
                    </span>
                  </div>
                )}
              </div>

              {/* Trait Pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="outline" size="sm" className="capitalize">
                  {persona.traits.familiarity} familiarity
                </Badge>
                <Badge variant="outline" size="sm" className="capitalize">
                  {persona.traits.patience} patience
                </Badge>
                <Badge variant="outline" size="sm" className="capitalize">
                  {persona.traits.readingTendency}
                </Badge>
                <Badge variant="outline" size="sm" className="capitalize">
                  {persona.traits.navigationConfidence}
                </Badge>
              </div>

              {/* Accessibility & Device */}
              <div className="text-[11px] text-text-muted space-y-1">
                <div className="truncate">
                  <span className="text-text-secondary">Device:</span> {persona.traits.deviceContext}
                </div>
                {persona.traits.accessibilityNeeds.length > 0 && (
                  <div className="truncate text-amber-400">
                    <span>A11y:</span> {persona.traits.accessibilityNeeds.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-[11px] text-text-muted font-mono">
                {persona.isTemplate ? 'Starter Template' : 'Custom'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  title="Edit Persona"
                  onClick={() => {
                    setEditingPersona(persona);
                    setIsEditorOpen(true);
                  }}
                  className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  title="Duplicate Persona"
                  onClick={(e) => handleDuplicate(persona, e)}
                  className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                >
                  <Copy size={13} />
                </button>
                <button
                  title="Delete Persona"
                  onClick={(e) => handleDelete(persona.id, persona.name, e)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <PersonaEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        personaToEdit={editingPersona}
        onSaved={refreshPersonas}
      />
    </div>
  );
};
