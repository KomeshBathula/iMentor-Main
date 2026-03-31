// frontend/src/components/admin/LlmUsageChart.jsx
import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(ArcElement, Tooltip, Legend);

const LlmUsageChart = ({ data }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const chartLabels = data.map(d => d.provider.charAt(0).toUpperCase() + d.provider.slice(1));
    const chartDataPoints = data.map(d => d.count);

    // Define a consistent color map for providers
    const colorMap = {
        gemini: 'rgba(59, 130, 246, 0.7)', // blue-500
        ollama: 'rgba(16, 185, 129, 0.7)', // emerald-500
        groq: 'rgba(249, 115, 22, 0.7)', // orange-500
        'fine-tuned': 'rgba(239, 68, 68, 0.7)', // red-500
    };
    const borderColorMap = {
        gemini: 'rgba(59, 130, 246, 1)',
        ollama: 'rgba(16, 185, 129, 1)',
        groq: 'rgba(249, 115, 22, 1)',
        'fine-tuned': 'rgba(239, 68, 68, 1)',
    };

    const fallbackPalette = [
        { bg: 'rgba(107, 114, 128, 0.7)', border: 'rgba(107, 114, 128, 1)' },
        { bg: 'rgba(168, 85, 247, 0.7)', border: 'rgba(168, 85, 247, 1)' },
        { bg: 'rgba(14, 165, 233, 0.7)', border: 'rgba(14, 165, 233, 1)' },
        { bg: 'rgba(236, 72, 153, 0.7)', border: 'rgba(236, 72, 153, 1)' },
        { bg: 'rgba(132, 204, 22, 0.7)', border: 'rgba(132, 204, 22, 1)' }
    ];

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: isDarkMode ? '#E2E8F0' : '#0F172A',
                    font: { size: 12 },
                },
            },
            title: {
                display: true,
                text: 'LLM Provider Usage Distribution',
                color: isDarkMode ? '#E2E8F0' : '#0F172A',
                font: { size: 16, weight: 'bold' }
            },
            tooltip: {
                backgroundColor: isDarkMode ? '#334155' : '#FFFFFF',
                titleColor: isDarkMode ? '#E2E8F0' : '#0F172A',
                bodyColor: isDarkMode ? '#CBD5E1' : '#475569',
            }
        },
    };

    const pieChartData = {
        labels: chartLabels,
        datasets: [{
            label: 'Query Count',
            data: chartDataPoints,
            backgroundColor: data.map((d, idx) => colorMap[d.provider] || fallbackPalette[idx % fallbackPalette.length].bg),
            borderColor: data.map((d, idx) => borderColorMap[d.provider] || fallbackPalette[idx % fallbackPalette.length].border),
            borderWidth: 1,
        }],
    };

    return (
        <div className="card-base p-4 h-96">
            <Pie options={chartOptions} data={pieChartData} />
        </div>
    );
};

export default LlmUsageChart;