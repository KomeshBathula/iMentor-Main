import React from 'react';

function HighlightOverlay({ targetRect }) {
    if (!targetRect) {
        return (
            <div className="fixed inset-0 z-[120] pointer-events-none bg-slate-950/70 backdrop-blur-[1.5px]" />
        );
    }

    return (
        <div className="fixed inset-0 z-[120] pointer-events-none">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1.5px]" />
            <div
                className="absolute rounded-2xl"
                style={{
                    left: `${targetRect.left - 8}px`,
                    top: `${targetRect.top - 8}px`,
                    width: `${targetRect.width + 16}px`,
                    height: `${targetRect.height + 16}px`,
                    boxShadow:
                        '0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 0 2px rgba(45, 212, 191, 0.9), 0 0 34px rgba(45, 212, 191, 0.45)',
                    transition: 'all 260ms ease'
                }}
            />
        </div>
    );
}

export default HighlightOverlay;
