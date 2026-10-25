import { Report, Run, Finding, EvidenceItem } from '../types';

export class ExportService {
  static downloadJson(filename: string, data: unknown): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static downloadReportHtml(
    report: Report,
    run?: Run,
    findings: Finding[] = [],
    evidence: EvidenceItem[] = []
  ): void {
    const findingsListHtml = findings
      .map(
        (f, i) => `
      <div style="background:#131B26; border:1px solid #1E293B; border-radius:8px; padding:16px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:600; text-transform:uppercase; color:${
            f.severity === 'critical' ? '#EF4444' : f.severity === 'high' ? '#F97316' : '#F59E0B'
          }; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px;">
            ${f.severity} • ${f.confidence} confidence
          </span>
          <span style="font-size:12px; color:#64748B;">Finding #${i + 1} (${f.category})</span>
        </div>
        <h3 style="margin:0 0 8px 0; font-size:15px; color:#F8FAFC;">${f.title}</h3>
        <p style="margin:0 0 8px 0; font-size:13px; color:#94A3B8;"><strong style="color:#CBD5E1;">Observed Facts:</strong> ${f.observedFacts}</p>
        <p style="margin:0 0 8px 0; font-size:13px; color:#94A3B8;"><strong style="color:#CBD5E1;">Possible Cause:</strong> ${f.possibleCause}</p>
        <p style="margin:0; font-size:13px; color:#2DD4BF;"><strong style="color:#14B8A6;">Recommendation:</strong> ${f.recommendedAction}</p>
        <div style="margin-top:10px; font-size:11px; color:#64748B;">Target URL: ${f.pageUrl} (Step ${f.stepNumber})</div>
      </div>
    `
      )
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veylora UX — ${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0F17; color: #F8FAFC; margin: 0; padding: 40px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 1px solid #1E293B; padding-bottom: 24px; margin-bottom: 30px; }
    .badge { display: inline-block; background: #6366F1; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; color: #F8FAFC; }
    .tagline { color: #94A3B8; font-size: 14px; margin: 0; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .metric-card { background: #111722; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 22px; font-weight: 700; color: #6366F1; margin-bottom: 4px; }
    .metric-lbl { font-size: 12px; color: #64748B; text-transform: uppercase; }
    .notice { background: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 12px 16px; font-size: 13px; color: #FCD34D; border-radius: 4px; margin: 24px 0; }
    .section-title { font-size: 18px; margin: 32px 0 16px 0; border-bottom: 1px solid #1E293B; padding-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">Veylora UX Evidence Report</span>
      <h1>${report.title}</h1>
      <p class="tagline">Generated: ${new Date(report.generationTime).toLocaleString()} | Schema: ${report.reportSchemaVersion}</p>
    </div>

    <div class="notice">
      <strong>Important Limitation:</strong> ${report.limitationsNotice}
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-val">${report.executiveSummary.totalPersonas}</div>
        <div class="metric-lbl">Synthetic Agents Evaluated</div>
      </div>
      <div class="metric-card">
        <div class="metric-val">${report.executiveSummary.totalScenarios}</div>
        <div class="metric-lbl">Scenarios Executed</div>
      </div>
      <div class="metric-card">
        <div class="metric-val" style="color:#EF4444">${report.executiveSummary.criticalBlockers}</div>
        <div class="metric-lbl">Critical Blockers</div>
      </div>
      <div class="metric-card">
        <div class="metric-val" style="color:#2DD4BF">${report.executiveSummary.averageFrictionScore}/100</div>
        <div class="metric-lbl">Friction Index</div>
      </div>
    </div>

    <h2 class="section-title">Key Executive Risks</h2>
    <ul>
      ${report.executiveSummary.keyRisks.map(r => `<li style="margin-bottom:8px; font-size:14px; color:#CBD5E1;">${r}</li>`).join('')}
    </ul>

    <h2 class="section-title">Evidence-Linked Findings (${findings.length})</h2>
    ${findingsListHtml}

    <div style="margin-top: 40px; border-top: 1px solid #1E293B; padding-top: 20px; font-size: 12px; color: #64748B; text-align: center;">
      Veylora UX — See the friction. Prove the path. Generated autonomously in local demonstration workbench.
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-export.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
