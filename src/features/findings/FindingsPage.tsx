import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StorageService } from '../../services/storageService';
import { api } from '../../services/api';
import { Finding, FindingSeverity, FindingConfidence, FindingCategory, FindingStatus, VerificationStatus, LifecycleStatus } from '../../types';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  History,
  ArrowRight
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const FindingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const loadFindings = async () => {
    setLoading(true);
    try {
      // 1. Try to fetch real findings from local SQLite backend
      const backendFindings = await api.getFindings();
      if (Array.isArray(backendFindings) && backendFindings.length > 0) {
        setFindings(backendFindings);
      } else {
        // Fallback to local storage seed findings
        setFindings(StorageService.getFindings());
      }
    } catch {
      setFindings(StorageService.getFindings());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFindings();
  }, []);

  const filtered = findings.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(search.toLowerCase()) || 
      (f.observedFacts || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.pageUrl || '').toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || f.severity === severityFilter;
    const matchesVerification = verificationFilter === 'all' || (f.verificationStatus || 'NEEDS_REVIEW') === verificationFilter;
    const matchesLifecycle = lifecycleFilter === 'all' || (f.lifecycleStatus || 'NEW') === lifecycleFilter;
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter;
    return matchesSearch && matchesSeverity && matchesVerification && matchesLifecycle && matchesCategory;
  });

  const clearFilters = () => {
    setSearch('');
    setSeverityFilter('all');
    setVerificationFilter('all');
    setLifecycleFilter('all');
    setCategoryFilter('all');
  };

  const renderVerificationBadge = (status?: VerificationStatus) => {
    const st = status || 'NEEDS_REVIEW';
    switch (st) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck size={11} className="text-emerald-400" />
            VERIFIED
          </span>
        );
      case 'AI_HYPOTHESIS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Sparkles size={11} className="text-purple-400" />
            AI HYPOTHESIS
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle size={11} className="text-amber-400" />
            NEEDS REVIEW
          </span>
        );
      case 'NOT_REPRODUCED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-500/30">
            NOT REPRODUCED
          </span>
        );
      case 'INVALIDATED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-surface text-text-muted border border-border line-through">
            INVALIDATED
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface border border-border text-text-secondary">
            {st}
          </span>
        );
    }
  };

  const renderLifecycleBadge = (status?: LifecycleStatus) => {
    const st = status || 'NEW';
    switch (st) {
      case 'NEW':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">NEW</span>;
      case 'PERSISTENT':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">PERSISTENT</span>;
      case 'RESOLVED':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">RESOLVED</span>;
      case 'RECURRING':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">RECURRING</span>;
      case 'NO_LONGER_OBSERVED':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">UNOBSERVED</span>;
      default:
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">{st}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Findings Explorer</h1>
            <Badge variant="indigo" size="sm">Evidence-Linked Diagnostics</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Audit detected journey friction, distinguish verified browser findings from AI hypotheses, and inspect proof
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/roadmap')}
            leftIcon={<ArrowRight size={13} />}
          >
            Open Fix Roadmap
          </Button>
          <div className="text-xs text-text-muted">
            Showing <strong>{filtered.length}</strong> of {findings.length} findings
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Search facts, URLs, titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            className="sm:col-span-2 lg:col-span-1"
          />

          <Select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'serious', label: 'Serious' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'minor', label: 'Minor' },
            ]}
          />

          <Select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Verification Statuses' },
              { value: 'VERIFIED', label: 'VERIFIED (Deterministic Fact)' },
              { value: 'AI_HYPOTHESIS', label: 'AI HYPOTHESIS (Model Suggestion)' },
              { value: 'NEEDS_REVIEW', label: 'NEEDS REVIEW (Human Judgment)' },
              { value: 'NOT_REPRODUCED', label: 'NOT REPRODUCED' },
              { value: 'INVALIDATED', label: 'INVALIDATED' },
            ]}
          />

          <Select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Lifecycle States' },
              { value: 'NEW', label: 'NEW Finding' },
              { value: 'PERSISTENT', label: 'PERSISTENT Finding' },
              { value: 'RESOLVED', label: 'RESOLVED' },
              { value: 'RECURRING', label: 'RECURRING Defect' },
              { value: 'NO_LONGER_OBSERVED', label: 'NO LONGER OBSERVED' },
            ]}
          />

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'accessibility', label: 'Accessibility (axe-core)' },
              { value: 'task_blocked', label: 'Task Blocked' },
              { value: 'navigation_confusion', label: 'Navigation Confusion' },
              { value: 'form_friction', label: 'Form Friction' },
              { value: 'visual_layout_issue', label: 'Visual Layout' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
          <div className="flex items-center gap-2 text-text-muted">
            <Filter size={12} />
            <span>AI hypotheses and verified defects have distinct visual badges to avoid false claims.</span>
          </div>
          <button onClick={clearFilters} className="text-accent-light hover:underline font-medium">
            Reset Filters
          </button>
        </div>
      </Card>

      {/* Findings List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="text-center py-12">
            <AlertTriangle size={36} className="mx-auto text-text-muted mb-3" />
            <h3 className="text-sm font-semibold text-text-primary">No findings matched your criteria</h3>
            <p className="text-xs text-text-muted mt-1">Try resetting your active filters.</p>
            <Button size="sm" variant="secondary" onClick={clearFilters} className="mt-3">
              Clear All Filters
            </Button>
          </Card>
        ) : (
          filtered.map((finding) => (
            <Card
              key={finding.id}
              hoverable
              onClick={() => navigate(`/findings/${finding.id}`)}
              className="p-4 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={finding.severity as any}>
                      {finding.severity}
                    </Badge>
                    
                    {/* Verification Status */}
                    {renderVerificationBadge(finding.verificationStatus)}

                    {/* Lifecycle Status */}
                    {renderLifecycleBadge(finding.lifecycleStatus)}

                    <span className="text-[11px] text-text-muted font-mono uppercase">
                      {finding.category.replace(/_/g, ' ')}
                    </span>

                    {finding.ruleId && (
                      <span className="text-[10px] text-indigo-300 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        axe:{finding.ruleId}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-text-primary leading-snug">
                    {finding.title}
                  </h3>

                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                    <strong className="text-text-secondary">Observed:</strong> {finding.observedFacts}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono pt-0.5 truncate">
                    <span className="truncate">{finding.pageUrl}</span>
                    <span>•</span>
                    <span>Step {finding.stepNumber}</span>
                    {finding.fingerprint && (
                      <>
                        <span>•</span>
                        <span className="text-text-muted">FP: {finding.fingerprint.substring(0, 8)}...</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Status Control */}
                <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-border">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md capitalize ${
                      finding.status === 'valid'
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                        : finding.status === 'fixed' || finding.lifecycleStatus === 'RESOLVED'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        : finding.status === 'false_positive' || finding.verificationStatus === 'INVALIDATED'
                        ? 'bg-surface text-text-muted border border-border line-through'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {(finding.lifecycleStatus === 'RESOLVED' ? 'Resolved' : finding.status).replace(/_/g, ' ')}
                  </span>

                  <span className="text-xs text-accent-light hover:underline flex items-center gap-1 font-medium">
                    Evidence <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
