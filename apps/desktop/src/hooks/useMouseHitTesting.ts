import {useEffect, useRef} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';

type AppWindow = ReturnType<typeof getCurrentWindow>;

interface ElementRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface CursorPosition {
    x: number;
    y: number;
}

const GEOMETRY_RETRY_DELAYS_MS = [300, 1000, 3000];
const GEOMETRY_RETRY_INTERVAL_MS = 2000;

const queryDragRects = (): ElementRect[] => {
    const rects: ElementRect[] = [];
    document.querySelectorAll('[data-tauri-drag-region]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        rects.push({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom
        });
    });
    return rects;
};

export const useMouseHitTesting = (dependencies: any[]) => {
    const winRef = useRef<AppWindow | null>(null);
    const lastCursorRef = useRef<CursorPosition | null>(null);
    const innerPosRef = useRef<CursorPosition>({x: 0, y: 0});
    const scaleFactorRef = useRef(1);
    const geometryReadyRef = useRef(false);
    const lastIgnoreRef = useRef<boolean | null>(null);

    const applyIgnoreState = (shouldIgnore: boolean) => {
        const win = winRef.current;
        if (!win || lastIgnoreRef.current === shouldIgnore) return;
        lastIgnoreRef.current = shouldIgnore;
        win.setIgnoreCursorEvents(shouldIgnore).catch(console.error);
    };

    const evaluate = () => {
        if (!winRef.current) return;

        const rects = queryDragRects();

        if (rects.length === 0) {
            applyIgnoreState(true);
            return;
        }

        const cursor = lastCursorRef.current;
        if (!cursor || !geometryReadyRef.current) return;

        const {x: originX, y: originY} = innerPosRef.current;
        const scale = scaleFactorRef.current;

        let isEnter = false;
        for (const rect of rects) {
            const left = originX + rect.left * scale;
            const top = originY + rect.top * scale;
            const right = originX + rect.right * scale;
            const bottom = originY + rect.bottom * scale;

            if (cursor.x >= left && cursor.x <= right &&
                cursor.y >= top && cursor.y <= bottom) {
                isEnter = true;
                break;
            }
        }

        applyIgnoreState(!isEnter);
    };

    const refreshGeometry = async () => {
        const win = winRef.current;
        if (!win) return;

        try {
            const position = await win.innerPosition();
            innerPosRef.current = {x: position.x, y: position.y};
            scaleFactorRef.current = await win.scaleFactor();
            geometryReadyRef.current = true;
            evaluate();
        } catch (e) {
            console.error("Failed to refresh window geometry:", e);
        }
    };

    useEffect(() => {
        evaluate();
    }, dependencies);

    useEffect(() => {
        let disposed = false;
        let streamStarted = false;
        let geometryInterval: number | undefined;
        const unlisteners: Array<(() => void) | undefined> = [];
        const timeoutIds: number[] = [];

        const init = async () => {
            try {
                const win = getCurrentWindow();
                winRef.current = win;

                await invoke('start_global_mouse_stream').catch(console.error);
                streamStarted = true;
                if (disposed) return;

                await win.setIgnoreCursorEvents(true)
                    .catch(e => console.error("Initial ignore cursor failed:", e));
                lastIgnoreRef.current = true;
                if (disposed) return;

                await refreshGeometry();

                geometryInterval = window.setInterval(() => {
                    if (disposed || geometryReadyRef.current) {
                        window.clearInterval(geometryInterval);
                        return;
                    }
                    refreshGeometry();
                }, GEOMETRY_RETRY_INTERVAL_MS);

                GEOMETRY_RETRY_DELAYS_MS.forEach(delay => {
                    timeoutIds.push(window.setTimeout(() => {
                        if (!disposed) refreshGeometry();
                    }, delay));
                });

                unlisteners.push(await win.onMoved(() => {
                    refreshGeometry();
                }));
                if (disposed) return;

                unlisteners.push(await win.onResized(() => {
                    evaluate();
                }));
                if (disposed) return;

                unlisteners.push(await win.onFocusChanged(({payload: focused}) => {
                    if (focused && !disposed) refreshGeometry();
                }));
                if (disposed) return;

                unlisteners.push(await listen<string>('device-mouse-move', ({payload}) => {
                    try {
                        const {x: payloadX, y: payloadY} = JSON.parse(payload);
                        lastCursorRef.current = {x: payloadX, y: payloadY};
                        evaluate();
                    } catch (e) {
                    }
                }));
            } catch (e) {
                console.error("Failed to init hit testing:", e);
            }
        };

        init();

        return () => {
            disposed = true;
            timeoutIds.forEach(id => clearTimeout(id));
            if (geometryInterval !== undefined) {
                window.clearInterval(geometryInterval);
            }
            unlisteners.forEach(unlisten => unlisten?.());
            if (streamStarted) {
                invoke('stop_global_mouse_stream').catch(console.error);
            }
            winRef.current = null;
            lastIgnoreRef.current = null;
        };
    }, []);
};
