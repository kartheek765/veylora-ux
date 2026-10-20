import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { api } from '../../services/api';
import { Run, Project, Persona, Scenario } from '../../types';
import { RunConfigModal } from './RunConfigModal';
import { 
  PlayCircle, 
  Play, 
  Search, 
  Trash2, 
  RefreshCw, 
  Eye,
  Loader2,
  FolderPlus
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const RunsPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewRunOpen, setIsNewRunOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, p, per, sc] = await Promise.all([
        api.getRuns(),
        api.getProjects(),
        api.getPersonas(),
        api.getScenarios()
      ]);
      setRuns(Array.isArray(r) ? r : []);
      setProjects(Array.isArray(p) ? p : []);
      setPersonas(Array.isArray(per) ? per : []);
      setScenarios(Array.isArray(sc) ? sc : []);
    } catch (err) {
      console.error('Failed to load runs:', err);
      toast.error('Failed to fetch runs from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete run record ${id}?`)) {
      try {
        await api.deleteRun(id);
        setRuns(prev => prev.filter(r => r.id !== id));
        toast.info(`Run record ${id} removed`);
      } catch (err: any) {
        toast.error('Failed to delete run from backend');
      }
    }
  };

  const filtered = runs.filter(r => {
    const project = projects.find(p => p.id === r.projectId);
    const matchesSearch = r.id.toLowerCase().includes(search.toLowerCase()) || 
      (project && project.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.taskOutcome === statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Synthetic Journey Runs</h1>
            <Badge variant="teal" size="sm">Deterministic Telemetry</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Audit history of isolated browser worker executions, action events, and evidence traces
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play size={13} fill="currentColor" />}
            onClick={() => setIsNewRunOpen(true)}
          >
            Configure New Run
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by run ID or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Outcomes' },
            { id: 'completed', label: 'Completed' },
            { id: 'failed', label: 'Failed' },
            { id: 'blocked', label: 'Blocked' },
            { id: 'running', label: 'In Progress' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-accent/20 text-accent-light border border-accent/40'
                  : 'bg-surface-subtle text-text-muted hover:text-text-primary border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 size={28} className="animate-spin text-teal-400" />
          <p className="text-xs text-text-muted">Fetching execution runs from local backend...</p>
        </Card>
      ) : runs.length === 0 ? (
        /* Zero-mock clean empty state */
        <Card className="p-12 text-center border-dashed">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <PlayCircle size={28} />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">No Journey Runs Yet</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto mb-6">
            No synthetic journeys or smoke tests have been executed yet. Run an instant website smoke test from a project or configure a multi-step journey with Playwright locators.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play size={13} fill="currentColor" />}
              onClick={() => setIsNewRunOpen(true)}
            >
              Configure New Run
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FolderPlus size={13} />}
              onClick={() => navigate('/projects')}
            >
              View Projects
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-xs text-text-muted">
          No execution runs match your search query or filter.
        </Card>
      ) : (
        /* Runs Table / List */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle/70 text-text-muted uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Run ID</th>
                  <th className="py-3 px-4 font-semibold">Target Project</th>
                  <th className="py-3 px-4 font-semibold">Personas & Scenario</th>
                  <th className="py-3 px-4 font-semibold">Outcome</th>
                  <th className="py-3 px-4 font-semibold">Actions / Budget</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Findings</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((run) => {
                  const project = projects.find(p => p.id === run.projectId);
                  const personaNames = (run.personaIds || [])
                    .map(pId => personas.find(p => p.id === pId)?.name || pId)
                    .join(', ') || 'Default Persona';
                  const scenario = scenarios.find(s => (run.scenarioIds || []).includes(s.id));

                  return (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/runs/${run.id}`)}
                      className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-text-primary">
                        {run.id}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-text-primary">
                        {project?.name || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate text-text-secondary font-medium">
                          {personaNames}
                        </div>
                        <div className="truncate text-[11px] text-text-muted mt-0.5">
                          {scenario?.title || 'Synthetic Journey'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            (run.taskOutcome === 'completed' || run.taskOutcome === 'completed_goal' || run.taskOutcome === 'smoke_passed' || run.status === 'completed' || run.status === 'passed')
                              ? 'teal'
                              : (run.taskOutcome === 'failed' || run.taskOutcome === 'smoke_failed' || run.status === 'failed')
                              ? 'critical'
                              : (run.taskOutcome === 'blocked' || run.status === 'blocked')
                              ? 'medium'
                              : run.status === 'running'
                              ? 'indigo'
                              : 'neutral'
                          }
                        >
                          {run.taskOutcome || run.status}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-text-secondary">
                        {run.actionsExecuted} / {run.actionBudget}
                      </td>

                      <td className="py-3.5 px-4 text-text-muted font-mono">
                        {run.durationSeconds}s
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          {run.findingsCount && run.findingsCount.critical > 0 && (
                            <span className="text-red-400 font-bold">
                              {run.findingsCount.critical}C
                            </span>
                          )}
                          {run.findingsCount && run.findingsCount.high > 0 && (
                            <span className="text-orange-400">
                              {run.findingsCount.high}H
                            </span>
                          )}
                          {run.findingsCount && run.findingsCount.medium > 0 && (
                            <span className="text-amber-400">
                              {run.findingsCount.medium}M
                            </span>
                          )}
                          {(!run.findingsCount || (run.findingsCount.critical === 0 && run.findingsCount.high === 0 && run.findingsCount.medium === 0)) && (
                            <span className="text-teal-300">Clean</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            title="View Run Monitor"
                            onClick={() => navigate(`/runs/${run.id}`)}
                            className="p-1.5 rounded hover:bg-surface text-text-muted hover:text-accent-light transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            title="Delete run"
                            onClick={(e) => handleDelete(run.id, e)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RunConfigModal
        isOpen={isNewRunOpen}
        onClose={() => {
          setIsNewRunOpen(false);
          loadData();
        }}
      />
    </div>
  );
};
