// src/components/core/Modal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footerContent,
    size = 'md', // 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', 'full'
    closeOnOverlayClick = true,
    initialFocusRef, // Optional ref for focusing an element inside the modal on open
}) => {
    const modalRef = useRef(null);

    // Handle Escape key for closing
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, onClose]);

    // Handle focus trapping and initial focus
    useEffect(() => {
        if (isOpen) {
            // Set focus to the initialFocusRef or the modal itself
            if (initialFocusRef && initialFocusRef.current) {
                initialFocusRef.current.focus();
            } else if (modalRef.current) {
                modalRef.current.focus(); // Fallback to modal itself
            }

            // Basic focus trapping (can be made more robust with a library)
            const focusableElements = modalRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements && focusableElements.length > 0) {
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                const onKeyDown = (e) => {
                    if (e.key === 'Tab') {
                        if (e.shiftKey) { // Shift + Tab
                            if (document.activeElement === firstElement) {
                                lastElement.focus();
                                e.preventDefault();
                            }
                        } else { // Tab
                            if (document.activeElement === lastElement) {
                                firstElement.focus();
                                e.preventDefault();
                            }
                        }
                    }
                };
                modalRef.current?.addEventListener('keydown', onKeyDown);
                return () => modalRef.current?.removeEventListener('keydown', onKeyDown);
            }
        }
    }, [isOpen, initialFocusRef]);


    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        full: 'max-w-full h-full rounded-none sm:rounded-lg sm:max-h-[95vh]',
    };

    // CSS-only show/hide with exit animation
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Small delay so the enter animation triggers after mount
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm
                        transition-opacity duration-200 ease-out ${visible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className={`bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl w-full ${sizeClasses[size]} flex flex-col overflow-hidden
                            ${size === 'full' ? '' : 'max-h-[90vh] sm:max-h-[85vh]'}
                            transition-all duration-300 ease-out
                            ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.98] -translate-y-4'}`}
                role="document"
                aria-modal="true"
                aria-labelledby={title ? "modal-title-text" : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light dark:border-border-dark sticky top-0 bg-surface-light dark:bg-surface-dark z-10 flex-shrink-0">
                    {title && (
                        <h2 id="modal-title-text" className="text-lg font-semibold text-text-light dark:text-text-dark truncate pr-4">
                            {title}
                        </h2>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-text-muted-light dark:text-text-muted-dark 
                                   hover:bg-gray-200/80 dark:hover:bg-gray-700/80 
                                   hover:text-red-500 dark:hover:text-red-400 
                                   focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:ring-offset-1 dark:focus:ring-offset-surface-dark"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="px-5 py-4 overflow-y-auto flex-grow custom-scrollbar">
                    {children}
                </div>

                        {/* Modal Footer */}
                {footerContent && (
                    <div className="px-5 py-3.5 border-t border-border-light dark:border-border-dark flex justify-end gap-3 sticky bottom-0 bg-surface-light dark:bg-surface-dark z-10 flex-shrink-0">
                        {footerContent}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;