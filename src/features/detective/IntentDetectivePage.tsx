import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  ExternalLink, 
  Layers, 
  HelpCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Eye,
  Sliders,
  History
} from 'lucide-react';
import { api } from '../../services/api';
import { StorageService } from '../../services/storageService';
import { Project, DetectiveInvestigation, DetectiveJourneyStep, DetectiveDiagnosis } from '../../types';

export const IntentDetectivePage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [naturalGoal, setNaturalGoal] = useState<string>('');
  const [startingUrl, setStartingUrl] = useState<string>('');
  
  // Investigation state
  const [currentInvestigation, setCurrentInvestigation] = useState<DetectiveInvestigation | null>(null);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRetesting, setIsRetesting] = useState(false);
  const [pastInvestigations, setPastInvestigations] = useState<DetectiveInvestigation[]>([]);
  const [activeTab, setActiveTab] = useState<'workbench' | 'history'>('workbench');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Template quick-goals
  const sampleGoals = [
    {
      title: 'Product Checkout Journey',
      goal: 'A new customer should find a product and reach checkout',
      category: 'E-Commerce'
    },
    {
      title: 'Contact Form Submission',
      goal: 'A visitor should submit a contact form successfully',
      category: 'Lead Gen'
    },
    {
      title: 'Account Registration',
      goal: 'A user should be able to create an account and reach dashboard',
      category: 'Onboarding'
    },
    {
      title: 'Order Status Lookup',
      goal: 'A returning customer should find their order information',
      category: 'Self-Serve'
    }
  ];

  // 1. Initial Load: Projects
  useEffect(() => {
    async function loadProjects() {
      try {
        let res = await api.getProjects();
        if (!Array.isArray(res) || res.length === 0) {
          res = StorageService.getProjects();
        }
        if (Array.isArray(res) && res.length > 0) {
          setProjects(res);
          setSelectedProjectId(res[0].id);
          setStartingUrl(res[0].sourceUrl || 'https://staging.apexflow.dev/signup');
        }
      } catch (err) {
        const local = StorageService.getProjects();
        if (local.length > 0) {
          setProjects(local);
          setSelectedProjectId(local[0].id);
          setStartingUrl(local[0].sourceUrl || 'https://staging.apexflow.dev/signup');
        }
      }
    }
    loadProjects();
  }, []);

  // 2. Load Past Investigations for selected project
  useEffect(() => {
    if (!selectedProjectId) return;
    loadInvestigations(selectedProjectId);
    const proj = projects.find(p => p.id === selectedProjectId);
    if (proj?.sourceUrl) setStartingUrl(proj.sourceUrl);
  }, [selectedProjectId, projects]);

  async function loadInvestigations(projectId: string) {
    try {
      const res = await api.listDetectiveInvestigations(projectId);
      if (res?.investigations) {
        setPastInvestigations(res.investigations);
      }
    } catch (e) {
      console.warn('Error loading detective investigations:', e);
    }
  }

  // 3. Synthesize Journey Spec
  async function handleSynthesizeSpec(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!naturalGoal.trim() || !selectedProjectId) return;

    setErrorMsg(null);
    setIsGeneratingSpec(true);
    try {
      const res = await api.createDetectiveSpec({
        projectId: selectedProjectId,
        naturalGoal: naturalGoal.trim(),
        startingUrl: startingUrl.trim() || undefined
      });

      if (res?.success && res.investigation) {
        setCurrentInvestigation(res.investigation);
      } else {
        setErrorMsg(res?.error || 'Failed to generate journey specification');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error while generating specification');
    } finally {
      setIsGeneratingSpec(false);
    }
  }

  // 4. Approve & Execute Investigation
  async function handleApproveAndExecute() {
    if (!currentInvestigation) return;
    setErrorMsg(null);
    setIsExecuting(true);

    try {
      // Step A: Approve
      await api.approveDetectiveInvestigation(currentInvestigation.id);

      // Step B: Execute Playwright Runner
      const res = await api.executeDetectiveInvestigation(currentInvestigation.id);
      if (res?.success && res.investigation) {
        setCurrentInvestigation(res.investigation);
        await loadInvestigations(selectedProjectId);
      } else {
        setErrorMsg(res?.error || 'Execution encountered an error');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }

  // 5. Retest Proposed Fix (Before / After Comparison)
  async function handleRetest(baselineId: string) {
    setErrorMsg(null);
    setIsRetesting(true);
    try {
      const retestRes = await api.retestDetectiveInvestigation(baselineId);
      if (retestRes?.success && retestRes.retestInvestigation) {
        setCurrentInvestigation(retestRes.retestInvestigation);
        
        // Auto execute retest
        const execRes = await api.executeDetectiveInvestigation(retestRes.retestInvestigation.id);
        if (execRes?.success && execRes.investigation) {
          setCurrentInvestigation(execRes.investigation);
          await loadInvestigations(selectedProjectId);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Retest failed');
    } finally {
      setIsRetesting(false);
    }
  }

  // Helper parsers
  const steps: DetectiveJourneyStep[] = currentInvestigation
    ? JSON.parse(currentInvestigation.ordered_steps_json || '[]')
    : [];
  const preconditions: string[] = currentInvestigation
    ? JSON.parse(currentInvestigation.preconditions_json || '[]')
    : [];
  const expectedOutcomes: string[] = currentInvestigation
    ? JSON.parse(currentInvestigation.expected_outcomes_json || '[]')
    : [];
  const failureConditions: string[] = currentInvestigation
    ? JSON.parse(currentInvestigation.failure_conditions_json || '[]')
    : [];
  const diagnosis: DetectiveDiagnosis | null = currentInvestigation?.diagnosis_json
    ? JSON.parse(currentInvestigation.diagnosis_json)
    : null;

  return (
    <div className="min-h-screen bg-[#07090E] text-text-primary p-6 md:p-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center text-accent-light shadow-sm">
              <Sparkles size={18} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Intent-to-Failure Detective
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-gradient-to-r from-accent/20 to-teal/20 text-accent-light border border-accent/30 font-semibold tracking-wider">
                Signature Feature
              </span>
            </h1>
          </div>
          <p className="text-xs md:text-sm text-text-muted max-w-3xl">
            Test whether user-defined website journeys actually complete. If a flow breaks, the Detective pinpoints the exact failure step, collects Playwright evidence, distinguishes verified facts from hypotheses, and validates before/after fixes.
          </p>
        </div>

        {/* Project Selector & Tab Switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#111722] border border-border/80 rounded-lg p-1 text-xs">
            <button
              onClick={() => setActiveTab('workbench')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'workbench'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Detective Workbench
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <History size={13} />
              History ({pastInvestigations.length})
            </button>
          </div>

          <div className="min-w-[180px]">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-[#111722] border border-border/80 rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. TAB: WORKBENCH */}
      {activeTab === 'workbench' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Goal Formulation & Spec Review */}
          <div className="lg:col-span-6 space-y-6">
            {/* Step A: Goal Formulator */}
            <div className="bg-[#0B0F17] border border-border/80 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-accent/20 text-accent-light text-[11px] font-bold flex items-center justify-center">1</span>
                  <h2 className="text-sm font-semibold text-white">Define Natural Language Goal</h2>
                </div>
                <span className="text-[11px] text-text-muted">Safe sandbox fixtures enforced</span>
              </div>

              {/* Sample Quick Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Quick Goal Templates</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleGoals.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNaturalGoal(sample.goal)}
                      className="text-left p-2.5 rounded-xl bg-[#111722]/70 hover:bg-[#18212F] border border-border/50 hover:border-accent/40 transition-all group"
                    >
                      <div className="text-[10px] font-mono text-accent-light uppercase">{sample.category}</div>
                      <div className="text-xs text-text-secondary group-hover:text-white font-medium line-clamp-1">{sample.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal Input Form */}
              <form onSubmit={handleSynthesizeSpec} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    What should the user be able to accomplish?
                  </label>
                  <textarea
                    rows={2}
                    value={naturalGoal}
                    onChange={(e) => setNaturalGoal(e.target.value)}
                    placeholder="e.g. A new customer should find a product and reach checkout"
                    className="w-full bg-[#111722] border border-border/80 rounded-xl p-3 text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Starting URL
                  </label>
                  <input
                    type="url"
                    value={startingUrl}
                    onChange={(e) => setStartingUrl(e.target.value)}
                    placeholder="https://staging.apexflow.dev/signup"
                    className="w-full bg-[#111722] border border-border/80 rounded-xl px-3 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!naturalGoal.trim() || isGeneratingSpec}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {isGeneratingSpec ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Synthesizing Journey Specification...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Synthesize Structured Journey Spec
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Step B: Proposed Journey Spec Review */}
            {currentInvestigation && (
              <div className="bg-[#0B0F17] border border-border/80 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal/20 text-teal text-[11px] font-bold flex items-center justify-center">2</span>
                    <h2 className="text-sm font-semibold text-white">Review Journey Specification</h2>
                  </div>
                  <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                    currentInvestigation.status === 'draft'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {currentInvestigation.status}
                  </span>
                </div>

                {/* Consequential Action Safety Warning */}
                {Boolean(currentInvestigation.has_consequential_actions) && (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <ShieldCheck size={14} />
                      <span>Consequential Journey Safeguard Active</span>
                    </div>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      {currentInvestigation.consequential_warning || 'This journey touches checkout, payment forms, or state mutation. Non-destructive sandbox test fixtures are used.'}
                    </p>
                  </div>
                )}

                {/* Preconditions */}
                {preconditions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-text-muted uppercase">Preconditions & Assumptions</span>
                    <ul className="text-xs text-text-secondary space-y-1 pl-1">
                      {preconditions.map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-border-light shrink-0 mt-1.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ordered Steps Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted uppercase">
                    <span>Ordered Journey Steps ({steps.length})</span>
                    <span>Max Budget: {currentInvestigation.execution_budget} Actions</span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {steps.map((st) => (
                      <div key={st.stepNumber} className="p-2.5 rounded-xl bg-[#111722]/80 border border-border/50 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-accent-light px-1.5 py-0.2 rounded bg-accent/20">
                              Step {st.stepNumber}
                            </span>
                            <span className="text-[11px] uppercase font-mono text-teal">{st.actionType}</span>
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary">{st.description}</p>
                        <div className="text-[11px] font-mono text-text-muted truncate">
                          Target: <code className="text-amber-200/80">{st.selectorOrTarget}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Trigger */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleApproveAndExecute}
                    disabled={isExecuting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-accent to-teal hover:opacity-95 text-white text-xs font-bold shadow-lg transition-all disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Running Playwright Investigation...
                      </>
                    ) : (
                      <>
                        <Play size={15} />
                        Approve & Investigate Goal with Playwright
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-text-muted mt-2">
                    Explicit confirmation: No real payments, emails, or destructive actions will be dispatched.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Evidence-Backed Diagnosis & Verified Retest */}
          <div className="lg:col-span-6 space-y-6">
            {currentInvestigation && currentInvestigation.status === 'completed' ? (
              <div className="space-y-6">
                {/* Result Card: Failure or Goal Achieved */}
                {currentInvestigation.outcome === 'GOAL_ACHIEVED' ? (
                  <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Journey Goal Achieved</h3>
                        <p className="text-xs text-emerald-300/90">All journey steps executed and verified without blockers.</p>
                      </div>
                    </div>
                    {currentInvestigation.retest_status === 'RESOLVED' && (
                      <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                        <span>Verified Fix: Prior baseline failure was resolved by this retest.</span>
                      </div>
                    )}
                  </div>
                ) : currentInvestigation.outcome === 'INCONCLUSIVE_BLOCKED' ? (
                  <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-700/50 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center">
                        <HelpCircle size={22} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Inconclusive / Blocked Run</h3>
                        <p className="text-xs text-zinc-400">Target host timed out or blocked automation. Not counted as a confirmed UX defect.</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary bg-[#111722] p-3 rounded-xl border border-border/40 font-mono">
                      {currentInvestigation.observed_defect_summary}
                    </p>
                  </div>
                ) : (
                  /* Failure Detected: Full Evidence-Backed Diagnosis Card */
                  <div className="bg-[#0B0F17] border border-red-500/40 rounded-2xl p-6 shadow-xl space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                            Failure Detected
                          </span>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-semibold ${
                            diagnosis?.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : diagnosis?.verificationStatus === 'STRONGLY_SUPPORTED'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          }`}>
                            {diagnosis?.verificationStatus === 'VERIFIED' ? 'Verified Fact' : 'AI Hypothesis'}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-text-muted">
                            {diagnosis?.confidence || 'High'} Confidence
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          Broke at Step {currentInvestigation.breaking_step_index}
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {currentInvestigation.breaking_action_summary}
                        </p>
                      </div>
                    </div>

                    {/* Problem Description */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase">Concise Problem Description</span>
                      <p className="text-xs text-red-200/90 bg-red-950/20 p-3 rounded-xl border border-red-500/20 font-medium">
                        {diagnosis?.problemDescription || currentInvestigation.observed_defect_summary}
                      </p>
                    </div>

                    {/* Observed Facts */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase">Observed Facts & Reproducibility</span>
                      <p className="text-xs text-text-secondary bg-[#111722] p-3 rounded-xl border border-border/50">
                        {diagnosis?.observedFacts}
                      </p>
                      <div className="text-[11px] text-text-muted pt-1">
                        Environment: <span className="font-mono text-text-secondary">{diagnosis?.reproducibility}</span>
                      </div>
                    </div>

                    {/* Likely Root Cause */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Likely Root Cause</span>
                        <span className="text-[10px] text-amber-400 font-mono">
                          {diagnosis?.isHypothesis ? '(Unverified Hypothesis)' : '(Verified Objective Cause)'}
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/90 bg-amber-950/20 p-3 rounded-xl border border-amber-500/20">
                        {diagnosis?.likelyRootCause}
                      </p>
                    </div>

                    {/* Suggested Fix */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-text-muted uppercase">Suggested Developer Fix</span>
                      <p className="text-xs text-teal/90 bg-teal/10 p-3 rounded-xl border border-teal/20">
                        {diagnosis?.suggestedFix}
                      </p>
                    </div>

                    {/* Retest & Roadmap Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => handleRetest(currentInvestigation.id)}
                        disabled={isRetesting}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                      >
                        {isRetesting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Executing Retest...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} />
                            Retest Proposed Fix
                          </>
                        )}
                      </button>

                      <a
                        href="/roadmap"
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#111722] hover:bg-[#18212F] border border-border text-xs text-text-secondary hover:text-white font-medium transition-all"
                      >
                        <Sliders size={14} />
                        View Roadmap
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Idle Empty State */
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[#0B0F17]/50 border border-border/40 border-dashed text-text-muted space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#111722] border border-border flex items-center justify-center text-text-muted">
                  <Search size={22} />
                </div>
                <div className="max-w-sm space-y-1">
                  <h3 className="text-sm font-semibold text-white">No Active Investigation Yet</h3>
                  <p className="text-xs text-text-muted">
                    Formulate a natural language website goal on the left or select a template to synthesize a journey specification and run the Detective.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TAB: HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-[#0B0F17] border border-border/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History size={18} className="text-accent-light" />
              Investigation Journey History
            </h2>
            <span className="text-xs text-text-muted font-mono">{pastInvestigations.length} runs recorded</span>
          </div>

          {pastInvestigations.length === 0 ? (
            <div className="p-12 text-center text-text-muted text-xs">
              No investigations recorded yet for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {pastInvestigations.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => {
                    setCurrentInvestigation(inv);
                    setActiveTab('workbench');
                  }}
                  className="p-4 rounded-xl bg-[#111722]/80 hover:bg-[#18212F] border border-border/60 hover:border-accent/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-semibold ${
                        inv.outcome === 'GOAL_ACHIEVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : inv.outcome === 'FAILURE_DETECTED'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-zinc-800 text-text-muted border-border'
                      }`}>
                        {inv.outcome || inv.status}
                      </span>
                      {inv.retest_status && (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-accent/20 text-accent-light border border-accent/30 font-semibold">
                          {inv.retest_status}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">
                        {new Date(inv.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-accent-light transition-colors">
                      {inv.natural_goal}
                    </h4>
                    <p className="text-xs text-text-muted line-clamp-1">
                      {inv.observed_defect_summary || 'All journey steps completed successfully.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#18212F] group-hover:bg-accent text-xs font-medium text-white transition-colors flex items-center gap-1"
                    >
                      <span>Inspect Diagnosis</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
