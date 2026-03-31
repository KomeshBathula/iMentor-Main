// frontend/src/components/layout/LeftCollapsedNav.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Edit3, UploadCloud, FileText, ChevronRight, Settings2, History, GraduationCap, Zap } from 'lucide-react'; // Settings2 for fallback
import IconButton from '../core/IconButton.jsx';
import Animate from '../core/Animate.jsx';

// Mapping icon names (or IDs) to Lucide components
const iconMap = {
    prompt: Edit3,       // Icon for "Custom Prompt"
    upload: UploadCloud, // Icon for "Upload Document"
    docs: FileText,      // Icon for "Document List"
    history: History,
    tutor: GraduationCap,
    research: Zap
};

function LeftCollapsedNav({ isChatProcessing, onHistoryClick, onKnowledgeBaseClick }) {
    const { setIsLeftPanelOpen } = useAppState();
    const navigate = useNavigate();

    // Define the items for the collapsed navigation bar
    const navItems = [
        {
            id: 'prompt',
            label: 'Custom Prompt',
            iconName: 'prompt', // Matches key in iconMap
            action: () => {
                setIsLeftPanelOpen(true);
            }
        },
        {
            id: 'upload',
            label: 'Upload Document',
            iconName: 'upload',
            action: () => {
                onKnowledgeBaseClick?.();
            }
        },
        {
            id: 'docs',
            label: 'Document List',
            iconName: 'docs',
            action: () => {
                onKnowledgeBaseClick?.();
            }
        },
        {
            id: 'history',
            label: 'Chat History',
            iconName: 'history',
            action: onHistoryClick
        },
        {
            id: 'tutor',
            label: 'Tutor Mode',
            iconName: 'tutor',
            action: () => {
                navigate('/tutor');
            }
        },
        {
            id: 'research',
            label: 'Deep Research',
            iconName: 'research',
            action: () => {
                navigate('/tools/deep-research');
            }
        }
    ];

    return (
        <Animate
            as="aside"
            key="left-collapsed-nav"
            animation="slide-right"
            className={`fixed left-0 top-16 bottom-0 z-30 w-14 sm:w-16 
                       bg-surface-light dark:bg-surface-dark 
                       border-r border-border-light dark:border-border-dark 
                       shadow-lg flex flex-col items-center py-3 space-y-2 custom-scrollbar
                       ${isChatProcessing ? 'processing-overlay' : ''}`}
        >
            {/* Button to open the full LeftPanel - Placed at the top */}
            <IconButton
                icon={ChevronRight}
                onClick={() => setIsLeftPanelOpen(true)}
                title="Open Assistant Panel"
                ariaLabel="Open Assistant Panel"
                variant="ghost"
                size="lg" // Make it prominent
                className="mb-2 text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                disabled={isChatProcessing}
            />

            {/* Icons for different sections of LeftPanel */}
            {navItems.map(item => {
                const IconComponent = iconMap[item.iconName] || Settings2; // Fallback icon
                return (
                    <IconButton
                        key={item.id}
                        icon={IconComponent}
                        onClick={item.action} // Action currently just opens the panel
                        title={item.label}
                        ariaLabel={item.label}
                        variant="ghost"
                        size="md"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                        disabled={isChatProcessing}
                    />
                );
            })}
            {/* Add a flexible spacer if you want the open button pushed further down from items */}
            {/* <div className="flex-grow"></div> */}
        </Animate>
    );
}
export default LeftCollapsedNav;