'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface ResultPin {
  lat: number;
  lng: number;
  rank: number | null;
  topResults?: string;
}

interface HeatmapGridProps {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  results: ResultPin[];
  businessName?: string | null;
}

function MapCenterUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function createPinIcon(rank: number | null): L.DivIcon {
  let bgColor = '#334155'; // Dark slate for unranked
  let textColor = '#cbd5e1';
  let label = '20+';

  if (rank !== null && rank >= 1 && rank <= 3) {
    bgColor = '#22c55e'; // Green
    textColor = '#ffffff';
    label = `#${rank}`;
  } else if (rank !== null && rank <= 10) {
    bgColor = '#f97316'; // Orange
    textColor = '#ffffff';
    label = `#${rank}`;
  } else if (rank !== null && rank <= 20) {
    bgColor = '#ef4444'; // Red
    textColor = '#ffffff';
    label = `#${rank}`;
  }

  const html = `
    <div style="
      background-color: ${bgColor};
      color: ${textColor};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.8);
      cursor: pointer;
    ">
      ${label}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-rank-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
}

export default function HeatmapGrid({
  centerLat,
  centerLng,
  zoom = 13,
  results = [],
  businessName
}: HeatmapGridProps) {
  return (
    <div className="h-[450px] w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <MapCenterUpdater center={[centerLat, centerLng]} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {results.map((pin, idx) => {
          let topCompetitors: any[] = [];
          try {
            if (pin.topResults) {
              topCompetitors = JSON.parse(pin.topResults).slice(0, 3);
            }
          } catch {
            topCompetitors = [];
          }

          return (
            <Marker
              key={`pin-${idx}-${pin.lat}-${pin.lng}`}
              position={[pin.lat, pin.lng]}
              icon={createPinIcon(pin.rank)}
            >
              <Popup>
                <div className="p-1 text-slate-900 min-w-[200px]">
                  <div className="font-bold text-sm mb-1">
                    {businessName || 'Target Business'}
                  </div>
                  <div className="text-xs font-semibold mb-2">
                    Rank at this point:{' '}
                    <span
                      className={`px-1.5 py-0.5 rounded text-white ${
                        pin.rank && pin.rank <= 3
                          ? 'bg-green-600'
                          : pin.rank && pin.rank <= 10
                          ? 'bg-orange-600'
                          : pin.rank && pin.rank <= 20
                          ? 'bg-red-600'
                          : 'bg-slate-600'
                      }`}
                    >
                      {pin.rank ? `#${pin.rank}` : 'Unranked (20+)'}
                    </span>
                  </div>

                  {topCompetitors.length > 0 && (
                    <div className="border-t border-slate-200 pt-1.5 mt-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Top 3 at this coordinate:
                      </div>
                      <ol className="text-xs space-y-1 list-decimal list-inside text-slate-700">
                        {topCompetitors.map((comp, cIdx) => (
                          <li key={cIdx} className="truncate">
                            {comp.name || 'Competitor'}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
