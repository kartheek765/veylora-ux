import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export interface ScreenContextSummary {
  route: string;
  pageTitle: string;
  contextText: string;
}

export function useScreenContext(): ScreenContextSummary {
  const location = useLocation();

  const context = useMemo(() => {
    const route = location.pathname;
    
    // Extract main heading
    const h1 = document.querySelector('h1')?.textContent?.trim() || '';
    const h2 = document.querySelector('h2')?.textContent?.trim() || '';
    const pageTitle = h1 || h2 || 'Veylora UX';

    // Collect visible interactive button labels (safe, excluding sensitive inputs)
    const buttons: string[] = [];
    document.querySelectorAll('button:not([disabled])').forEach((btn, idx) => {
      if (idx < 8) {
        const text = btn.textContent?.trim();
        if (text && text.length > 1 && text.length < 40 && !text.includes('••••')) {
          buttons.push(text.replace(/\s+/g, ' '));
        }
      }
    });

    // Check for active alerts or status badges
    const statusBadges: string[] = [];
    document.querySelectorAll('[role="status"], [role="alert"]').forEach((el, idx) => {
      if (idx < 3) {
        const text = el.textContent?.trim();
        if (text && text.length < 60) {
          statusBadges.push(text);
        }
      }
    });

    const contextText = [
      `Active Route: ${route}`,
      `Visible Page Heading: "${pageTitle}"`,
      buttons.length > 0 ? `Visible Action Buttons: [${buttons.join(', ')}]` : null,
      statusBadges.length > 0 ? `Active Status Indicators: [${statusBadges.join(' | ')}]` : null
    ]
      .filter(Boolean)
      .join('\n');

    return {
      route,
      pageTitle,
      contextText
    };
  }, [location.pathname, location.search]);

  return context;
}
