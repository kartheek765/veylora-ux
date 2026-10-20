import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StorageService } from '../../services/storageService';
import { api } from '../../services/api';
import { Finding, EvidenceItem, Run, FindingStatus, VerificationStatus, LifecycleStatus } from '../../types';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Eye, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck,
  FileCheck, 
  ExternalLink,
  Clock,
  Sparkles,
  Info,
  Hash,
  Layers,
  Play
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const FindingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [finding, setFinding] = useState<Finding | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [retesting, setRetesting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const loadData = async () => {
      try {
        const backendFindings = await api.getFindings();
        const found = Array.isArray(backendFindings) ? backendFindings.find((b: any) => b.id === id) : null;
        if (found) {
          setFinding(found);
          if (found.evidenceId) {
            const evData = await api.getFindingEvidence(found.id);
            if (evData?.evidence) setEvidence(evData.evidence);
          }
          return;
        }
      } catch {}

      // Fallback
      const f = StorageService.getFinding(id);
      if (!f) {
        toast.error('Finding record not found');
        navigate('/findings');
        return;
      }
      setFinding(f);
      if (f.evidenceId) {
        const ev = StorageService.getEvidenceItem(f.evidenceId);
        if (ev) setEvidence(ev);
      }
      const r = StorageService.getRun(f.runId);
      if (r) setRun(r);
    };

    loadData();
  }, [id, navigate]);

  if (!finding) return null;

  const handleUpdateStatus = async (newStatus: FindingStatus) => {
    try {
      await api.updateFinding(finding.id, { status: newStatus });
    } catch {}
    const updated = { ...finding, status: newStatus };
    StorageService.saveFinding(updated);
    setFinding(updated);
    toast.success(`Finding status updated to "${newStatus.replace(/_/g, ' ')}"`);
  };

  const handleRequestRetest = async () => {
    setRetesting(true);
    try {
      const res = await api.executeAssistantAction('REQUEST_RETEST', { findingId: finding.id }, true);
      if (res.success) {
        toast.success(`Retest run ${res.jobId || ''} queued in Playwright`);
        navigate('/runs');
      } else {
        toast.error(res.error || 'Failed to trigger retest');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Retest request failed');
    } finally {
      setRetesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/findings">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />}>
              All Findings
            </Button>
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={finding.severity as any}>
                {finding.severity}
              </Badge>
              
              {/* Verification Status */}
              {finding.verificationStatus === 'VERIFIED' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  VERIFIED FACT
                </span>
              ) : finding.verificationStatus === 'AI_HYPOTHESIS' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  <Sparkles size={11} className="text-purple-400" />
                  AI HYPOTHESIS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <AlertTriangle size={11} className="text-amber-400" />
                  NEEDS REVIEW
                </span>
              )}

              {/* Lifecycle Badge */}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {finding.lifecycleStatus || 'NEW'}
              </span>

              <span className="text-xs font-mono text-text-muted uppercase">
                {finding.category.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Retest & Status Control */}
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRequestRetest}
            disabled={retesting}
            leftIcon={<Play size={12} className={retesting ? 'animate-spin' : ''} />}
          >
            {retesting ? 'Queueing...' : 'Request Retest'}
          </Button>

          <select
            value={finding.status}
            onChange={(e) => handleUpdateStatus(e.target.value as FindingStatus)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="needs_review">Needs Review</option>
            <option value="valid">Valid Finding</option>
            <option value="false_positive">False Positive</option>
            <option value="fixed">Fixed</option>
            <option value="accepted_risk">Accepted Risk</option>
            <option value="needs_investigation">Needs Investigation</option>
          </select>
        </div>
      </div>

      {/* Main Title and Impact */}
      <Card className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary leading-snug">
            {finding.title}
          </h1>
          {finding.fingerprint && (
            <div className="mt-1 flex items-center gap-2 text-xs font-mono text-text-muted">
              <Hash size={12} />
              <span>Fingerprint: {finding.fingerprint}</span>
            </div>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-surface-subtle border border-border flex items-start gap-3 text-xs">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-primary block mb-0.5">Likely User Impact</span>
            <p className="text-text-secondary leading-relaxed">{finding.likelyImpact || 'May introduce user hesitation or friction in journey completion.'}</p>
          </div>
        </div>
      </Card>

      {/* Principle of Evidence: Observed Facts vs Possible Cause */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objective Observed Facts */}
        <Card className="border-teal/30 bg-surface space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="w-2 h-2 rounded-full bg-teal"></span>
            <h3 className="text-sm font-semibold text-text-primary">
              Objective Browser Observation (Factual Evidence)
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed font-mono bg-surface-subtle p-3 rounded-lg border border-border">
            {finding.observedFacts}
          </p>
          <div className="text-[11px] text-text-muted flex items-center justify-between">
            <span>Captured at step {finding.stepNumber}</span>
            <span className="font-mono text-text-secondary truncate max-w-xs">{finding.pageUrl}</span>
          </div>
        </Card>

        {/* AI Interpretation / Inferred Cause */}
        <Card className="border-accent/30 bg-surface space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Sparkles size={14} className="text-accent-light" />
            <h3 className="text-sm font-semibold text-text-primary">
              Inferred Diagnostic Cause (Analysis Model)
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed bg-surface-subtle p-3 rounded-lg border border-border">
            {finding.possibleCause}
          </p>
          <div className="text-[11px] text-accent-light flex items-center gap-1.5">
            <Info size={12} />
            <span>AI diagnostic hypotheses require human validation before engineering handoff.</span>
          </div>
        </Card>
      </div>

      {/* Recommended Action */}
      <Card className="bg-gradient-to-r from-teal/10 via-surface to-surface border-teal/40">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="text-teal shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-teal-light uppercase tracking-wider">
              Recommended Remediation
            </h4>
            <p className="text-xs text-text-primary leading-relaxed font-medium">
              {finding.recommendedAction}
            </p>
          </div>
        </div>
      </Card>

      {/* Evidence Snapshot Preview & Reproduction Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evidence Frame */}
        <Card>
          <CardHeader
            title="Attached Evidence Snapshot"
            subtitle="Grounding screenshot and DOM state recorded during run"
          />
          {evidence ? (
            <div className="bg-surface-subtle border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-text-muted border-b border-border pb-2">
                <span>{evidence.pageTitle || 'Page Snapshot'}</span>
                <span className="font-mono text-[10px]">{evidence.timestamp}</span>
              </div>
              <div className="p-3 bg-surface rounded-lg border border-border font-mono text-[11px] text-text-secondary truncate">
                Target URL: {evidence.url}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                <span>Sensitive tokens and passwords redacted before evidence persistence</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-text-muted">
              No binary evidence attached to this observation record.
            </div>
          )}
        </Card>

        {/* Reproduction Notes */}
        <Card>
          <CardHeader
            title="Reproduction Trace"
            subtitle="Parameters to re-create this finding in a Playwright session"
          />
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-1">
              <span className="text-text-muted block text-[11px]">Target URL</span>
              <code className="text-text-primary font-mono block break-all">{finding.pageUrl}</code>
            </div>

            {finding.selectorSummary && (
              <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-1">
                <span className="text-text-muted block text-[11px]">Safe Element Selector</span>
                <code className="text-text-primary font-mono block">{finding.selectorSummary}</code>
              </div>
            )}

            {finding.ruleId && (
              <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-1">
                <span className="text-text-muted block text-[11px]">axe-core Rule Identifier</span>
                <code className="text-indigo-300 font-mono block">{finding.ruleId}</code>
              </div>
            )}

            <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-1">
              <span className="text-text-muted block text-[11px]">Reproduction Notes</span>
              <p className="text-text-secondary">{finding.reproductionNotes || 'Run automated journey session targeting the specified URL.'}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
