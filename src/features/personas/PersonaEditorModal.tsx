import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StorageService } from '../../services/storageService';
import { Persona, FamiliarityLevel, PatienceLevel, ReadingTendency, NavigationConfidence } from '../../types';
import { toast } from '../../components/ui/Toast';

interface PersonaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  personaToEdit?: Persona | null;
  onSaved: () => void;
}

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({
  isOpen,
  onClose,
  personaToEdit,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [shortProfile, setShortProfile] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('');
  const [secondaryGoal, setSecondaryGoal] = useState('');
  const [familiarity, setFamiliarity] = useState<FamiliarityLevel>('moderate');
  const [patience, setPatience] = useState<PatienceLevel>('medium');
  const [readingTendency, setReadingTendency] = useState<ReadingTendency>('skimmer');
  const [navigationConfidence, setNavigationConfidence] = useState<NavigationConfidence>('confident');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [deviceContext, setDeviceContext] = useState('Desktop Chrome 128 (Windows 11)');
  const [language, setLanguage] = useState('English (US)');
  const [constraints, setConstraints] = useState('');

  useEffect(() => {
    if (personaToEdit) {
      setName(personaToEdit.name);
      setShortProfile(personaToEdit.shortProfile);
      setPrimaryGoal(personaToEdit.primaryGoal);
      setSecondaryGoal(personaToEdit.secondaryGoal || '');
      setFamiliarity(personaToEdit.traits.familiarity);
      setPatience(personaToEdit.traits.patience);
      setReadingTendency(personaToEdit.traits.readingTendency);
      setNavigationConfidence(personaToEdit.traits.navigationConfidence);
      setAccessibilityNeeds(personaToEdit.traits.accessibilityNeeds.join(', '));
      setDeviceContext(personaToEdit.traits.deviceContext);
      setLanguage(personaToEdit.traits.language);
      setConstraints(personaToEdit.traits.constraints || '');
    } else {
      setName('');
      setShortProfile('');
      setPrimaryGoal('');
      setSecondaryGoal('');
      setFamiliarity('moderate');
      setPatience('medium');
      setReadingTendency('skimmer');
      setNavigationConfidence('confident');
      setAccessibilityNeeds('');
      setDeviceContext('Desktop Chrome (1440x900)');
      setLanguage('English (US)');
      setConstraints('');
    }
  }, [personaToEdit, isOpen]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Persona name is required');
      return;
    }
    if (!primaryGoal.trim()) {
      toast.error('Primary goal is required');
      return;
    }

    const needsArray = accessibilityNeeds
      ? accessibilityNeeds.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const persona: Persona = {
      id: personaToEdit ? personaToEdit.id : `persona-${Date.now().toString().slice(-6)}`,
      name,
      shortProfile,
      primaryGoal,
      secondaryGoal: secondaryGoal || undefined,
      traits: {
        familiarity,
        patience,
        readingTendency,
        navigationConfidence,
        accessibilityNeeds: needsArray,
        deviceContext,
        language,
        constraints: constraints || undefined,
      },
      enabled: personaToEdit ? personaToEdit.enabled : true,
      version: personaToEdit ? personaToEdit.version + 1 : 1,
      createdAt: personaToEdit ? personaToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.savePersona(persona);
    toast.success(`Persona "${persona.name}" saved (v${persona.version})`);
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={personaToEdit ? `Edit Persona: ${personaToEdit.name}` : 'Create Synthetic Persona'}
      subtitle="Define behavioral tendencies, accessibility needs, and task motivations"
      maxWidth="xl"
    >
      <div className="space-y-4">
        <Input
          label="Persona Name & Identifier *"
          placeholder="e.g. Cautious Buyer (Sarah)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Textarea
          label="Short Behavioral Profile *"
          placeholder="Describe how this persona navigates interfaces and handles ambiguous UX prompts..."
          value={shortProfile}
          onChange={(e) => setShortProfile(e.target.value)}
          rows={2}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Primary Task Goal *"
            placeholder="e.g. Reach workspace checkout"
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value)}
          />
          <Input
            label="Secondary / Validation Goal"
            placeholder="e.g. Verify tax invoice download"
            value={secondaryGoal}
            onChange={(e) => setSecondaryGoal(e.target.value)}
          />
        </div>

        {/* Behavioral Traits Grid */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-3">
          <span className="text-xs font-semibold text-text-primary block">
            Behavioral Parameters (Task-Oriented Traits)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Domain Familiarity"
              value={familiarity}
              onChange={(e) => setFamiliarity(e.target.value as FamiliarityLevel)}
              options={[
                { value: 'novice', label: 'Novice (First-time / Hesitant)' },
                { value: 'moderate', label: 'Moderate (Standard SaaS user)' },
                { value: 'expert', label: 'Expert (High power user)' },
              ]}
            />

            <Select
              label="Patience Level"
              value={patience}
              onChange={(e) => setPatience(e.target.value as PatienceLevel)}
              options={[
                { value: 'low', label: 'Low (Abandons quickly on delay)' },
                { value: 'medium', label: 'Medium (Tolerates 1-2 retries)' },
                { value: 'high', label: 'High (Methodically investigates)' },
              ]}
            />

            <Select
              label="Reading Tendency"
              value={readingTendency}
              onChange={(e) => setReadingTendency(e.target.value as ReadingTendency)}
              options={[
                { value: 'skimmer', label: 'Skimmer (Scans CTA labels only)' },
                { value: 'methodical', label: 'Methodical (Reads helper copy)' },
                { value: 'minimalist', label: 'Minimalist (Relies on icons)' },
              ]}
            />

            <Select
              label="Navigation Confidence"
              value={navigationConfidence}
              onChange={(e) => setNavigationConfidence(e.target.value as NavigationConfidence)}
              options={[
                { value: 'hesitant', label: 'Hesitant (Needs confirmation)' },
                { value: 'exploratory', label: 'Exploratory (Tries alternate paths)' },
                { value: 'confident', label: 'Confident (Direct shortest path)' },
              ]}
            />
          </div>
        </div>

        {/* Environmental Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Device & Viewport Context"
            placeholder="e.g. MacBook Air Safari 17"
            value={deviceContext}
            onChange={(e) => setDeviceContext(e.target.value)}
          />
          <Input
            label="Locale / Language"
            placeholder="e.g. English (US)"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>

        <Input
          label="Accessibility-Related Needs (comma separated)"
          placeholder="High contrast buttons, Keyboard-only navigation, Explicit ARIA labels"
          value={accessibilityNeeds}
          onChange={(e) => setAccessibilityNeeds(e.target.value)}
          helperText="Tested signals generate accessibility heuristic findings, not full WCAG compliance certifications."
        />

        <Input
          label="Scenario-Specific Negative Constraints"
          placeholder="e.g. Will abandon if credit card requested before trial terms"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {personaToEdit ? 'Save Changes' : 'Create Persona'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
