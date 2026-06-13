'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: { color: '#94a3b8', boxWidth: 12, padding: 16 },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#475569',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(51, 65, 85, 0.4)' },
      ticks: { color: '#94a3b8' },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(51, 65, 85, 0.4)' },
      ticks: { color: '#94a3b8', precision: 0 },
    },
  },
};

function buildChartData(periods) {
  return {
    labels: periods.map((p) => p.label),
    datasets: [
      {
        label: 'Total',
        data: periods.map((p) => p.total),
        backgroundColor: 'rgba(59, 130, 246, 0.75)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Published',
        data: periods.map((p) => p.published),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Failed',
        data: periods.map((p) => p.failed),
        backgroundColor: 'rgba(239, 68, 68, 0.75)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };
}

export function ArticlesChart({ weekData, monthData }) {
  const [view, setView] = useState('week');

  const chartData = useMemo(
    () => buildChartData(view === 'week' ? weekData : monthData),
    [view, weekData, monthData]
  );

  const subtitle =
    view === 'week'
      ? 'Articles per day this week'
      : 'Articles per month this year';

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center">
            <BarChart3 className="mr-2 text-blue-400" size={20} />
            Article Activity
          </h2>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex rounded-lg border border-slate-700/50 overflow-hidden self-start">
          <button
            type="button"
            onClick={() => setView('week')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              view === 'week'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setView('months')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-700/50 ${
              view === 'months'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            Months
          </button>
        </div>
      </div>

      <div className="h-72">
        <Bar options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
