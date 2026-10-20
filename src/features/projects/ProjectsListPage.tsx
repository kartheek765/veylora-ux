import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { api } from '../../services/api';
import { Project, SourceType } from '../../types';
import { ProjectWizardModal } from './ProjectWizardModal';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Globe, 
  Figma, 
  UploadCloud, 
  ExternalLink, 
  Copy, 
  Trash2, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const ProjectsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const refreshProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err: any) {
      toast.error('Failed to load projects from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const handleDuplicate = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.createProject({
        name: `${project.name} (Copy)`,
        sourceUrl: project.sourceUrl,
        description: project.description,
        sourceType: project.sourceType,
        viewport: project.viewport,
        allowedDomains: project.allowedDomains,
        notes: project.notes
      });
      await refreshProjects();
      toast.success(`Project duplicated as "${project.name} (Copy)"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate project');
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete project "${name}"? Linked scenarios and runs will be removed.`)) {
      try {
        await api.deleteProject(id);
        await refreshProjects();
        toast.info(`Project "${name}" removed`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete project');
      }
    }
  };

  const handleSeedDemo = async () => {
    try {
      await api.seedDemoData();
      toast.success('Demo projects seeded successfully');
      await refreshProjects();
    } catch (err: any) {
      toast.error('Failed to seed demo projects');
    }
  };

  const filtered = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sourceUrl.toLowerCase().includes(search.toLowerCase());
    const matchesSource = selectedSourceType === 'all' || p.sourceType === selectedSourceType;
    return matchesSearch && matchesSource;
  });

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case 'website': return <Globe size={14} className="text-teal" />;
      case 'figma': return <Figma size={14} className="text-accent-light" />;
      case 'export': return <UploadCloud size={14} className="text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Projects Workspace</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage staging websites, Figma prototypes, and journey scopes
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setIsWizardOpen(true)}
        >
          Create Project
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Filter projects by title or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Sources' },
            { id: 'website', label: 'Websites' },
            { id: 'figma', label: 'Figma' },
            { id: 'export', label: 'Exports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedSourceType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedSourceType === tab.id
                  ? 'bg-accent/20 text-accent-light border border-accent/40'
                  : 'bg-surface-subtle text-text-muted hover:text-text-primary border border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <Card className="text-center py-16">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-text-muted">Loading projects from local SQLite database...</p>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16 max-w-xl mx-auto border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent-light">
            <FolderKanban size={24} />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Projects Created Yet</h3>
          <p className="text-xs text-text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
            A clean workspace starts with real targets. Create your first project by supplying an authorized HTTP or HTTPS website URL to begin automated Playwright testing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setIsWizardOpen(true)}
            >
              Create Your First Project
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              onClick={handleSeedDemo}
            >
              Load Demo Projects
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <FolderKanban size={36} className="mx-auto text-text-muted mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No projects matched</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or clear your current filter.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => { setSearch(''); setSelectedSourceType('all'); }}
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => (
            <Card
              key={proj.id}
              hoverable
              onClick={() => navigate(`/projects/${proj.id}`)}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="default" size="sm" className="capitalize">
                    <span className="flex items-center gap-1.5">
                      {getSourceIcon(proj.sourceType)}
                      <span>{proj.sourceType}</span>
                    </span>
                  </Badge>

                  <Badge
                    variant={proj.readinessStatus === 'demo-ready' ? 'teal' : 'medium'}
                    size="sm"
                  >
                    {proj.readinessStatus}
                  </Badge>
                </div>

                <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-light transition-colors line-clamp-1">
                  {proj.name}
                </h3>
                <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                  {proj.description || 'No description specified for this test scope.'}
                </p>

                <div className="mt-3.5 p-2 rounded-lg bg-surface-subtle border border-border text-[11px] font-mono text-text-secondary truncate">
                  {proj.sourceUrl}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Calendar size={12} />
                  <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    title="Duplicate project"
                    onClick={(e) => handleDuplicate(proj, e)}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    title="Delete project"
                    onClick={(e) => handleDelete(proj.id, proj.name, e)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Creation Wizard */}
      <ProjectWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onProjectCreated={refreshProjects}
      />
    </div>
  );
};
