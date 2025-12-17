'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---
type ChartType = 'bar' | 'line' | 'pie' | 'stat';

interface ChartWidget {
    id: string;
    type: ChartType;
    title: string;
    description?: string;
    data: any[];
    config: {
        xKey?: string; 
        yKeys?: string[]; // For bar/line (multiple series)
        nameKey?: string; // For pie
        valueKey?: string; // For pie
        colors?: string[];
        statValue?: string | number; // For stat cards
        statLabel?: string;
        statTrend?: string; // e.g. "+5%"
    };
}

interface DashboardProps {
    title: string;
    widgets: ChartWidget[];
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Colors ---
// --- Colors ---
// Vivid, solid neon colors for maximum visibility on dark backgrounds
const COLORS = ['#2DD4BF', '#F472B6', '#fbbf24', '#A78BFA', '#60A5FA', '#34D399'];

// --- Component ---
export default function Dashboard({ title, widgets }: DashboardProps) {
  return (
    <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden my-6 shadow-2xl ring-1 ring-white/10">
      {/* Header */}
      <div className="bg-neutral-900/80 backdrop-blur-md px-6 py-4 border-b border-neutral-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <div className="h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)] animate-pulse" />
             <h2 className="text-lg font-bold text-neutral-100 tracking-wide">{title}</h2>
        </div>
        <div className="px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-[11px] font-mono font-bold text-teal-300 uppercase tracking-wider">
            Live Data
        </div>
      </div>

      {/* Grid Layout */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/50">
        {widgets.map((widget) => (
          <div 
             key={widget.id} 
             className={cn(
               "relative group overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60 p-5 transition-all duration-200 hover:border-neutral-600 hover:bg-neutral-900 hover:shadow-lg",
               // Rule: Stat cards take 1 column. Charts (bar/line/pie) ALWAYS take full width (2 columns) on tablet+ for better visibility.
               widget.type === 'stat' ? "col-span-1" : "col-span-1 md:col-span-2 min-h-[400px]"
             )}
          >
             <div className="flex items-start justify-between mb-4 relative z-10">
                 <div>
                    <h3 className="text-md font-bold text-neutral-200 tracking-tight">{widget.title}</h3>
                    {widget.description && <p className="text-sm text-neutral-500 mt-1">{widget.description}</p>}
                 </div>
             </div>
             
             <div className="flex-1 w-full min-h-[300px] flex items-center justify-center relative z-10 pt-2">
                {renderWidgetContent(widget)}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ... helper functions remain the same ...

// --- Helper Functions ---
function formatValue(value: any, key: string) {
    if (typeof value === 'number') {
        if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('price') || key.toLowerCase().includes('cost')) {
             return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
        }
        return new Intl.NumberFormat('en-US').format(value);
    }
    return value;
}

// --- Tooltip ---
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-neutral-900 border border-neutral-700 rounded shadow-xl p-3 z-50">
                <p className="text-neutral-400 text-xs font-semibold mb-2 border-b border-neutral-800 pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-xs font-medium my-1">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                        <span className="text-neutral-400">{entry.name.replace(/_/g, ' ')}:</span>
                        <span className="text-neutral-200 font-mono font-bold">{formatValue(entry.value, entry.name)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// --- Widget Renderer ---
function renderWidgetContent(widget: ChartWidget) {
    const { type, data, config } = widget;
    // Boost brightness if custom colors aren't provided
    const colors = config.colors || COLORS;

    switch (type) {
        case 'stat':
             return (
                 <div className="flex flex-col items-center justify-center text-center w-full px-4 py-6">
                     <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-100 mb-3 break-words line-clamp-2 w-full">
                        {config.statValue}
                     </div>
                     <div className="text-xs font-bold text-teal-400 uppercase tracking-widest bg-teal-900/20 px-3 py-1 rounded full mb-3 border border-teal-800/50">
                        {config.statLabel}
                     </div>
                     {config.statTrend && (
                         <div className={cn("text-xs font-bold flex items-center gap-1", config.statTrend.includes('+') ? "text-emerald-400" : "text-rose-400")}>
                             <span>{config.statTrend.includes('+') ? '▲' : '▼'}</span>
                             {config.statTrend} vs last month
                         </div>
                     )}
                 </div>
             );

        case 'bar':
             return (
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                    <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis 
                            dataKey={config.xKey || 'name'} 
                            stroke="#525252" 
                            tick={{fill: '#a3a3a3', fontSize: 13, fontWeight: 600}} 
                            axisLine={{ stroke: '#404040' }}
                            tickLine={false} 
                            dy={10}
                        />
                        <YAxis 
                            stroke="#525252" 
                            tick={{fill: '#a3a3a3', fontSize: 13, fontWeight: 600, fontFamily: 'monospace'}} 
                            axisLine={false} 
                            tickLine={false}
                            tickFormatter={(value) => value >= 1000 ? `${value/1000}k` : value}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{fill: '#262626', opacity: 0.6}} />
                        <Legend 
                            wrapperStyle={{paddingTop: '20px', fontSize: '13px', color: '#a3a3a3'}}
                            formatter={(value) => <span style={{color: '#d4d4d4', fontWeight: 600, textTransform: 'capitalize'}}>{value.replace(/_/g, ' ')}</span>} 
                        />
                        
                        {(config.yKeys || ['value']).map((key, index) => (
                            <Bar 
                                key={key} 
                                dataKey={key} 
                                fill={colors[index % colors.length]} 
                                radius={[4, 4, 0, 0]} 
                                maxBarSize={60}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        case 'line':
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis 
                            dataKey={config.xKey || 'name'} 
                            stroke="#525252" 
                            tick={{fill: '#a3a3a3', fontSize: 13, fontWeight: 600}} 
                            axisLine={{ stroke: '#404040' }}
                            dy={10}
                        />
                        <YAxis 
                            stroke="#525252" 
                            tick={{fill: '#a3a3a3', fontSize: 13, fontWeight: 600, fontFamily: 'monospace'}} 
                            tickFormatter={(value) => value >= 1000 ? `${value/1000}k` : value}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                           wrapperStyle={{paddingTop: '20px', fontSize: '13px', color: '#a3a3a3'}} 
                           formatter={(value) => <span style={{color: '#d4d4d4', fontWeight: 600, textTransform: 'capitalize'}}>{value.replace(/_/g, ' ')}</span>}
                        />
                        {(config.yKeys || ['value']).map((key, index) => (
                            <Line 
                                key={key} 
                                type="monotone" 
                                dataKey={key} 
                                stroke={colors[index % colors.length]} 
                                strokeWidth={4}
                                dot={{r: 4, fill: '#171717', strokeWidth: 2, stroke: colors[index % colors.length]}}
                                activeDot={{r: 7, strokeWidth: 0, fill: '#fff'}}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            );

        case 'pie':
             return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey={config.valueKey || 'value'}
                            nameKey={config.nameKey || 'name'}
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                           layout="vertical" 
                           verticalAlign="middle" 
                           align="right"
                           formatter={(value, entry: any) => <span style={{color: '#d4d4d4', fontSize: '13px', fontWeight: 600, marginLeft: '8px'}}>{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
             );
        
        default:
            return <div className="text-red-500 font-bold p-4">Unknown chart type: {type}</div>;
    }
}
