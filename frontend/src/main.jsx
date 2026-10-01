import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from './lib/theme.jsx';
import { OnlineProvider } from './lib/online.jsx';
import './styles/globals.css';
import App from './App.jsx';

const router = createBrowserRouter([{ path: '*', element: <App /> }]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <OnlineProvider>
          <RouterProvider router={router} />
        </OnlineProvider>
      </ThemeProvider>
    </MotionConfig>
  </React.StrictMode>
);
