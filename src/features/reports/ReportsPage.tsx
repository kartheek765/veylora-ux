import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import { ExportService } from '../../services/exportService';
import { Report, Run, Finding, EvidenceItem, Project } from '../../types';
import { 
  FileText, 
  Download, 
  FileCode, 
  ExternalLink,
  ShieldAlert,
  Loader2,
  Play
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadReportData() {
      setLoading(true);
      try {
        const [rep, rList, fList, pList] = await Promise.all([
          api.getReports(),
          api.getRuns(),
          api.getFindings(),
          api.getProjects()
        ]);

        const repArray = Array.isArray(rep) ? rep : [];
        setReports(repArray);
        if (repArray.length > 0) setSelectedReportId(repArray[0].id);
        setRuns(Array.isArray(rList) ? rList : []);
        setFindings(Array.isArray(fList) ? fList : []);
        setProjects(Array.isArray(pList) ? pList : []);
      } catch (err) {
        console.error('Failed to load reports from backend:', err);
        toast.error('Failed to fetch reports from local backend');
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, []);

  const activeReport = reports.find(r => r.id === selectedReportId) || reports[0];
  const linkedRun = activeReport ? runs.find(r => r.id === activeReport.runId) : undefined;
  const linkedFindings = activeReport ? findings.filter(f => f.runId === activeReport.runId) : [];
  const linkedProject = activeReport ? projects.find(p => p.id === activeReport.projectId) : undefined;

  const handleExportJson = () => {
    if (!activeReport) return;
    const exportBundle = {
      report: activeReport,
      run: linkedRun,
      project: linkedProject,
      findings: linkedFindings,
      schema: 'PSW-REPORT-V1',
      exportedAt: new Date().toISOString(),
    };
    ExportService.downloadJson(`${activeReport.id}-manifest.json`, exportBundle);
    toast.success('Downloaded JSON report manifest');
  };

  const handleExportHtml = () => {
    if (!activeReport) return;
    // Prefer direct backend HTML export if accessible
    window.open(api.exportReportHtmlUrl(activeReport.id), '_blank');
    toast.success('Opened executive HTML report');
  };

  if (loading) {
    return (
      <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 size={28} className="animate-spin text-teal-400" />
        <p className="text-xs text-text-muted">Loading audit reports from local backend...</p>
      </Card>
    );
  }

  if (!activeReport) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">UX Diagnostics Reports</h1>
            <Badge variant="teal" size="sm">Evidence Traceable</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Stakeholder-ready assessment reports with observed facts, root causes, and remediation guidance
          </p>
        </div>

        <Card className="p-12 text-center border-dashed">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <FileText size={28} />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">No Diagnostic Reports Generated</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto mb-6">
            Audit reports are automatically generated upon completion of synthetic journeys and website smoke checks. Execute your first run to inspect evidence-based reports.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play size={13} fill="currentColor" />}
              onClick={() => navigate('/runs')}
            >
              Go to Runs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/projects')}
            >
              View Projects
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">UX Diagnostics Reports</h1>
            <Badge variant="teal" size="sm">Evidence Traceable</Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Stakeholder-ready assessment reports with observed facts, root causes, and remediation guidance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<FileCode size={14} />}
            onClick={handleExportJson}
          >
            Export JSON
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Download size={14} />}
            onClick={handleExportHtml}
          >
            Download HTML Report
          </Button>
        </div>
      </div>

      {/* Report Selector if multiple */}
      {reports.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportId(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedReportId === r.id
                  ? 'bg-accent/20 text-accent-light border border-accent/40'
                  : 'bg-surface-subtle text-text-muted hover:text-text-primary border border-border'
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>
      )}

      {/* Main Report Document Sheet Preview */}
      <Card className="p-8 space-y-6 bg-surface-card border-border shadow-elevated">
        {/* Document Header */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="indigo" size="sm">
                Veylora UX Formal Finding Report
              </Badge>
              <span className="text-[11px] font-mono text-text-muted">
                Schema: {activeReport.reportSchemaVersion || '1.0.0'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-text-primary leading-tight">
              {activeReport.title}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Purpose: {activeReport.purpose}
            </p>
          </div>

          <div className="text-right text-xs text-text-muted shrink-0 font-mono">
            <div>Generated: {new Date(activeReport.generationTime).toLocaleDateString()}</div>
            <div>Build Version: {activeReport.appVersion || '1.0.0'}</div>
          </div>
        </div>

        {/* Mandatory Ethical Limitation Warning */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Important Methodology Notice:</strong> {activeReport.limitationsNotice || 'This automated UX assessment reflects observed Playwright browser execution facts and does not substitute for human user research.'}
          </p>
        </div>

        {/* Executive Metrics Grid */}
        {activeReport.executiveSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface-subtle border border-border">
              <div className="text-xs text-text-muted uppercase">Personas Tested</div>
              <div className="text-2xl font-bold text-text-primary mt-1">
                {activeReport.executiveSummary.totalPersonas ?? 1}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-border">
              <div className="text-xs text-text-muted uppercase">Scenarios Executed</div>
              <div className="text-2xl font-bold text-text-primary mt-1">
                {activeReport.executiveSummary.totalScenarios ?? 1}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-border">
              <div className="text-xs text-text-muted uppercase">Critical Blockers</div>
              <div className="text-2xl font-bold text-red-400 mt-1">
                {activeReport.executiveSummary.criticalBlockers ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-subtle border border-border">
              <div className="text-xs text-text-muted uppercase">Friction Index</div>
              <div className="text-2xl font-bold text-teal-300 mt-1">
                {activeReport.executiveSummary.averageFrictionScore ?? 0} / 100
              </div>
            </div>
          </div>
        )}

        {/* Executive Key Risks */}
        {activeReport.executiveSummary?.keyRisks && activeReport.executiveSummary.keyRisks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2.5">
              Key Identified Usability Risks
            </h3>
            <ul className="space-y-2">
              {activeReport.executiveSummary.keyRisks.map((risk, i) => (
                <li
                  key={i}
                  className="p-3 rounded-lg bg-surface-subtle border border-border text-xs text-text-secondary flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-light shrink-0 mt-1.5"></span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Findings Table in Report */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Evidence-Linked Findings ({linkedFindings.length})
          </h3>

          {linkedFindings.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-subtle border border-border text-xs text-text-muted">
              No anomalies or critical usability blockers detected during this execution.
            </div>
          ) : (
            <div className="space-y-3">
              {linkedFindings.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl bg-surface-subtle border border-border text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={f.severity as any}>
                        {f.severity}
                      </Badge>
                      <span className="font-semibold text-text-primary">
                        {f.title}
                      </span>
                    </div>
                    <span className="text-text-muted font-mono text-[11px]">
                      Step {f.stepNumber} • {f.confidence} confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="bg-surface p-2.5 rounded border border-border">
                      <span className="text-[10px] uppercase font-bold text-text-muted block mb-0.5">
                        Observed Browser Behavior
                      </span>
                      <p className="text-text-secondary leading-relaxed font-mono text-[11px]">
                        {f.observedFacts}
                      </p>
                    </div>

                    <div className="bg-surface p-2.5 rounded border border-border">
                      <span className="text-[10px] uppercase font-bold text-teal-300 block mb-0.5">
                        Proposed Remediation
                      </span>
                      <p className="text-text-primary leading-relaxed text-[11px]">
                        {f.recommendedAction}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
