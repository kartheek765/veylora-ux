import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { api } from '../../services/api';
import { FixTask } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  ArrowUpRight, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  HelpCircle,
  SlidersHorizontal,
  ChevronRight,
  Play
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const RoadmapPage: React.FC = () => {
  const [tasks, setTasks] = useState<FixTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<FixTask | null>(null);

  const loadRoadmap = async () => {
    setLoading(true);
    try {
      const data = await api.getRoadmap();
      if (Array.isArray(data)) {
        setTasks(data);
        if (data.length > 0 && !selectedTask) {
          setSelectedTask(data[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmap();
  }, []);

  const handleGenerateRoadmap = async () => {
    setGenerating(true);
    try {
      // Default to demo project 'proj-1'
      const res = await api.generateRoadmap('proj-1');
      if (res.tasks) {
        setTasks(res.tasks);
        if (res.tasks.length > 0) {
          setSelectedTask(res.tasks[0]);
        }
        toast.success(`Generated ${res.tasks.length} explainable fix tasks`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate roadmap');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: any) => {
    try {
      const updated = await api.updateRoadmapTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(updated);
      }
      toast.success(`Task status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update task status');
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesTier = tierFilter === 'all' || t.priorityTier === tierFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesTier && matchesStatus;
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'P0': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'P1': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'P2': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Smart Fix Roadmap</h1>
            <Badge variant="indigo" size="sm">Evidence-Prioritized</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Deterministic prioritization ranking based on severity, evidence verification, recurrence, and estimated effort
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadRoadmap}
            leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleGenerateRoadmap}
            leftIcon={<Sparkles size={13} />}
            disabled={generating}
          >
            {generating ? 'Calculating...' : 'Re-rank Tasks'}
          </Button>
        </div>
      </div>

      {/* Formula & Policy Card */}
      <Card className="bg-surface-subtle/50 border border-border-light p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
            <SlidersHorizontal size={18} />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-text-primary">Transparent Priority Formula</h4>
            <p className="text-text-muted leading-relaxed font-mono text-[11px]">
              Priority Score = (Severity × 4.0) + (Confidence × 2.5) + (Recurrence × 2.0) + (A11y/Security × 2.5) - (Effort × 1.5)
            </p>
            <p className="text-text-muted text-[11px]">
              <strong>P0 (Score ≥ 20)</strong>: Critical verified blockers • <strong>P1 (≥ 14)</strong>: High priority fixes • <strong>P2 (≥ 8)</strong>: Moderate improvements • <strong>P3 (&lt; 8)</strong>: Polish & low effort
            </p>
          </div>
        </div>
      </Card>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Priority Tiers' },
            { value: 'P0', label: 'P0 (Immediate Blocker)' },
            { value: 'P1', label: 'P1 (High Priority)' },
            { value: 'P2', label: 'P2 (Moderate)' },
            { value: 'P3', label: 'P3 (Low / Polish)' }
          ]}
          className="w-48"
        />

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Task States' },
            { value: 'OPEN', label: 'OPEN' },
            { value: 'PLANNED', label: 'PLANNED' },
            { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
            { value: 'READY_FOR_VERIFICATION', label: 'READY_FOR_VERIFICATION' },
            { value: 'VERIFIED_FIXED', label: 'VERIFIED_FIXED' },
            { value: 'DEFERRED', label: 'DEFERRED' }
          ]}
          className="w-52"
        />

        <div className="text-xs text-text-muted ml-auto">
          Showing <strong>{filteredTasks.length}</strong> tasks
        </div>
      </div>

      {/* Main Roadmap Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Task List */}
        <div className="lg:col-span-7 space-y-3">
          {filteredTasks.length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
              <h3 className="text-sm font-semibold text-text-primary">No fix tasks in this view</h3>
              <p className="text-xs text-text-muted mt-1">
                {tasks.length === 0 ? 'Click "Re-rank Tasks" to calculate an evidence-based roadmap from your audit findings.' : 'Try adjusting the active tier or status filters.'}
              </p>
            </Card>
          ) : (
            filteredTasks.map((task) => (
              <Card
                key={task.id}
                hoverable
                onClick={() => setSelectedTask(task)}
                className={`p-4 transition-all cursor-pointer border ${
                  selectedTask?.id === task.id ? 'border-accent ring-1 ring-accent/30 bg-surface' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${getTierColor(task.priorityTier)}`}>
                        {task.priorityTier} ({task.priorityScore})
                      </span>
                      <Badge variant={task.severity as any} size="sm">
                        {task.severity}
                      </Badge>
                      <span className="text-[11px] text-text-muted font-mono">
                        Effort: {task.effortBand.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono">
                        {task.associatedFindingIds.length} finding{task.associatedFindingIds.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {task.title}
                    </h3>

                    <p className="text-xs text-text-muted line-clamp-2">
                      {task.recommendedAction}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-subtle border border-border text-text-secondary">
                      {task.status}
                    </span>
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Task Detail Inspector */}
        <div className="lg:col-span-5">
          {selectedTask ? (
            <Card className="p-5 space-y-4 sticky top-20 border border-border-light shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border font-mono ${getTierColor(selectedTask.priorityTier)}`}>
                    {selectedTask.priorityTier}
                  </span>
                  <span className="text-xs text-text-muted font-mono">Score: {selectedTask.priorityScore}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted">Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleUpdateStatus(selectedTask.id, e.target.value)}
                    className="text-xs font-medium bg-surface-subtle border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="PLANNED">PLANNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="READY_FOR_VERIFICATION">READY_FOR_VERIFICATION</option>
                    <option value="VERIFIED_FIXED">VERIFIED_FIXED</option>
                    <option value="DEFERRED">DEFERRED</option>
                  </select>
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold text-text-primary leading-snug">
                  {selectedTask.title}
                </h2>
                <div className="mt-1 text-[11px] font-mono text-text-muted">
                  Root Cause: {selectedTask.rootCauseGroup}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-text-secondary">Priority Rationale</div>
                <div className="p-3 bg-surface-subtle rounded-lg text-xs text-text-muted leading-relaxed border border-border">
                  {selectedTask.priorityRationale}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-text-secondary">Actionable Fix Guidance</div>
                <div className="p-3 bg-indigo-500/5 rounded-lg text-xs text-text-primary leading-relaxed border border-indigo-500/20">
                  {selectedTask.recommendedAction}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-t border-border pt-3">
                <div>
                  <span className="text-text-muted block text-[11px]">Severity:</span>
                  <strong className="text-text-primary uppercase">{selectedTask.severity}</strong>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Verification:</span>
                  <strong className="text-text-primary">{selectedTask.confidence}</strong>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Effort Band:</span>
                  <strong className="text-text-primary uppercase">{selectedTask.effortBand}</strong>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px]">Associated Issues:</span>
                  <strong className="text-text-primary">{selectedTask.associatedFindingIds.length} finding(s)</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-text-muted">ID: {selectedTask.id}</span>
                {selectedTask.status === 'READY_FOR_VERIFICATION' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleUpdateStatus(selectedTask.id, 'VERIFIED_FIXED')}
                    leftIcon={<ShieldCheck size={13} />}
                  >
                    Confirm Verified Fix
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="text-center py-12 text-text-muted text-xs">
              Select a task from the list to view its transparent priority score breakdown and verification requirements.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
