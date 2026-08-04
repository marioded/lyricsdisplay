import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import './index.css'
import {initDesktopServices} from "@/init";

initDesktopServices()

const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('Main.tsx: Root element not found!');
} else {
    ReactDOM.createRoot(rootElement as HTMLElement).render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    )
}

postMessage({payload: 'removeLoading'}, '*')