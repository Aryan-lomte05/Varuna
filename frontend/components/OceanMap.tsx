"use client";

import { useFloats } from '@/hooks/useFloats';
import { useMemo, useState } from 'react';
import Map from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function OceanMap() {
  const { floats, loading } = useFloats();
  const [viewState, setViewState] = useState({
    longitude: 80,
    latitude: 0,
    zoom: 3,
    pitch: 45,
    bearing: 0
  });

  const layers = useMemo(() => {
    return [
      new ScatterplotLayer({
        id: 'float-points',
        data: floats,
        pickable: true,
        opacity: 1,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 2.5,
        radiusMaxPixels: 12,
        lineWidthMinPixels: 0.5,
        getPosition: (d: any) => [d.lon, d.lat],
        getRadius: (d: any) => 12000, 
        // Emerald for active, Zinc-500/Amber for other
        getFillColor: (d: any) => d.status === 'active' ? [16, 185, 129, 210] : [245, 158, 11, 150],
        getLineColor: (d: any) => d.status === 'active' ? [16, 185, 129, 255] : [255, 255, 255, 50],
        getCursor: () => 'crosshair',
        transitions: {
          getPosition: { duration: 1000, easing: (t: number) => t * (2 - t) }
        }
      })
    ];
  }, [floats]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden glass noise">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/40 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <span className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
            <p className="text-accent font-mono text-[10px] uppercase tracking-widest">Acquiring Telemetry</p>
          </div>
        </div>
      )}
      
      <DeckGL
        layers={layers}
        initialViewState={viewState}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={true}
        getTooltip={(info: any) => {
          const { object } = info;
          if (!object) return null;
          return {
            html: `
              <div class="px-2 py-1.5 flex flex-col gap-1">
                <div class="text-[11px] font-mono text-zinc-200 border-b border-white/10 pb-1 mb-1">
                  WMO ${object.wmo_id}
                </div>
                <div class="flex justify-between gap-4 text-[10px] font-mono text-zinc-400">
                  <span>Profiles</span>
                  <span class="text-zinc-300">${object.total_profiles}</span>
                </div>
                <div class="flex justify-between gap-4 text-[10px] font-mono text-zinc-400">
                  <span>Last Seen</span>
                  <span class="text-zinc-300">${new Date(object.last_seen).toLocaleDateString()}</span>
                </div>
                <div class="mt-1 text-[9px] font-mono uppercase tracking-widest ${object.status === 'active' ? 'text-accent' : 'text-amber-500'}">
                  ● ${object.status}
                </div>
              </div>
            `,
            style: {
              backgroundColor: 'rgba(9, 9, 11, 0.85)', // zinc-950
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: 'white',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
            }
          };
        }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        />
      </DeckGL>
    </div>
  );
}
