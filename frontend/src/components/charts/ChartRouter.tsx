"use client";

import React, { useMemo } from 'react';
import { DepthProfile } from './DepthProfile';
import { TSIsopycnals } from './TSIsopycnals';
import { HovmollerDiagram } from './HovmollerDiagram';
import { Surface3D } from './Surface3D';
import { AnomalySeries } from './AnomalySeries';
import { SeasonalBoxplots } from './SeasonalBoxplots';
import { WindRose } from './WindRose';
import { TimeSeries } from './TimeSeries';
import { O2TempCorrelation } from './O2TempCorrelation';
import { ChlaNitrateScatter } from './ChlaNitrateScatter';
import { FloatTrajectoryChart } from './FloatTrajectoryChart';

interface ChartRouterProps {
  vizSpecs?: {
    chart_type?: string | null;
    chart_data?: any;
    x_variable?: string;
    y_variable?: string;
    title?: string;
    [key: string]: any;
  } | Record<string, any> | null;
  rows?: Record<string, any>[] | null;
}

export function ChartRouter({ vizSpecs, rows }: ChartRouterProps) {
  const chartType = useMemo(() => {
    if (vizSpecs?.chart_type) return vizSpecs.chart_type;

    // Auto-detect chart type from row vector fields
    if (rows && rows.length > 0) {
      const sample = rows[0];
      const keys = Object.keys(sample).map((k) => k.toLowerCase());

      if (keys.includes('pres') && (keys.includes('temp') || keys.includes('psal'))) {
        return 'depth_profile';
      }
      if (keys.includes('time') || keys.includes('date') || keys.includes('month') || keys.includes('timestamp')) {
        return 'time_series';
      }
      if (keys.includes('psal') && keys.includes('temp')) {
        return 'ts_isopycnals';
      }
      if (keys.includes('chla') && keys.includes('nitrate')) {
        return 'chla_nitrate_scatter';
      }
      if (keys.includes('doxy') && keys.includes('temp')) {
        return 'o2_temp_correlation';
      }
      if (keys.includes('lat') || keys.includes('latitude')) {
        return 'float_trajectory';
      }
    }
    return null;
  }, [vizSpecs, rows]);

  // If no chart type and no rows, render nothing
  if (!chartType && (!rows || rows.length === 0)) {
    return null;
  }

  const chartData = vizSpecs?.chart_data;

  switch (chartType) {
    case 'depth_profile': {
      let profileData = rows || [];
      if (chartData?.profiles) {
        const pids = Object.keys(chartData.profiles);
        if (pids.length > 0) profileData = chartData.profiles[pids[0]];
      }
      if (!profileData || profileData.length === 0) return null;
      return <DepthProfile data={profileData} variable="temp" title={vizSpecs?.title || 'Vertical CTD Depth Profile (Temperature vs Depth)'} />;
    }

    case 'time_series': {
      if (chartData?.times && chartData?.series) {
        return <TimeSeries data={chartData} title={vizSpecs?.title || 'Ocean Telemetry Time-Series'} />;
      }
      if (rows && rows.length > 0) {
        const timeKey = Object.keys(rows[0]).find((k) => ['time', 'date', 'month', 'timestamp'].includes(k.toLowerCase())) || 'time';
        const times = rows.map((r) => r[timeKey]);
        const series: Record<string, number[]> = {};

        ['temp', 'avg_temp', 'psal', 'avg_psal', 'doxy', 'avg_doxy', 'sst', 'temperature', 'salinity'].forEach((v) => {
          const matchingKey = Object.keys(rows[0]).find((k) => k.toLowerCase() === v);
          if (matchingKey && typeof rows[0][matchingKey] === 'number') {
            series[v] = rows.map((r) => Number(r[matchingKey]));
          }
        });

        if (Object.keys(series).length > 0) {
          return <TimeSeries data={{ times, series }} variables={Object.keys(series)} title={vizSpecs?.title || 'Ocean Climate Time-Series'} />;
        }
      }
      return null;
    }

    case 'ts_isopycnals': {
      if (chartData?.temp && chartData?.psal) {
        const tsData = chartData.temp.map((t: number, i: number) => ({
          temp: t,
          psal: chartData.psal[i],
          pres: chartData.pres ? chartData.pres[i] : 0,
        }));
        return <TSIsopycnals data={tsData} />;
      }
      if (rows && rows.length > 0) {
        const tsData = rows.map((r) => ({
          temp: r.temp ?? r.temperature ?? 0,
          psal: r.psal ?? r.salinity ?? 0,
          pres: r.pres ?? r.pressure ?? 0,
        }));
        return <TSIsopycnals data={tsData} />;
      }
      return null;
    }

    case 'o2_temp_correlation': {
      const data = chartData || rows;
      if (!data || data.length === 0) return null;
      return <O2TempCorrelation data={data} />;
    }

    case 'chla_nitrate_scatter': {
      const data = chartData || rows;
      if (!data || data.length === 0) return null;
      return <ChlaNitrateScatter data={data} />;
    }

    case 'hovmoller_diagram':
      return chartData ? <HovmollerDiagram data={chartData} /> : null;

    case 'surface_3d':
      return chartData ? <Surface3D data={chartData} /> : null;

    case 'anomaly_series':
      return chartData ? <AnomalySeries data={chartData} /> : null;

    case 'seasonal_boxplots':
      return chartData ? <SeasonalBoxplots data={chartData} /> : null;

    case 'wind_rose':
      return chartData ? <WindRose data={chartData} /> : null;

    case 'float_trajectory': {
      const data = chartData || rows;
      if (!data || data.length === 0) return null;
      return <FloatTrajectoryChart data={data} />;
    }

    default:
      return null;
  }
}
