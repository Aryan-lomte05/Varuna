"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PlotData, Layout } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface TSIsopycnalsProps {
  data: any[];
  title?: string;
}

/**
 * T-S Diagram (Temperature vs Salinity) with calculated Sigma-t Isopycnals.
 * Critical tool for physical oceanographers to identify water masses.
 */
export function TSIsopycnals({ data, title }: TSIsopycnalsProps) {
  const cleanData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data
      .map((d) => ({
        temp: Number(d.temp ?? d.temperature ?? d.avg_temp),
        psal: Number(d.psal ?? d.salinity ?? d.avg_psal),
        pres: Number(d.pres ?? d.pressure ?? d.depth ?? 0),
      }))
      .filter((d) => !isNaN(d.temp) && !isNaN(d.psal) && isFinite(d.temp) && isFinite(d.psal));
  }, [data]);

  const plotData = useMemo((): Partial<PlotData>[] => {
    if (cleanData.length === 0) return [];

    // 1. Data Points
    const traces: Partial<PlotData>[] = [
      {
        x: cleanData.map((d) => d.psal),
        y: cleanData.map((d) => d.temp),
        mode: 'markers',
        name: 'Observations',
        marker: {
          size: 7,
          color: cleanData.map((d) => d.pres),
          colorscale: 'Viridis',
          reversescale: true,
          showscale: true,
          colorbar: {
            title: {
              text: 'Depth (dbar)',
              font: { color: '#94A3B8' },
            },
            tickfont: { color: '#94A3B8' },
          },
        },
        type: 'scatter',
      },
    ];

    // 2. Isopycnal lines (Sigma-t)
    const psalValues = cleanData.map((d) => d.psal);
    const tempValues = cleanData.map((d) => d.temp);
    const minP = Math.min(...psalValues);
    const maxP = Math.max(...psalValues);
    const minT = Math.min(...tempValues);
    const maxT = Math.max(...tempValues);

    const sMin = isFinite(minP) ? Math.floor(minP - 0.5) : 34;
    const sMax = isFinite(maxP) ? Math.ceil(maxP + 0.5) : 37;
    const tMin = isFinite(minT) ? Math.floor(minT - 1) : 10;
    const tMax = isFinite(maxT) ? Math.ceil(maxT + 1) : 32;

    const sRange = Array.from({ length: 20 }, (_, i) => sMin + (i * (sMax - sMin)) / 19);
    const tRange = Array.from({ length: 20 }, (_, i) => tMin + (i * (tMax - tMin)) / 19);

    const calcSigma = (T: number, S: number) => {
      return 28.106 - 0.0735 * T - 0.00469 * T * T + (0.802 - 0.002 * T) * (S - 35);
    };

    [23, 24, 25, 26, 27, 28].forEach((sig) => {
      const x: number[] = [];
      const y: number[] = [];
      sRange.forEach((s) => {
        tRange.forEach((t) => {
          if (Math.abs(calcSigma(t, s) - sig) < 0.15) {
            x.push(s);
            y.push(t);
          }
        });
      });

      if (x.length > 1) {
        traces.push({
          x,
          y,
          mode: 'lines',
          name: `σ=${sig}`,
          line: { color: 'rgba(255,255,255,0.15)', dash: 'dot', width: 1 },
          showlegend: false,
          hoverinfo: 'skip',
        });
      }
    });

    return traces;
  }, [cleanData]);

  const layout: Partial<Layout> = {
    title: {
      text: title || 'T-S Diagram (Temperature vs Salinity Isopycnals)',
      font: { color: '#E2E8F0', family: 'Inter, sans-serif' },
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(15, 23, 42, 0.5)',
    xaxis: {
      title: {
        text: 'Salinity (PSU)',
        font: { color: '#94A3B8' },
      },
      gridcolor: 'rgba(255,255,255,0.05)',
      tickfont: { color: '#94A3B8' },
    },
    yaxis: {
      title: {
        text: 'Temperature (°C)',
        font: { color: '#94A3B8' },
      },
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
