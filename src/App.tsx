import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { StorageService } from './services/storageService';

export const App: React.FC = () => {
  useEffect(() => {
    StorageService.init();
  }, []);

  return <RouterProvider router={router} />;
};

export default App;
