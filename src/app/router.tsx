import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProjectsListPage } from '../features/projects/ProjectsListPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { PersonasPage } from '../features/personas/PersonasPage';
import { ScenariosPage } from '../features/scenarios/ScenariosPage';
import { ScenarioBuilderPage } from '../features/scenarios/ScenarioBuilderPage';
import { RunsPage } from '../features/runs/RunsPage';
import { RunMonitorPage } from '../features/runs/RunMonitorPage';
import { FindingsPage } from '../features/findings/FindingsPage';
import { FindingDetailPage } from '../features/findings/FindingDetailPage';
import { ComparisonsPage } from '../features/comparisons/ComparisonsPage';
import { RoadmapPage } from '../features/roadmap/RoadmapPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { IntentDetectivePage } from '../features/detective/IntentDetectivePage';
import { NotFoundPage } from './NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'detective',
        element: <IntentDetectivePage />,
      },
      {
        path: 'projects',
        element: <ProjectsListPage />,
      },
      {
        path: 'projects/new',
        element: <ProjectsListPage />, // opens modal on route
      },
      {
        path: 'projects/:id',
        element: <ProjectDetailPage />,
      },
      {
        path: 'personas',
        element: <PersonasPage />,
      },
      {
        path: 'personas/new',
        element: <PersonasPage />,
      },
      {
        path: 'personas/:id',
        element: <PersonasPage />,
      },
      {
        path: 'scenarios',
        element: <ScenariosPage />,
      },
      {
        path: 'scenarios/new',
        element: <ScenarioBuilderPage />,
      },
      {
        path: 'scenarios/:id',
        element: <ScenarioBuilderPage />,
      },
      {
        path: 'runs',
        element: <RunsPage />,
      },
      {
        path: 'runs/:id',
        element: <RunMonitorPage />,
      },
      {
        path: 'findings',
        element: <FindingsPage />,
      },
      {
        path: 'findings/:id',
        element: <FindingDetailPage />,
      },
      {
        path: 'comparisons',
        element: <ComparisonsPage />,
      },
      {
        path: 'roadmap',
        element: <RoadmapPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
