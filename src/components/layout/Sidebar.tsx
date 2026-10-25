import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  GitFork, 
  PlayCircle, 
  AlertTriangle, 
  Scale, 
  FileText, 
  Settings, 
  ShieldCheck,
  ChevronDown,
  ListTodo,
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/detective', label: 'Intent Detective', icon: Sparkles, isSignature: true },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/synthetic-agents', label: 'Synthetic Agent Sandbox', icon: Users },
    { to: '/scenarios', label: 'Scenarios', icon: GitFork },
    { to: '/runs', label: 'Test Runs', icon: PlayCircle },
    { to: '/findings', label: 'Findings Explorer', icon: AlertTriangle },
    { to: '/comparisons', label: 'Comparisons', icon: Scale },
    { to: '/roadmap', label: 'Fix Roadmap', icon: ListTodo },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-surface-sidebar border-r border-border flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center p-1.5 shadow-subtle">
            <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
              <path d="M6 16L11 9L16 21L20 13L24 18" stroke="url(#sidebar_logo_grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="24" cy="18" r="2.5" fill="#2DD4BF"/>
              <circle cx="11" cy="9" r="2" fill="#818CF8"/>
              <defs>
                <linearGradient id="sidebar_logo_grad" x1="6" y1="15" x2="24" y2="15" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1"/>
                  <stop offset="0.6" stopColor="#818CF8"/>
                  <stop offset="1" stopColor="#14B8A6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-text-primary">Veylora UX</span>
              <span className="text-[10px] px-1 py-0.2 font-mono uppercase bg-accent/20 text-accent-light rounded">v1.0</span>
            </div>
            <p className="text-[11px] text-text-muted truncate">See the friction. Prove the path.</p>
          </div>
        </div>

        {/* Workspace Selector */}
        <div className="mt-3.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light cursor-pointer transition-colors">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-teal"></span>
            <span className="font-medium truncate">Synthetica Demo Space</span>
          </div>
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2.5 pb-1">
          Workbench
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent/15 text-accent-light border border-accent/30 shadow-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`
              }
            >
              <Icon size={16} className={`shrink-0 ${item.isSignature ? 'text-accent-light animate-pulse' : ''}`} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.isSignature && (
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-gradient-to-r from-accent/30 to-teal/30 text-teal border border-teal/40 font-semibold tracking-wider">
                  New
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Safe Mode Footer */}
      <div className="p-3 border-t border-border bg-surface-subtle/50 text-xs">
        <div className="flex items-center justify-between text-text-secondary mb-1">
          <div className="flex items-center gap-1.5 text-teal-300">
            <ShieldCheck size={14} />
            <span className="font-medium text-[11px]">Safe Mode Active</span>
          </div>
          <span className="text-[10px] text-text-muted font-mono">Bounded 15</span>
        </div>
        <p className="text-[10px] text-text-muted leading-tight">
          Destructive actions blocked. Local simulated execution only.
        </p>
      </div>
    </aside>
  );
};
