"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PlotData, Layout } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface DepthProfileProps {
  data: any[];
  variable?: 'temp' | 'psal' | 'doxy' | 'chla' | string;
  title?: string;
}

export function DepthProfile({ data, variable = 'temp', title }: DepthProfileProps) {
  const cleanData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data
      .map((d) => {
        const val = Number(d[variable] ?? d.temp ?? d.temperature ?? d.psal ?? d.salinity ?? d.doxy ?? 0);
        const pres = Number(d.pres ?? d.pressure ?? d.depth ?? 0);
        return { val, pres };
      })
      .filter((d) => !isNaN(d.val) && !isNaN(d.pres) && isFinite(d.val) && isFinite(d.pres))
      .sort((a, b) => a.pres - b.pres);
  }, [data, variable]);

  const plotData = useMemo((): Partial<PlotData>[] => {
    if (cleanData.length === 0) return [];

    const varName = String(variable).toUpperCase();
    const color =
      variable.toLowerCase().includes('psal') || variable.toLowerCase().includes('sal')
        ? '#2BFFBD'
        : variable.toLowerCase().includes('doxy') || variable.toLowerCase().includes('oxy')
        ? '#00F0FF'
        : '#FF4B2B';

    const traces: Partial<PlotData>[] = [
      {
        x: cleanData.map((d) => d.val),
        y: cleanData.map((d) => d.pres),
        mode: 'lines+markers',
        name: varName,
        line: {
          color,
          width: 2.5,
          shape: 'spline',
        },
        marker: {
          size: 5,
          color,
          opacity: 0.8,
        },
        type: 'scatter',
      },
    ];

    return traces;
  }, [cleanData, variable]);

  const layout: Partial<Layout> = {
    title: {
      text: title || `${String(variable).toUpperCase()} vs Depth (Pressure)`,
      font: { color: '#E2E8F0', family: 'Inter, sans-serif' },
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(15, 23, 42, 0.5)',
    xaxis: {
      title: {
        text: String(variable).toUpperCase(),
        font: { color: '#94A3B8' },
      },
      gridcolor: 'rgba(255,255,255,0.05)',
      tickfont: { color: '#94A3B8' },
    },
    yaxis: {
      title: {
        text: 'Pressure / Depth (dbar)',
        font: { color: '#94A3B8' },
      },
      autorange: 'reversed', // High pressure is deeper in oceanography
      gridcolor: 'rgba(255,255,255,0.05)',
      tickfont: { color: '#94A3B8' },
    },
    margin: { l: 60, r: 20, t: 50, b: 50 },
    showlegend: true,
    legend: { font: { color: '#94A3B8' } },
    hovermode: 'closest',
    autosize: true,
  };

  if (cleanData.length === 0) return null;

  return (
    <div className="w-full h-full min-h-[360px] glass-card rounded-2xl overflow-hidden p-3">
      <Plot
        data={plotData}
        layout={layout}
        useResizeHandler
        className="w-full h-full"
        config={{ displayModeBar: false, responsive: true }}
      />
    </div>
  );
}
