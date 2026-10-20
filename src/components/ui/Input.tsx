import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-text-muted pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-surface-subtle border ${
            error ? 'border-red-500/80 focus:border-red-500' : 'border-border focus:border-accent'
          } rounded-lg ${leftIcon ? 'pl-9' : 'px-3'} py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent transition-colors ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextAreaProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  rows = 3,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`w-full bg-surface-subtle border ${
          error ? 'border-red-500/80 focus:border-red-500' : 'border-border focus:border-accent'
        } rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
    </div>
  );
};
