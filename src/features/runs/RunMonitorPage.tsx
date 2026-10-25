import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { Run, Project, SyntheticAgent, Scenario, Finding, EvidenceItem, ActionEvent } from '../../types';
import { 
  Square, 
  ArrowLeft, 
  Clock, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Terminal, 
  ExternalLink,
  Layers,
  Camera,
  XCircle,
  HelpCircle,
  Ban
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const RunMonitorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<Run | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [syntheticAgents, setSyntheticAgents] = useState<SyntheticAgent[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loading, setLoading] = useState(true);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRunData = async (isInitial = false) => {
    if (!id) return;
    try {
      if (isInitial) setLoading(true);
      const data = await api.getRun(id);
      if (!data || !data.run) {
        if (isInitial) {
          toast.error('Run record not found in database');
          navigate('/runs');
        }
        return;
      }

      setRun(data.run);
      setEvents(data.events || []);
      setFindings(data.findings || []);
      const evList: EvidenceItem[] = data.evidence || [];
      setEvidenceList(evList);

      if (evList.length > 0) {
        setSelectedEvidence(prev => {
          if (!prev) return evList[evList.length - 1];
          const exists = evList.find(e => e.id === prev.id);
          return exists || evList[evList.length - 1];
        });
      }

      // Load linked project if not already loaded
      if (data.run.projectId && !project) {
        const p = await api.getProject(data.run.projectId);
        setProject(p);
      }

      return data.run;
    } catch (err: any) {
      console.warn('Failed to poll run details:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const initialRun = await fetchRunData(true);
      if (!isMounted || !initialRun) return;

      const isTerminal = (st: string) => 
        st === 'completed' || st === 'passed' || st === 'failed' || st === 'cancelled' || st === 'blocked' || st === 'inconclusive';

      if (!isTerminal(initialRun.status)) {
        pollTimerRef.current = setInterval(async () => {
          const updated = await fetchRunData(false);
          if (updated && isTerminal(updated.status)) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }, 1200);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Loading live execution record from local backend...</p>
      </div>
    );
  }

  if (!run) return null;

  const isLive = run.status === 'queued' || run.status === 'running' || run.status === 'preparing' || run.status === 'validating' || run.status === 'capturing' || run.status === 'analyzing';

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      toast.info('Requesting worker execution halt...');
      await api.cancelRun(run.id);
      toast.info('Run cancelled');
      await fetchRunData(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel run');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = () => {
    switch (run.status) {
      case 'running':
        return (
          <Badge variant="teal" size="sm">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse"></span>
              <span>Running Playwright</span>
            </span>
          </Badge>
        );
      case 'queued':
      case 'preparing':
      case 'validating':
        return (
          <Badge variant="indigo" size="sm">
            <span className="capitalize">{run.status}</span>
          </Badge>
        );
      case 'completed':
      case 'passed' as any:
        return (
          <Badge variant="teal" size="sm">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>Passed</span>
            </span>
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="critical" size="sm">
            <span className="flex items-center gap-1">
              <XCircle size={12} />
              <span>Failed</span>
            </span>
          </Badge>
        );
      case 'blocked':
        return (
          <Badge variant="critical" size="sm">
            <span className="flex items-center gap-1">
              <Ban size={12} />
              <span>Blocked</span>
            </span>
          </Badge>
        );
      case 'inconclusive' as any:
        return (
          <Badge variant="medium" size="sm">
            <span className="flex items-center gap-1">
              <HelpCircle size={12} />
              <span>Inconclusive</span>
            </span>
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="neutral" size="sm">
            <span>Cancelled</span>
          </Badge>
        );
      default:
        return <Badge variant="default" size="sm">{run.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/runs">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />}>
              Runs Queue
            </Button>
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-text-primary">{run.id}</h1>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Project: <strong className="text-text-secondary">{project?.name || run.projectId}</strong> • Engine: <span className="font-mono">{run.browser} ({run.viewport})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Square size={13} fill="currentColor" />}
              onClick={handleCancel}
              isLoading={isCancelling}
              disabled={isCancelling}
            >
              Stop Execution
            </Button>
          ) : (
            <Link to="/reports">
              <Button size="sm" variant="secondary">
                View Reports
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Progress & Telemetry Strip */}
      <div className="p-4 rounded-xl bg-surface-card border border-border space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-text-secondary">
            <span>Progress: <strong>Step {run.currentStepIndex} of {run.totalSteps || 1}</strong></span>
            <span>•</span>
            <span>Actions: {run.actionsExecuted} / {run.actionBudget}</span>
          </div>
          <div className="flex items-center gap-4 text-text-muted font-mono text-xs">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {run.durationSeconds}s
            </span>
            <span className={run.consoleErrorsCount > 0 ? 'text-red-400' : 'text-text-muted'}>
              Console Errors: {run.consoleErrorsCount}
            </span>
            <span className={run.networkErrorsCount > 0 ? 'text-amber-400' : 'text-text-muted'}>
              Network Errors: {run.networkErrorsCount}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              run.status === 'failed' || run.taskOutcome === 'blocked'
                ? 'bg-red-500'
                : run.status === 'completed'
                ? 'bg-teal'
                : 'bg-accent'
            }`}
            style={{ 
              width: run.totalSteps > 0 
                ? `${Math.min(100, Math.round((run.currentStepIndex / run.totalSteps) * 100))}%` 
                : isLive ? '50%' : '100%' 
            }}
          ></div>
        </div>
      </div>

      {/* Main 2-Column Monitor: Action Timeline + Browser Viewport Window */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Ordered Action Event Trace */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader
              title={`Execution Trace Timeline (${events.length} Steps)`}
              subtitle="Ordered sequence of actual browser interactions & assertions"
            />
            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
              {events.length === 0 ? (
                <div className="text-center py-12 text-xs text-text-muted">
                  {isLive ? (
                    <div className="space-y-2">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                      <p>Launching browser & navigating to target URL...</p>
                    </div>
                  ) : (
                    'No action events recorded for this run.'
                  )}
                </div>
              ) : (
                events.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="p-3 rounded-lg bg-surface-subtle border border-border text-xs space-y-1.5 hover:border-border-light transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-mono font-bold text-accent-light">
                          {event.sequenceNo}
                        </span>
                        <span className="font-mono text-text-primary uppercase font-bold text-[10px]">
                          {event.actionType}
                        </span>
                      </div>
                      <Badge
                        variant={
                          event.result === 'success'
                            ? 'teal'
                            : event.result === 'blocked'
                            ? 'critical'
                            : event.result === 'friction'
                            ? 'critical'
                            : 'medium'
                        }
                        size="sm"
                      >
                        {event.result}
                      </Badge>
                    </div>

                    <p className="text-text-secondary font-medium leading-tight">
                      {event.targetSummary}
                    </p>

                    {event.observedStateChange && (
                      <p className="text-[11px] text-text-muted font-mono leading-tight bg-surface/50 p-1.5 rounded truncate">
                        {event.observedStateChange}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                      <span className="truncate max-w-[180px]">{event.url}</span>
                      <span className="font-mono">{event.durationMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (7 cols): Real Browser Viewport / Evidence Window */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="h-full flex flex-col p-0 overflow-hidden border-border">
            {/* Browser Window Header Chrome */}
            <div className="bg-surface-subtle border-b border-border px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-teal/80"></span>
              </div>

              {/* Real URL Bar */}
              <div className="flex-1 max-w-md mx-3 px-3 py-1 rounded-md bg-surface border border-border text-[11px] font-mono text-text-secondary truncate flex items-center gap-1.5">
                <Globe size={11} className="text-teal shrink-0" />
                <span className="truncate">
                  {selectedEvidence?.url || (events.length > 0 ? events[events.length - 1].url : project?.sourceUrl) || 'Target Browser Viewport'}
                </span>
              </div>

              <div className="text-[10px] text-text-muted font-mono">
                {run.viewport} (Playwright)
              </div>
            </div>

            {/* Viewport Frame with Real Playwright Screenshot */}
            <div className="flex-1 min-h-[400px] bg-background p-4 flex flex-col items-center justify-center relative overflow-hidden">
              {selectedEvidence?.localPath ? (
                <div className="w-full flex flex-col items-center justify-center">
                  <img
                    src={selectedEvidence.localPath.startsWith('http') ? selectedEvidence.localPath : `${import.meta.env.DEV ? 'http://127.0.0.1:3001' : ''}${selectedEvidence.localPath}`}
                    alt={selectedEvidence.caption || selectedEvidence.pageTitle || 'Playwright Screenshot Evidence'}
                    className="max-w-full max-h-[380px] rounded-lg shadow-elevated border border-border object-contain bg-surface"
                    onError={(e) => {
                      // Fallback if image path is pending
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const msg = document.createElement('div');
                        msg.className = 'text-xs text-text-muted text-center py-8';
                        msg.innerText = 'Screenshot artifact loading or pending...';
                        parent.appendChild(msg);
                      }
                    }}
                  />
                  <div className="mt-2.5 flex items-center justify-between w-full text-xs text-text-muted px-2">
                    <span className="text-[11px] text-text-secondary truncate font-medium">
                      {selectedEvidence.caption || selectedEvidence.pageTitle || 'Checkpoint Snapshot'}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      Step #{selectedEvidence.stepNumber} • {new Date(selectedEvidence.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ) : selectedEvidence?.svgMockupData ? (
                <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-5 shadow-elevated space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2.5">
                    <span className="text-xs font-semibold text-text-primary">
                      {selectedEvidence.svgMockupData.screenName}
                    </span>
                    <Badge variant="teal" size="sm">DOM Evidence</Badge>
                  </div>
                  <div className="space-y-3">
                    {selectedEvidence.svgMockupData.elements?.map((el, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border text-xs flex items-center justify-between bg-surface-subtle border-border text-text-secondary"
                      >
                        <span>{el.label}</span>
                        <span className="text-[10px] font-mono uppercase">{el.state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3 py-12">
                  <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 text-accent-light flex items-center justify-center mx-auto">
                    {isLive ? <Camera size={22} className="animate-pulse" /> : <Terminal size={22} />}
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary">
                    {isLive ? 'Playwright Browser Session Active' : 'Execution Completed'}
                  </h4>
                  <p className="text-xs text-text-muted max-w-xs mx-auto">
                    {isLive 
                      ? 'Navigating website, evaluating explicit assertions, and capturing evidence snapshots.'
                      : 'Review step execution trace on the left or inspect findings below.'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Evidence Selection Thumbnails Bar */}
            {evidenceList.length > 1 && (
              <div className="p-2.5 bg-surface-subtle border-t border-border flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider shrink-0 pl-1">
                  Evidence ({evidenceList.length}):
                </span>
                {evidenceList.map((ev, i) => (
                  <button
                    key={ev.id || i}
                    onClick={() => setSelectedEvidence(ev)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors shrink-0 ${
                      selectedEvidence?.id === ev.id
                        ? 'bg-accent text-white font-semibold'
                        : 'bg-surface border border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Step #{ev.stepNumber}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Discovered Findings List */}
      <Card>
        <CardHeader
          title={`Detected UX Friction & Defect Findings (${findings.length})`}
          subtitle="Real observations and verification signals recorded during execution"
        />
        {findings.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted">
            {isLive ? 'Scanning for friction points during execution...' : 'No friction findings or blockers detected during this run.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {findings.map((f) => (
              <div
                key={f.id}
                onClick={() => navigate(`/findings/${f.id}`)}
                className="p-3.5 rounded-xl bg-surface-subtle border border-border hover:border-border-light cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Badge variant={f.severity as any}>
                    {f.severity}
                  </Badge>
                  <span className="text-[10px] text-text-muted font-mono">{f.category}</span>
                </div>
                <h4 className="text-xs font-semibold text-text-primary mb-1">
                  {f.title}
                </h4>
                <p className="text-[11px] text-text-muted line-clamp-2">
                  <strong className="text-text-secondary">Observed:</strong> {f.observedFacts}
                </p>
                {f.recommendedAction && (
                  <p className="text-[10px] text-teal-300 mt-2 truncate">
                    → {f.recommendedAction}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
