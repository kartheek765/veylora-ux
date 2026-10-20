import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { api } from '../../services/api';
import { Scenario, Project } from '../../types';
import { RunConfigModal } from '../runs/RunConfigModal';
import { 
  GitFork, 
  Plus, 
  Search, 
  Play, 
  Edit3, 
  Trash2, 
  Clock, 
  ShieldAlert, 
  ArrowRight,
  ListOrdered
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const ScenariosPage: React.FC = () => {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>('');

  const refreshScenarios = async () => {
    try {
      setLoading(true);
      const [sList, pList] = await Promise.all([
        api.getScenarios(),
        api.getProjects()
      ]);
      setScenarios(sList);
      setProjects(pList);
    } catch (err: any) {
      toast.error('Failed to load scenarios from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshScenarios();
  }, []);

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete scenario "${title}"?`)) {
      try {
        await api.deleteScenario(id);
        await refreshScenarios();
        toast.info(`Scenario "${title}" deleted`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete scenario');
      }
    }
  };

  const filtered = scenarios.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.naturalGoal.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">Scenario Library</h1>
            <Badge variant="indigo" size="sm">Deterministic & Negative Paths</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Structured task sequences, synthetic fixtures, and goal verification criteria
          </p>
        </div>

        <Link to="/scenarios/new">
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
            Build New Scenario
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="w-full sm:w-80">
        <Input
          placeholder="Search scenarios by goal or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
        />
      </div>

      {/* Scenarios Grid */}
      {loading ? (
        <Card className="text-center py-16">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-text-muted">Loading journey scenarios from SQLite database...</p>
        </Card>
      ) : scenarios.length === 0 ? (
        <Card className="text-center py-16 max-w-xl mx-auto border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent-light">
            <GitFork size={24} />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Scenarios Created Yet</h3>
          <p className="text-xs text-text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
            Scenarios define multi-step user journeys and explicit verification criteria (e.g. check login, verify checkout button, assert headline).
          </p>
          <div className="mt-6">
            <Link to="/scenarios/new">
              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
                Build First Scenario
              </Button>
            </Link>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <GitFork size={36} className="mx-auto text-text-muted mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No scenarios match your query</h3>
          <p className="text-xs text-text-muted mt-1">Try clearing your search term.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSearch('')}>
            Clear Search
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((scenario) => {
            const project = projects.find(p => p.id === scenario.projectId);
            return (
              <Card
                key={scenario.id}
                hoverable
                onClick={() => navigate(`/scenarios/${scenario.id}`)}
                className="flex flex-col justify-between"
              >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="default" size="sm">
                    {project ? project.name : 'Unassigned Project'}
                  </Badge>
                  <span className="text-[11px] font-mono text-text-muted">
                    v{scenario.version} • {scenario.steps.length} steps
                  </span>
                </div>

                <h3 className="text-base font-semibold text-text-primary leading-tight">
                  {scenario.title}
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {scenario.naturalGoal}
                </p>

                {/* Steps Preview */}
                <div className="mt-3.5 p-3 rounded-lg bg-surface-subtle border border-border space-y-1.5 text-xs">
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                    Success Criteria
                  </div>
                  <div className="text-teal-300 font-mono text-[11px] truncate">
                    {scenario.successCondition}
                  </div>
                </div>

                {/* Fixtures & Negative Paths */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {scenario.timeBudgetSeconds}s limit
                  </span>
                  <span>•</span>
                  <span>{scenario.actionBudget} max actions</span>
                  <span>•</span>
                  <span className="text-amber-400">
                    {Object.values(scenario.negativePaths).filter(Boolean).length} negative paths
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Play size={12} fill="currentColor" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetProjectId(scenario.projectId);
                    setIsRunModalOpen(true);
                  }}
                >
                  Run Scenario
                </Button>

                <div className="flex items-center gap-1">
                  <button
                    title="Edit Scenario"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scenarios/${scenario.id}`);
                    }}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    title="Delete Scenario"
                    onClick={(e) => handleDelete(scenario.id, scenario.title, e)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    )}

    <RunConfigModal
      isOpen={isRunModalOpen}
      onClose={() => setIsRunModalOpen(false)}
      defaultProjectId={targetProjectId}
    />
  </div>
  );
};
