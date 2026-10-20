import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }[size];

  const variantClasses = {
    primary: 'bg-accent hover:bg-accent-hover text-white shadow-subtle hover:shadow-glow-accent border border-accent/60',
    secondary: 'bg-surface hover:bg-surface-hover text-text-primary border border-border hover:border-border-light',
    outline: 'bg-transparent hover:bg-surface-hover text-text-primary border border-border hover:border-border-light',
    ghost: 'bg-transparent hover:bg-surface-subtle text-text-secondary hover:text-text-primary',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    teal: 'bg-teal/20 hover:bg-teal/30 text-teal-light border border-teal/40',
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-accent/50 ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {rightIcon && !isLoading && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
