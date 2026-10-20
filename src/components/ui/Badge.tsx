import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'teal' | 'indigo' | 'purple' | 'amber' | 'outline' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-medium' : 'px-2.5 py-1 text-xs font-semibold';

  const variantClasses = {
    default: 'bg-surface-active text-text-secondary border border-border',
    critical: 'bg-red-500/10 text-red-400 border border-red-500/30',
    high: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    low: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
    teal: 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
    indigo: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
    purple: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
    outline: 'bg-transparent text-text-secondary border border-border',
    neutral: 'bg-surface text-text-muted border border-border',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${sizeClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};
