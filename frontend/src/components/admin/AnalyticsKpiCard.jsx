// frontend/src/components/admin/AnalyticsKpiCard.jsx
import React from 'react';
import Animate from '../core/Animate.jsx';

const AnalyticsKpiCard = ({ title, value, icon: Icon, colorClass = 'blue' }) => {

    const colorStyles = {
        blue: {
            iconBg: 'bg-blue-500/10',
            iconText: 'text-blue-500',
        },
        green: {
            iconBg: 'bg-green-500/10',
            iconText: 'text-green-500',
        },
        indigo: {
            iconBg: 'bg-indigo-500/10',
            iconText: 'text-indigo-500',
        },
        yellow: {
            iconBg: 'bg-yellow-500/10',
            iconText: 'text-yellow-500',
        },
        // --- NEW COLORS FOR ADDITIONAL KPIS ---
        orange: {
            iconBg: 'bg-orange-500/10',
            iconText: 'text-orange-500',
        },
        sky: {
            iconBg: 'bg-sky-500/10',
            iconText: 'text-sky-500',
        }
    };

    const styles = colorStyles[colorClass] || colorStyles.blue;

    return (
        <Animate animation="slide-up" duration="0.5s" className="card-base p-5 flex items-center gap-5">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${styles.iconBg}`}>
                <Icon size={24} className={styles.iconText} />
            </div>
            <div>
                <p className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark">{title}</p>
                <p className="text-3xl font-bold text-text-light dark:text-text-dark">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
        </Animate>
    );
};

export default AnalyticsKpiCard;