import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full bg-surface-subtle border ${
          error ? 'border-red-500/80 focus:border-red-500' : 'border-border focus:border-accent'
        } rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent transition-colors ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-surface text-text-primary">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
    </div>
  );
};
