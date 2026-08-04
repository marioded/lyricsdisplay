import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import {initDesktopServices} from "@/init";

async function main() {
    await initDesktopServices();

    const rootElement = document.getElementById('root');

    if (!rootElement) {
        console.error('Main.tsx: Root element not found!');
        return;
    }

    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    );

    postMessage({payload: 'removeLoading'}, '*');
}

main();