// frontend/src/components/admin/ExternalServicesNav.jsx
import React from 'react';
import { BarChart3, LayoutDashboard, Bug, DatabaseZap, Share2, Server } from 'lucide-react';

// Actual ports from docker-compose.yml — shifted to avoid conflicts:
//   Prometheus  9091:9090   Grafana  3002:3000
//   Qdrant      6335:6333   Neo4j    7475:7474
//   Elastic     9201:9200   (Kibana not deployed)
const services = [
    {
        name: 'Prometheus',
        url: 'http://localhost:9091/targets',
        icon: BarChart3,
        description: 'Live scrape targets and application metrics.'
    },
    {
        name: 'Grafana',
        url: 'http://localhost:3002/',
        icon: LayoutDashboard,
        description: 'Visualize metrics in custom dashboards.'
    },
    {
        name: 'Qdrant',
        url: 'http://localhost:6335/dashboard#/collections',
        icon: DatabaseZap,
        description: 'Inspect vector collections and embeddings.'
    },
    {
        name: 'Neo4j Browser',
        url: 'http://localhost:7475/browser/',
        icon: Share2,
        description: 'Query and visualize the knowledge graph.'
    },
    {
        name: 'Elasticsearch',
        url: 'http://localhost:9201/',
        icon: Server,
        description: 'Full-text search & log index health.'
    },
    {
        name: 'Sentry',
        url: import.meta.env.VITE_SENTRY_URL || null,
        icon: Bug,
        description: 'Monitor and debug application errors and crashes.'
    },
];

const iconColors = [
    { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    { bg: 'bg-red-500/20', text: 'text-red-400' },
    { bg: 'bg-teal-500/20', text: 'text-teal-400' },
    { bg: 'bg-pink-500/20', text: 'text-pink-400' },
];

const ExternalServicesNav = () => {
    return (
        <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-gray-400" />
                Monitoring &amp; Service Dashboards
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.filter(s => s.url).map((service, idx) => {
                    const color = iconColors[idx % iconColors.length];
                    return (
                        <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={service.name}
                            title={service.description}
                            className="group flex items-center gap-4 p-4 bg-gray-800/60 hover:bg-gray-700/70 border border-gray-700 hover:border-gray-500 rounded-xl transition-all duration-200"
                        >
                            <div className={`p-2.5 rounded-lg ${color.bg} ${color.text} shrink-0`}>
                                <service.icon size={20} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white text-sm">{service.name}</h4>
                                <p className="text-xs text-gray-400 mt-0.5">Launch Service</p>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
};

export default ExternalServicesNav;
