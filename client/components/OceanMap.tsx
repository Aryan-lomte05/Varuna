"use client";

import { useFloats } from '@/hooks/useFloats';
import { useMemo, useState } from 'react';
import Map from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { IconLayer } from '@deck.gl/layers';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const BUOY_ICON_MAPPING = {
  marker: { x: 0, y: 0, width: 128, height: 128, mask: true }
};

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
      new IconLayer({
        id: 'float-icons',
        data: floats,
        pickable: true,
        iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
        iconMapping: BUOY_ICON_MAPPING,
        getIcon: d => 'marker',
        sizeScale: 15,
        getPosition: d => [d.lon, d.lat],
        getSize: d => 3,
        getColor: d => d.status === 'active' ? [0, 240, 255] : [255, 190, 11],
        getCursor: () => 'pointer',
        transitions: {
          getPosition: { duration: 1000, easing: (t: number) => t * (2 - t) }
        }
      })
    ];
  }, [floats]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden glass-card">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-deep/50 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-argo-cyan border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-argo-cyan font-mono text-sm uppercase tracking-widest">Acquiring Fleet Telemetry</p>
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
              <div class="px-2 py-1">
                <div class="text-xs font-mono text-argo-cyan mb-1">ARGO ${object.wmo_id}</div>
                <div class="text-[10px] text-gray-300">Profiles: ${object.total_profiles}</div>
                <div class="text-[10px] text-gray-300">Last Seen: ${new Date(object.last_seen).toLocaleDateString()}</div>
                <div class="text-[10px] mt-1 uppercase ${object.status === 'active' ? 'text-green-400' : 'text-argo-gold'}">● ${object.status}</div>
              </div>
            `,
            style: {
              backgroundColor: 'rgba(11, 17, 33, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              backdropFilter: 'blur(8px)',
            }
          };
        }}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        />
      </DeckGL>
      
      <div className="absolute top-4 left-4 z-10 px-3 py-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg text-xs font-mono">
        <span className="text-argo-cyan">{floats.length}</span> FLOATS TRACKED
      </div>
    </div>
  );
}
