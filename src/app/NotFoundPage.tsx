import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted">
        <AlertCircle size={28} />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Resource Not Found</h1>
      <p className="text-xs text-text-muted max-w-sm">
        The requested screen, project record, or execution trace does not exist or has been removed from local storage.
      </p>
      <Link to="/">
        <Button variant="primary" size="sm" leftIcon={<ArrowLeft size={14} />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
