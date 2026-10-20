import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { Scenario, ScenarioStep, StepActionType, Project } from '../../types';
import { 
  GitFork, 
  Sparkles, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const ScenarioBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [naturalGoal, setNaturalGoal] = useState('');
  const [startingUrl, setStartingUrl] = useState('');
  const [successCondition, setSuccessCondition] = useState('');
  const [actionBudget, setActionBudget] = useState(15);
  const [timeBudgetSeconds, setTimeBudgetSeconds] = useState(45);
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [fixtures, setFixtures] = useState<Record<string, string>>({
    email: 'synthetic.user@staging.test',
    password: 'P@ssw0rdSecure!99',
  });
  const [negativePaths, setNegativePaths] = useState({
    missingRequiredField: true,
    invalidFormat: true,
    emptyStateCheck: false,
    backNavigation: true,
    responsiveLayout: false,
  });

  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const pList = await api.getProjects();
        setProjects(pList);

        if (id && id !== 'new') {
          const existing = await api.getScenario(id);
          if (existing) {
            setProjectId(existing.projectId);
            setTitle(existing.title);
            setNaturalGoal(existing.naturalGoal);
            setStartingUrl(existing.startingUrl);
            setSuccessCondition(existing.successCondition);
            setActionBudget(existing.actionBudget);
            setTimeBudgetSeconds(existing.timeBudgetSeconds);
            setSteps(existing.steps || []);
            setFixtures(existing.testDataFixtures || {});
            if (existing.negativePaths) {
              setNegativePaths(Array.isArray(existing.negativePaths) ? (existing.negativePaths[0] || {}) : existing.negativePaths);
            }
            return;
          }
        }

        if (pList.length > 0) {
          setProjectId(pList[0].id);
          setStartingUrl(pList[0].sourceUrl);
        }
      } catch (err: any) {
        console.error('Failed to load builder data:', err);
      }
    }
    loadData();
  }, [id]);

  // AI & Rule-based Backend Plan Generation
  const handleGeneratePlan = async () => {
    if (!naturalGoal.trim()) {
      toast.error('Please describe a task goal first');
      return;
    }
    const currentProject = projects.find(p => p.id === projectId);
    const targetUrl = startingUrl || currentProject?.sourceUrl || '';
    if (!targetUrl) {
      toast.error('Please select a project or specify starting URL');
      return;
    }

    try {
      setIsGeneratingPlan(true);
      const plan = await api.generateScenarioPlan({
        naturalGoal: naturalGoal.trim(),
        startingUrl: targetUrl,
        allowedDomains: currentProject?.allowedDomains,
        actionBudget
      });

      if (plan && Array.isArray(plan.steps) && plan.steps.length > 0) {
        const mappedSteps: ScenarioStep[] = plan.steps.map((st: any, idx: number) => ({
          id: `step-${Date.now()}-${idx + 1}`,
          sequenceNo: idx + 1,
          actionType: (st.actionType || 'click') as StepActionType,
          targetDescription: st.targetDescription || st.description || `Step ${idx + 1}`,
          targetSelector: st.targetSelector || st.selector || '',
          value: st.value || ''
        }));
        setSteps(mappedSteps);
        if (plan.title && !title) setTitle(plan.title);
        if (plan.successCondition && !successCondition) setSuccessCondition(plan.successCondition);
        toast.success(`Synthesized test plan with ${mappedSteps.length} reviewable steps`);
      } else {
        toast.info('Plan generator returned no steps');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate test plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleAddStep = () => {
    const newStep: ScenarioStep = {
      id: `step-${Date.now()}-${steps.length + 1}`,
      sequenceNo: steps.length + 1,
      actionType: 'click',
      targetDescription: 'Click target element',
      targetSelector: 'button.action',
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (index: number, updated: Partial<ScenarioStep>) => {
    setSteps(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updated };
      return copy;
    });
  };

  const handleDeleteStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Scenario title is required');
      return;
    }
    if (!projectId) {
      toast.error('Target project is required');
      return;
    }
    if (!startingUrl.trim()) {
      toast.error('Starting URL is required');
      return;
    }

    try {
      if (id && id !== 'new') {
        await api.updateScenario(id, {
          title: title.trim(),
          naturalGoal: naturalGoal.trim(),
          startingUrl: startingUrl.trim(),
          successCondition: successCondition.trim() || 'Target step reached',
          actionBudget,
          steps
        });
        toast.success(`Scenario "${title}" updated in SQLite database`);
      } else {
        await api.createScenario({
          projectId,
          title: title.trim(),
          naturalGoal: naturalGoal.trim(),
          startingUrl: startingUrl.trim(),
          successCondition: successCondition.trim() || 'Target step reached',
          actionBudget,
          timeBudgetSeconds,
          stopConditions: ['Exceeds action budget', 'Encounter fatal HTTP 500', 'Unapproved origin navigation'],
          steps,
          testDataFixtures: fixtures,
          negativePaths: [negativePaths]
        });
        toast.success(`Scenario "${title}" created and saved to SQLite`);
      }
      navigate('/scenarios');
    } catch (err: any) {
      toast.error(err.message || 'Failed to persist scenario');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/scenarios">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />}>
              Scenarios
            </Button>
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {id && id !== 'new' ? 'Edit Scenario' : 'Scenario Builder'}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Author deterministic journey plans, fixtures, and negative path checks
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleSave}>
          Save Scenario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Natural Goal & Plan Generator */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="1. Task Framing & Natural Language Goal"
              subtitle="Describe the user's intended objective"
            />
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Scenario Title *"
                  placeholder="e.g. Developer Signup to Workspace Provisioning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <Select
                  label="Assign to Project *"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    const p = projects.find(proj => proj.id === e.target.value);
                    if (p) setStartingUrl(p.sourceUrl);
                  }}
                  options={projects.map(p => ({ value: p.id, label: `${p.name} (${p.sourceType})` }))}
                />
              </div>

              <Textarea
                label="Natural Language Task Goal *"
                placeholder="e.g. From the landing page, click Get Started, complete signup form with fake credentials, and verify organization dashboard loads."
                value={naturalGoal}
                onChange={(e) => setNaturalGoal(e.target.value)}
                rows={3}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Starting URL / Entry Point *"
                  value={startingUrl}
                  onChange={(e) => setStartingUrl(e.target.value)}
                  placeholder="https://staging.app.local/signup"
                />

                <Input
                  label="Success Condition *"
                  value={successCondition}
                  onChange={(e) => setSuccessCondition(e.target.value)}
                  placeholder="URL contains /dashboard and visible text 'Welcome'"
                />
              </div>

              {/* Generate Plan Button */}
              <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-accent-light" />
                    <span className="text-xs font-semibold text-text-primary">
                      Synthesize Test Plan
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Decomposes natural language goal into an ordered sequence of verifiable browser interactions.
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isGeneratingPlan}
                  onClick={handleGeneratePlan}
                  className="shrink-0"
                >
                  Generate Test Plan
                </Button>
              </div>
            </div>
          </Card>

          {/* Ordered Action Steps Editor */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardHeader
                title={`2. Reviewable Action Plan (${steps.length} Steps)`}
                subtitle="Deterministic browser interaction sequence"
                className="mb-0"
              />
              <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />} onClick={handleAddStep}>
                Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl text-text-muted text-xs">
                No steps defined yet. Click "Generate Test Plan" above or "Add Step".
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((st, idx) => (
                  <div
                    key={st.id || idx}
                    className="p-3.5 rounded-xl bg-surface-subtle border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-xs font-mono font-semibold text-accent-light shrink-0">
                        {idx + 1}
                      </span>

                      <div className="w-32 shrink-0">
                        <select
                          value={st.actionType}
                          onChange={(e) => handleUpdateStep(idx, { actionType: e.target.value as StepActionType })}
                          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary"
                        >
                          <option value="navigate">navigate</option>
                          <option value="click">click</option>
                          <option value="type_test_data">fill / type</option>
                          <option value="wait_for_visible">wait_for_visible</option>
                          <option value="verify_text">assert text</option>
                          <option value="assert_visible">assert visible</option>
                          <option value="assert_url">assert url</option>
                          <option value="select">select option</option>
                          <option value="check">check checkbox</option>
                          <option value="scroll">scroll</option>
                          <option value="capture_screenshot">capture screenshot</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        value={st.targetDescription}
                        onChange={(e) => handleUpdateStep(idx, { targetDescription: e.target.value })}
                        placeholder="Action description..."
                        className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary"
                      />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <input
                        type="text"
                        value={st.targetSelector || ''}
                        onChange={(e) => handleUpdateStep(idx, { targetSelector: e.target.value })}
                        placeholder="Selector (e.g. #submit-btn)"
                        className="w-36 bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-text-muted"
                      />
                      <button
                        onClick={() => handleDeleteStep(idx)}
                        className="p-1 rounded text-text-muted hover:text-red-400"
                        title="Delete step"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Execution Budgets, Fixtures, Negative Paths */}
        <div className="space-y-5">
          {/* Action and Time Budgets */}
          <Card>
            <CardHeader title="Execution Limits" subtitle="Loop prevention boundaries" />
            <div className="space-y-3">
              <Input
                label="Maximum Action Budget"
                type="number"
                value={actionBudget}
                onChange={(e) => setActionBudget(Number(e.target.value))}
                helperText="Runner aborts if goal not met within this action count."
              />
              <Input
                label="Timeout Budget (Seconds)"
                type="number"
                value={timeBudgetSeconds}
                onChange={(e) => setTimeBudgetSeconds(Number(e.target.value))}
              />
            </div>
          </Card>

          {/* Negative Path Settings */}
          <Card>
            <CardHeader title="Negative Path Testing" subtitle="Validate edge case resilience" />
            <div className="space-y-2.5 text-xs">
              {[
                { key: 'missingRequiredField', label: 'Missing Required Field Injection' },
                { key: 'invalidFormat', label: 'Malformed Format Validation' },
                { key: 'emptyStateCheck', label: 'Empty State Resilience Check' },
                { key: 'backNavigation', label: 'Browser Back Button Integrity' },
                { key: 'responsiveLayout', label: 'Narrow Viewport Clipping Check' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2.5 cursor-pointer text-text-secondary hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={(negativePaths as any)[item.key]}
                    onChange={(e) => setNegativePaths(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="rounded accent-accent"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </Card>

          {/* Test Data Fixtures */}
          <Card>
            <CardHeader title="Synthetic Test Fixtures" subtitle="Sanitized mock values" />
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-surface-subtle border border-border font-mono text-[11px] space-y-1">
                <div>email: synthetic.user@staging.test</div>
                <div>password: •••••••••••• (P@ssw0rdSecure!99)</div>
                <div>company: Synthetica Labs Inc</div>
              </div>
              <p className="text-[11px] text-text-muted">
                Synthetic fixtures are injected safely without recording real user keystrokes.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
