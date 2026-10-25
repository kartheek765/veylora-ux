import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Play } from 'lucide-react';
import { Button } from '../ui/Button';

interface TopBarProps {
  onOpenQuickRun?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenQuickRun }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Route label dictionary for exact module titles
  const ROUTE_LABELS: Record<string, string> = {
    '': 'Overview',
    'detective': 'Intent Detective',
    'projects': 'Projects',
    'synthetic-agents': 'Synthetic Agent Sandbox',
    'agent-sandbox': 'Synthetic Agent Sandbox',
    'personas': 'Synthetic Agent Sandbox',
    'scenarios': 'Scenarios',
    'runs': 'Test Runs',
    'findings': 'Findings Explorer',
    'comparisons': 'Comparisons',
    'roadmap': 'Fix Roadmap',
    'reports': 'Reports',
    'settings': 'Settings',
  };

  // Generate readable breadcrumbs
  const pathParts = location.pathname.split('/').filter(Boolean);
  const firstSegment = pathParts[0] || '';
  const breadcrumbName = ROUTE_LABELS[firstSegment] || (pathParts.length === 0 ? 'Overview' : firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/findings?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-14 border-b border-border bg-surface-subtle/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs">
        <Link to="/" className="text-text-muted hover:text-text-secondary transition-colors">
          Veylora UX
        </Link>
        <span className="text-text-muted">/</span>
        <span className="font-semibold text-text-primary">{breadcrumbName}</span>
        {pathParts.length > 1 && (
          <>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary font-mono truncate max-w-[140px]">
              {pathParts[1]}
            </span>
          </>
        )}
      </div>

      {/* Center Command Search */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-72">
        <Search size={14} className="absolute left-3 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search findings, runs, synthetic agents... (↵)"
          className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </form>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Play size={13} fill="currentColor" />}
          onClick={onOpenQuickRun}
        >
          New Run
        </Button>

        <Link to="/projects/new">
          <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />}>
            New Project
          </Button>
        </Link>

        <div className="h-4 w-px bg-border mx-1"></div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1 cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light text-xs font-semibold">
            VX
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-medium text-text-primary leading-none">Veylora Workspace</div>
            <div className="text-[10px] text-text-muted mt-0.5">Lead UX Architect</div>
          </div>
        </div>
      </div>
    </header>
  );
};
