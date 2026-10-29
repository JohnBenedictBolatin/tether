import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const mount = document.getElementById('root');
if (!mount) throw new Error('Tether root element is missing.');
createRoot(mount).render(<React.StrictMode><App /></React.StrictMode>);
