import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ToastContainer } from '../ui/Toast';
import { RunConfigModal } from '../../features/runs/RunConfigModal';
import { AskVeyloraButton } from '../assistant/AskVeyloraButton';
import { AskVeyloraPanel } from '../assistant/AskVeyloraPanel';

export const AppLayout: React.FC = () => {
  const [isQuickRunOpen, setIsQuickRunOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary relative">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Content Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onOpenQuickRun={() => setIsQuickRunOpen(true)} />

        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Quick Run Modal */}
      <RunConfigModal
        isOpen={isQuickRunOpen}
        onClose={() => setIsQuickRunOpen(false)}
      />

      {/* Ask Veylora Floating Button (Persistent across all routes) */}
      <AskVeyloraButton
        isOpen={isAssistantOpen}
        onClick={() => setIsAssistantOpen(true)}
      />

      {/* Ask Veylora Slide-out Assistant Panel */}
      <AskVeyloraPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
