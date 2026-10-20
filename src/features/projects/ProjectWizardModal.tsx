import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { api } from '../../services/api';
import { Project, SourceType, ViewportPreset } from '../../types';
import { Globe, Figma, UploadCloud, Shield, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from '../../components/ui/Toast';

interface ProjectWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('website');
  const [sourceUrl, setSourceUrl] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [viewport, setViewport] = useState<ViewportPreset>('desktop-1440');
  const [notes, setNotes] = useState('');

  // Reset form
  const handleClose = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSourceUrl('');
    setAllowedDomains('');
    setNotes('');
    setIsSubmitting(false);
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error('Project name is required');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!sourceUrl.trim()) {
        toast.error('Source website URL is required');
        return;
      }
      setStep(4);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!sourceUrl.trim()) {
      toast.error('Website URL is required');
      return;
    }

    try {
      setIsSubmitting(true);
      let domainList: string[] = [];
      if (allowedDomains && allowedDomains.trim()) {
        domainList = allowedDomains.split(',').map(d => d.trim()).filter(Boolean);
      } else {
        try {
          const parsed = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`);
          domainList = [parsed.hostname];
        } catch {}
      }

      const created = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        sourceType,
        sourceUrl: sourceUrl.trim(),
        allowedDomains: domainList,
        viewport,
        readinessStatus: 'demo-ready',
        notes: notes.trim()
      });

      toast.success(`Project "${created.name}" created and saved to SQLite`);
      if (onProjectCreated) onProjectCreated(created as any);
      handleClose();
      navigate(`/projects/${created.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create UX Testing Project"
      subtitle={`Step ${step} of 4: ${
        step === 1 ? 'Project Information' : step === 2 ? 'Select Source Type' : step === 3 ? 'Source Configuration' : 'Review & Safety'
      }`}
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 pb-3 border-b border-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === i
                    ? 'bg-accent text-white ring-2 ring-accent/30'
                    : step > i
                    ? 'bg-teal/20 text-teal-light'
                    : 'bg-surface-subtle text-text-muted border border-border'
                }`}
              >
                {step > i ? <Check size={12} /> : i}
              </span>
              <span className={`text-xs hidden sm:inline ${step === i ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                {i === 1 ? 'Info' : i === 2 ? 'Source' : i === 3 ? 'Config' : 'Review'}
              </span>
              {i < 4 && <div className="w-8 h-px bg-border hidden sm:block"></div>}
            </div>
          ))}
        </div>

        {/* Step 1: Info */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Project Name *"
              placeholder="e.g. ApexFlow Cloud Onboarding v2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Textarea
              label="Description & Testing Goal"
              placeholder="Describe the primary journey and intended user audience..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Step 2: Source Type */}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-text-secondary">Choose Source Type</label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  type: 'website',
                  label: 'Authorized Staging Website',
                  desc: 'Run headless browser automation against your authorized staging or localhost endpoint.',
                  icon: Globe,
                },
                {
                  type: 'figma',
                  label: 'Figma Prototype Link',
                  desc: 'Inspect clickable hotspot hierarchy and layout alignment directly from prototype flow.',
                  icon: Figma,
                },
                {
                  type: 'export',
                  label: 'Exported Flow / Screenshots',
                  desc: 'Fallback testing using design system frames and wireframe sequence images.',
                  icon: UploadCloud,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = sourceType === item.type;
                return (
                  <div
                    key={item.type}
                    onClick={() => setSourceType(item.type as SourceType)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-accent/15 border-accent text-text-primary ring-1 ring-accent/30'
                        : 'bg-surface-subtle border-border text-text-secondary hover:border-border-light'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-accent text-white' : 'bg-surface border border-border text-text-muted'}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{item.label}</h4>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Source Configuration */}
        {step === 3 && (
          <div className="space-y-4">
            <Input
              label={sourceType === 'figma' ? 'Figma Prototype Share URL *' : 'Target Staging URL *'}
              placeholder={sourceType === 'figma' ? 'https://figma.com/file/...' : 'https://staging.myapp.com/flow'}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              helperText="Only test environments you have explicit permission to audit."
            />

            <Input
              label="Allowed Domains (comma separated)"
              placeholder="staging.myapp.com, auth.staging.myapp.com"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              helperText="Cross-origin navigation outside these domains is blocked automatically."
            />

            <Select
              label="Primary Viewport Preset"
              value={viewport}
              onChange={(e) => setViewport(e.target.value as ViewportPreset)}
              options={[
                { value: 'desktop-1440', label: 'Desktop (1440 x 900)' },
                { value: 'laptop-1280', label: 'Laptop (1280 x 800)' },
                { value: 'tablet-768', label: 'Tablet (768 x 1024)' },
                { value: 'mobile-390', label: 'Mobile (390 x 844)' },
              ]}
            />
          </div>
        )}

        {/* Step 4: Review & Safety */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Project Name:</span>
                <span className="font-semibold text-text-primary">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Source Type:</span>
                <span className="font-mono text-accent-light uppercase">{sourceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Target Endpoint:</span>
                <span className="font-mono text-text-primary truncate max-w-[250px]">{sourceUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Default Viewport:</span>
                <span className="text-text-primary">{viewport}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
              <Shield size={16} className="shrink-0 mt-0.5" />
              <div>
                <strong>Safety Policy Enforcement:</strong> The browser runner will enforce domain boundaries, block external popups, prevent destructive forms, and redact synthetic credentials from trace logs.
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {step > 1 ? (
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step < 4 ? (
            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />} onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <Button
              variant="teal"
              size="sm"
              leftIcon={<Check size={14} />}
              onClick={handleCreate}
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Create Project
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
