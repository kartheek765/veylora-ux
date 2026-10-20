import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Plus, 
  Users, 
  GitFork, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HardDrive, 
  ShieldCheck, 
  Activity,
  FolderKanban,
  Sparkles,
  TrendingUp,
  Globe
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { Project, Run, Finding, Persona } from '../../types';
import { ProjectWizardModal } from '../projects/ProjectWizardModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { toast } from '../../components/ui/Toast';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [pList, rList, fList, perList] = await Promise.all([
        api.getProjects(),
        api.getRuns(),
        api.getFindings(),
        api.getPersonas()
      ]);
      setProjects(pList);
      setRuns(rList);
      setFindings(fList);
      setPersonas(perList);
    } catch (err: any) {
      console.warn('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleSeedDemo = async () => {
    try {
      await api.seedDemoData();
      toast.success('Sample demo data seeded successfully');
      await loadDashboardData();
    } catch (err: any) {
      toast.error('Failed to seed demo data');
    }
  };

  // Compute metrics strictly from actual backend records
  const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'passed' || r.taskOutcome === 'completed' || r.taskOutcome === 'completed_goal' || r.taskOutcome === 'smoke_passed').length;
  const blockedRuns = runs.filter(r => r.status === 'blocked' || r.taskOutcome === 'blocked').length;
  const completionRate = runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 0;

  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');

  // Chart data: Friction categories from actual findings
  const categoryCounts: Record<string, number> = {};
  findings.forEach(f => {
    const formatted = f.category.replace(/_/g, ' ');
    categoryCounts[formatted] = (categoryCounts[formatted] || 0) + 1;
  });

  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  }));

  const severityPieData = [
    { name: 'Critical', value: criticalFindings.length, color: '#EF4444' },
    { name: 'High', value: highFindings.length, color: '#F97316' },
    { name: 'Medium', value: findings.filter(f => f.severity === 'medium').length, color: '#F59E0B' },
    { name: 'Low', value: findings.filter(f => f.severity === 'low').length, color: '#10B981' },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Loading workspace metrics from local SQLite...</p>
      </div>
    );
  }

  // Real Empty State when 0 projects exist
  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-accent/15 via-surface to-teal/10 border border-border">
          <div className="max-w-2xl">
            <Badge variant="teal" size="sm" className="mb-2">Zero-Mock Workspace</Badge>
            <h1 className="text-xl font-bold text-text-primary">Welcome to Veylora UX</h1>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Your local-first synthetic UX testing workbench. Test staging websites and user journeys with Playwright browser automation, detect friction, and inspect verifiable screenshots.
            </p>
          </div>
        </div>

        {/* Empty State Card */}
        <Card className="text-center py-16 px-6 max-w-xl mx-auto border-dashed border-border">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent-light shadow-elevated">
            <FolderKanban size={28} />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Start by Creating Your First Project</h2>
          <p className="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Provide a real HTTP or HTTPS website URL to test. Veylora will validate the target, store it in your local SQLite database, and allow instant Playwright smoke testing or multi-step journey audits.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={15} />}
              onClick={() => setIsWizardOpen(true)}
            >
              Create Your First Project
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Sparkles size={15} />}
              onClick={handleSeedDemo}
            >
              Load Sample Demo Data
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mt-8 pt-6 border-t border-border/60">
            <div className="p-3 rounded-lg bg-surface-subtle border border-border/40">
              <span className="text-[10px] uppercase font-bold text-teal block mb-1">1. Add Target</span>
              <p className="text-[11px] text-text-muted">Enter any authorized website URL (e.g. your local dev or staging app).</p>
            </div>
            <div className="p-3 rounded-lg bg-surface-subtle border border-border/40">
              <span className="text-[10px] uppercase font-bold text-accent-light block mb-1">2. Run Smoke Test</span>
              <p className="text-[11px] text-text-muted">Playwright launches headlessly, records page title, duration, and screenshot.</p>
            </div>
            <div className="p-3 rounded-lg bg-surface-subtle border border-border/40">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">3. Journey Audits</span>
              <p className="text-[11px] text-text-muted">Configure multi-step assertions and observe verifiable findings.</p>
            </div>
          </div>
        </Card>

        <ProjectWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onProjectCreated={loadDashboardData}
        />
      </div>
    );
  }

  // Populated Dashboard State with Real Metrics
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-accent/15 via-surface to-teal/10 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary text-sm">Synthetic Journey Intelligence Workspace</span>
            <Badge variant="teal" size="sm">Evidence Grounded</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Simulated persona runs detect goal friction and validate accessibility affordances before real user testing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/runs">
            <Button size="sm" variant="primary" leftIcon={<Play size={13} fill="currentColor" />}>
              Live Runs Queue
            </Button>
          </Link>
          <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />} onClick={() => setIsWizardOpen(true)}>
            Create Project
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-text-muted text-xs mb-2">
            <span>Synthetic Runs</span>
            <Activity size={15} className="text-accent-light" />
          </div>
          <div className="text-2xl font-bold text-text-primary">{runs.length}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-teal-300 mt-1">
            <CheckCircle2 size={12} />
            <span>{completedRuns} completed, {blockedRuns} blocked</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-text-muted text-xs mb-2">
            <span>Task Completion Rate</span>
            <TrendingUp size={15} className="text-teal" />
          </div>
          <div className="text-2xl font-bold text-teal-300">{completionRate}%</div>
          <div className="text-[11px] text-text-muted mt-1">
            Across {projects.length} saved projects
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-text-muted text-xs mb-2">
            <span>Critical Blockers</span>
            <AlertTriangle size={15} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{criticalFindings.length}</div>
          <div className="text-[11px] text-orange-400 mt-1">
            +{highFindings.length} high priority risks
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-text-muted text-xs mb-2">
            <span>Active Projects</span>
            <FolderKanban size={15} className="text-text-muted" />
          </div>
          <div className="text-2xl font-bold text-text-primary">{projects.length}</div>
          <div className="text-[11px] text-text-muted mt-1">
            Persisted in SQLite
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Friction by Category Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Observed Journey Friction Distribution"
            subtitle="Categorized signals captured from isolated browser action sequences"
          />
          {categoryChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-text-muted">
              No friction categories recorded yet. Run a scenario to populate distribution metrics.
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748B" 
                    fontSize={11} 
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111722', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Severity Pie Chart */}
        <Card>
          <CardHeader
            title="Severity Breakdown"
            subtitle="Risk triage ratio"
          />
          {severityPieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-text-muted">
              Zero findings recorded.
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111722', borderColor: '#1E293B', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity: Projects & Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title="Target Projects"
              subtitle="Recently configured website scopes"
              className="mb-0"
            />
            <Link to="/projects">
              <Button size="sm" variant="ghost">View All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {projects.slice(0, 4).map((proj) => (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="p-3 rounded-lg bg-surface-subtle border border-border hover:border-border-light cursor-pointer transition-colors flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">{proj.name}</h4>
                  <p className="text-[11px] text-text-muted truncate max-w-xs mt-0.5">{proj.sourceUrl}</p>
                </div>
                <Badge variant={proj.readinessStatus === 'demo-ready' ? 'teal' : 'medium'} size="sm">
                  {proj.readinessStatus}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Findings */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title="Recent Findings"
              subtitle="Latest UX friction observations"
              className="mb-0"
            />
            <Link to="/findings">
              <Button size="sm" variant="ghost">View All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {findings.length === 0 ? (
              <div className="text-center py-8 text-xs text-text-muted">
                No findings recorded yet.
              </div>
            ) : (
              findings.slice(0, 4).map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => navigate(`/findings/${finding.id}`)}
                  className="p-3 rounded-lg bg-surface-subtle border border-border hover:border-border-light cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant={finding.severity as any}>
                      {finding.severity}
                    </Badge>
                    <span className="text-[10px] text-text-muted font-mono">{finding.category}</span>
                  </div>
                  <h4 className="text-xs font-medium text-text-primary leading-snug line-clamp-1">
                    {finding.title}
                  </h4>
                  <p className="text-[11px] text-text-muted line-clamp-1 mt-1">
                    {finding.observedFacts}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <ProjectWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onProjectCreated={loadDashboardData}
      />
    </div>
  );
};
