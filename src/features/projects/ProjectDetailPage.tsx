import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { Project, Scenario, Run, Finding } from '../../types';
import { RunConfigModal } from '../runs/RunConfigModal';
import { 
  Globe, 
  Figma, 
  Shield, 
  Monitor, 
  Play, 
  Plus, 
  AlertTriangle, 
  ArrowLeft, 
  ExternalLink,
  Trash2,
  Copy,
  Clock,
  Layers,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isSmoking, setIsSmoking] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const p = await api.getProject(id);
      if (!p) {
        toast.error('Project not found in database');
        navigate('/projects');
        return;
      }
      setProject(p);
      const [scenList, runList, findList] = await Promise.all([
        api.getScenarios(id),
        api.getRuns(id),
        api.getFindings({ projectId: id })
      ]);
      setScenarios(scenList);
      setRuns(runList);
      setFindings(findList);
    } catch (err: any) {
      toast.error('Failed to load project details from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, navigate]);

  const handleRunSmokeTest = async () => {
    if (!project) return;
    try {
      setIsSmoking(true);
      toast.info(`Launching Playwright to smoke test ${project.sourceUrl}...`);
      const res = await api.runSmokeTest(project.id);
      if (res.status === 'passed') {
        toast.success(`Smoke check passed: "${res.pageTitle || 'Page loaded'}" (${res.durationMs}ms)`);
      } else {
        toast.error(`Smoke check ${res.status}: ${res.error || 'Navigation error'}`);
      }
      navigate(`/runs/${res.runId}`);
    } catch (err: any) {
      toast.error(err.message || 'Smoke test execution failed');
    } finally {
      setIsSmoking(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Loading project details from local SQLite...</p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/projects">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={14} />}>
              All Projects
            </Button>
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">{project.name}</h1>
              <Badge variant={project.readinessStatus === 'demo-ready' ? 'teal' : 'medium'}>
                {project.readinessStatus}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Flame size={13} className="text-amber-400" />}
            onClick={handleRunSmokeTest}
            isLoading={isSmoking}
            disabled={isSmoking}
            title="Perform quick bounded browser navigation check to verify target website availability"
          >
            Run Website Smoke Test
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Play size={13} fill="currentColor" />}
            onClick={() => setIsRunModalOpen(true)}
          >
            Start Run
          </Button>
        </div>
      </div>

      {/* Project Source Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Source Endpoint & Allowed Domains" />
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-lg bg-surface-subtle border border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 truncate">
                <Globe size={15} className="text-teal shrink-0" />
                <span className="font-mono text-text-primary truncate">{project.sourceUrl}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-accent-light px-2 py-0.5 bg-accent/15 rounded">
                {project.sourceType}
              </span>
            </div>

            <div>
              <span className="text-text-muted block mb-1">Approved Cross-Origin Domains:</span>
              <div className="flex flex-wrap gap-1.5">
                {project.allowedDomains.map(d => (
                  <Badge key={d} variant="outline" size="sm" className="font-mono text-[11px]">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-subtle/60 border border-border flex items-center justify-between text-text-muted">
              <div className="flex items-center gap-2">
                <Monitor size={14} />
                <span>Primary Viewport: <strong className="text-text-secondary">{project.viewport}</strong></span>
              </div>
              <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        {/* Project Health / Findings Summary */}
        <Card>
          <CardHeader title="Project UX Diagnostics" />
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs py-1.5 border-b border-border">
              <span className="text-text-muted">Total Test Runs</span>
              <span className="font-semibold text-text-primary">{runs.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs py-1.5 border-b border-border">
              <span className="text-text-muted">Configured Scenarios</span>
              <span className="font-semibold text-text-primary">{scenarios.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs py-1.5 border-b border-border">
              <span className="text-text-muted">Observed Findings</span>
              <span className="font-semibold text-text-primary">{findings.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs py-1.5">
              <span className="text-text-muted">Critical Blockers</span>
              <span className="font-semibold text-red-400">
                {findings.filter(f => f.severity === 'critical').length}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Associated Scenarios & Recent Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenarios */}
        <Card>
          <CardHeader
            title="Associated Scenarios"
            subtitle="Pre-configured behavioral task goals"
            action={
              <Link to="/scenarios/new">
                <Button size="sm" variant="secondary" leftIcon={<Plus size={12} />}>
                  Add Scenario
                </Button>
              </Link>
            }
          />
          {scenarios.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-border rounded-xl">
              <Flame size={28} className="mx-auto text-amber-400 mb-2" />
              <p className="text-xs font-semibold text-text-primary">No journey scenarios configured yet</p>
              <p className="text-[11px] text-text-muted mt-1 max-w-xs mx-auto">
                Test whether {project.sourceUrl} loads and capture browser diagnostics right now with a real smoke run.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Flame size={12} className="text-amber-400" />}
                  onClick={handleRunSmokeTest}
                  isLoading={isSmoking}
                  disabled={isSmoking}
                >
                  Run Website Smoke Test
                </Button>
                <Link to="/scenarios/new">
                  <Button size="sm" variant="primary" leftIcon={<Plus size={12} />}>
                    Add First Scenario
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scenarios.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/scenarios/${s.id}`)}
                  className="p-3 rounded-lg bg-surface-subtle border border-border hover:border-border-light cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{s.title}</span>
                    <span className="text-[10px] font-mono text-text-muted">{s.steps.length} steps</span>
                  </div>
                  <p className="text-[11px] text-text-muted line-clamp-1 mt-1">{s.naturalGoal}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Project Runs */}
        <Card>
          <CardHeader
            title="Recent Journey Runs"
            subtitle="Execution records under this project scope"
          />
          {runs.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-muted">
              No test runs executed yet. Click "Start Run" above.
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map(r => (
                <div
                  key={r.id}
                  onClick={() => navigate(`/runs/${r.id}`)}
                  className="p-3 rounded-lg bg-surface-subtle border border-border hover:border-border-light cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-text-primary">{r.id}</span>
                      <span className="text-[11px] text-text-muted">• {r.browser}</span>
                    </div>
                    <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> {r.durationSeconds}s duration ({r.actionsExecuted} actions)
                    </div>
                  </div>
                  <Badge variant={r.taskOutcome === 'completed' ? 'teal' : 'critical'}>
                    {r.taskOutcome}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <RunConfigModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        defaultProjectId={project.id}
      />
    </div>
  );
};
