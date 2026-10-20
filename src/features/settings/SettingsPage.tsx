import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StorageService } from '../../services/storageService';
import { ExportService } from '../../services/exportService';
import { api } from '../../services/api';
import { PrivacySettings } from '../../types';
import { 
  Settings, 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  RotateCcw, 
  Download, 
  Trash2, 
  Info,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Server,
  Zap,
  AlertCircle
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    id: 'default',
    aiAssistanceEnabled: true,
    shareFindingsText: true,
    shareDomSummaries: false,
    shareScreenshots: false,
    retainEvidenceDays: 30,
    redactSensitiveFields: true,
    updatedAt: new Date().toISOString()
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [cleaning, setCleaning] = useState<boolean>(false);

  // Load persistent privacy settings from backend
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.getPrivacySettings();
        if (res && res.settings) {
          setPrivacySettings(res.settings);
        }
      } catch (err) {
        console.warn('[Settings] Failed to fetch privacy settings from backend:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUpdate = async (field: keyof PrivacySettings, value: any) => {
    const updated = { ...privacySettings, [field]: value };
    setPrivacySettings(updated);

    try {
      await api.updatePrivacySettings({ [field]: value });
      toast.success('Privacy preference saved');
    } catch (err) {
      console.error('[Settings] Failed to update privacy setting:', err);
      toast.error('Failed to save setting to local backend');
    }
  };

  const handleCleanExpired = async () => {
    setCleaning(true);
    try {
      const res = await api.cleanExpiredEvidence();
      if (res && res.success) {
        toast.success(`Cleanup complete: Removed ${res.deletedCount || 0} expired evidence artifacts`);
      } else {
        toast.success('Evidence cleanup complete: 0 expired artifacts');
      }
    } catch (err) {
      toast.error('Failed to clean expired evidence');
    } finally {
      setCleaning(false);
    }
  };

  const handleSeedDemoData = async () => {
    try {
      await api.seedDemoData();
      toast.success('Seeded demo project, persona, and scenario into local SQLite');
    } catch (err: any) {
      toast.error('Failed to seed demo data');
    }
  };

  const handleClearDemoData = async () => {
    if (window.confirm('Remove all demo projects, scenarios, and runs from local SQLite database?')) {
      try {
        await api.clearDemoData();
        toast.success('Demo data cleared from local SQLite database');
      } catch (err: any) {
        toast.error('Failed to clear demo data');
      }
    }
  };

  const handleExportWorkspace = async () => {
    try {
      const [projects, personas, scenarios, runs, findings, reports] = await Promise.all([
        api.getProjects(),
        api.getPersonas(),
        api.getScenarios(),
        api.getRuns(),
        api.getFindings(),
        api.getReports()
      ]);

      const backup = {
        app: 'Veylora UX',
        version: '1.0.0-production-grade',
        exportedAt: new Date().toISOString(),
        database: 'backend/data/veylora.sqlite',
        projects: Array.isArray(projects) ? projects : StorageService.getProjects(),
        personas: Array.isArray(personas) ? personas : StorageService.getPersonas(),
        scenarios: Array.isArray(scenarios) ? scenarios : StorageService.getScenarios(),
        runs: Array.isArray(runs) ? runs : StorageService.getRuns(),
        findings: Array.isArray(findings) ? findings : StorageService.getFindings(),
        evidence: StorageService.getEvidence(),
        reports: Array.isArray(reports) ? reports : StorageService.getReports(),
      };
      ExportService.downloadJson('veylora-ux-workspace-backup.json', backup);
      toast.success('Exported full workspace JSON backup from local backend');
    } catch {
      toast.error('Failed to export workspace backup');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-text-primary">Workbench & Privacy Settings</h1>
          <Badge variant="teal" size="sm">Local-First Guard</Badge>
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          Manage local SQLite storage, sensitive-data redaction, transparent AI transmission boundaries, and evidence retention
        </p>
      </div>

      {/* Local-First Architecture Principle Banner */}
      <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2">
        <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
          <Server size={16} className="text-teal" />
          <span>Strict Local-First Architecture Principle</span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Veylora runs 100% locally on <code className="text-accent-light font-mono">127.0.0.1:3001</code>. All audit runs, evidence items, action events, and accessibility test results are stored in your local SQLite database (<code className="text-teal-300 font-mono">backend/data/veylora.sqlite</code>). No third-party servers receive your database, session cookies, or raw form inputs.
        </p>
      </div>

      {/* AI Sharing & Transmission Controls (Phase 8) */}
      <Card>
        <CardHeader
          title="Transparent AI Provider Transmission Controls"
          subtitle="Explicitly control what sanitized metadata is permitted to leave your computer"
        />
        <div className="space-y-4">
          {/* Master AI Assistance Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-subtle border border-border">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">AI Assistance & Hypotheses</span>
                <Badge variant={privacySettings.aiAssistanceEnabled ? 'teal' : 'default'} size="sm">
                  {privacySettings.aiAssistanceEnabled ? 'Enabled' : 'Disabled (Offline Only)'}
                </Badge>
              </div>
              <p className="text-[11px] text-text-muted">
                When enabled, sanitized prompts can be sent to Google Gemini for contextual explanations. When disabled, Veylora operates in 100% offline rule-based mode.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={privacySettings.aiAssistanceEnabled}
                onChange={(e) => handleUpdate('aiAssistanceEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary peer-checked:after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal"></div>
            </label>
          </div>

          {/* Granular Sharing Toggles */}
          <div className={`space-y-3 transition-opacity ${privacySettings.aiAssistanceEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Share Findings Text */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border text-xs">
              <div>
                <span className="font-semibold text-text-primary block">Share Sanitized Finding Text</span>
                <span className="text-[11px] text-text-muted">
                  Allows sending finding titles, categories, and sanitized failure summaries to Gemini for root-cause synthesis.
                </span>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.shareFindingsText}
                onChange={(e) => handleUpdate('shareFindingsText', e.target.checked)}
                className="rounded border-border text-teal focus:ring-teal w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Share DOM Summaries */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border text-xs">
              <div>
                <span className="font-semibold text-text-primary block">Share Sanitized DOM Summaries</span>
                <span className="text-[11px] text-text-muted">
                  Allows sending non-sensitive element tags, attributes, and ARIA roles for interaction debugging.
                </span>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.shareDomSummaries}
                onChange={(e) => handleUpdate('shareDomSummaries', e.target.checked)}
                className="rounded border-border text-teal focus:ring-teal w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Share Screenshots (Disabled by default) */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary block">Share Screenshots with AI</span>
                  <Badge variant="amber" size="sm">Disabled by default</Badge>
                </div>
                <span className="text-[11px] text-text-muted">
                  When enabled, visual viewport captures can be transmitted to Gemini Vision. Only enable for non-sensitive public pages.
                </span>
              </div>
              <input
                type="checkbox"
                checked={privacySettings.shareScreenshots}
                onChange={(e) => handleUpdate('shareScreenshots', e.target.checked)}
                className="rounded border-border text-teal focus:ring-teal w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Sensitive Data Redaction Engine */}
      <Card>
        <CardHeader
          title="Sensitive Data Redaction & Sanitization"
          subtitle="Automatic redaction occurs before logging, persistence, export, or AI provider dispatch"
        />
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-subtle border border-border">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-teal shrink-0" />
              <div>
                <span className="font-semibold text-text-primary block">Automated Redaction Guard</span>
                <span className="text-[11px] text-text-muted">
                  Detects and masks Bearer tokens, JWTs, API keys, passwords, session cookies, credit card numbers, and SSNs.
                </span>
              </div>
            </div>
            <Badge variant="teal">Always Active</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-secondary uppercase">What is 100% Local</span>
              <ul className="text-[11px] text-text-muted space-y-1 list-disc list-inside">
                <li>Playwright Chromium browser instances</li>
                <li>Local SQLite database (`veylora.sqlite`)</li>
                <li>DOM snapshots & raw action logs</li>
                <li>Session tokens & local cookies</li>
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
              <span className="text-[11px] font-semibold text-text-secondary uppercase">What May Be Sent to AI</span>
              <ul className="text-[11px] text-text-muted space-y-1 list-disc list-inside">
                <li>User question typed into Ask Veylora</li>
                <li>Sanitized finding titles and error messages</li>
                <li>Current route pathname (e.g. `/checkout`)</li>
                <li>Only sanitized strings (secrets pre-masked)</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Evidence Retention Schedule */}
      <Card>
        <CardHeader
          title="Evidence Artifact Retention Schedule"
          subtitle="Define how long historical screenshots and traces are retained on disk"
        />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-surface-subtle border border-border">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-text-primary block">Retention Period</span>
              <span className="text-[11px] text-text-muted">
                Artifacts older than this threshold will be pruned during scheduled sweeps.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={privacySettings.retainEvidenceDays}
                onChange={(e) => handleUpdate('retainEvidenceDays', parseInt(e.target.value, 10))}
                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-medium focus:outline-none focus:border-accent"
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days (Recommended)</option>
                <option value="90">90 Days</option>
                <option value="365">365 Days (1 Year)</option>
              </select>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCleanExpired}
                disabled={cleaning}
                leftIcon={<Trash2 size={13} className="text-text-muted" />}
                className="text-xs"
              >
                {cleaning ? 'Cleaning...' : 'Prune Expired'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Workspace Backup & Reset */}
      <Card>
        <CardHeader
          title="Workspace Persistence & Seed Management"
          subtitle="Export full JSON backup manifests or reset to default state"
        />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <div>
            <div className="text-xs text-text-secondary font-medium">Local SQLite Database</div>
            <div className="text-xs text-text-muted mt-0.5 font-mono">
              backend/data/veylora.sqlite (Persistent)
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Download size={13} />}
              onClick={handleExportWorkspace}
            >
              Export Workspace JSON
            </Button>

            <Button
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw size={13} />}
              onClick={handleSeedDemoData}
            >
              Seed Demo Data
            </Button>

            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 size={13} />}
              onClick={handleClearDemoData}
            >
              Clear Demo Data
            </Button>
          </div>
        </div>
      </Card>

      {/* App Info Footer */}
      <div className="p-4 rounded-xl bg-surface-subtle/50 border border-border text-center text-xs text-text-muted space-y-1">
        <div className="font-semibold text-text-secondary">
          Veylora UX — Evidence-Driven UX Testing Platform
        </div>
        <div>Version 1.0.0 • SQLite Migration v2 Active • Local-First Architecture</div>
        <div className="text-[11px]">All browser automation and evidence analysis run strictly on 127.0.0.1.</div>
      </div>
    </div>
  );
};
