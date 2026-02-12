
import React, { useEffect, useRef } from 'react';
import { Coords } from '../types';

declare const L: any;

interface MapComponentProps {
  userCoords: Coords | null;
  friendCoords: Coords | null;
}

const MapComponent: React.FC<MapComponentProps> = ({ userCoords, friendCoords }) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<any>(null);
  const friendMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView([23.8103, 90.4125], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapRef.current);

    // Add zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !userCoords) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([userCoords.lat, userCoords.lng])
        .addTo(mapRef.current)
        .bindPopup('<b>আপনি এখানে</b>');
    } else {
      userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
    }
    
    updatePolyline();
    if (!friendCoords) mapRef.current.panTo([userCoords.lat, userCoords.lng]);
  }, [userCoords]);

  useEffect(() => {
    if (!mapRef.current || !friendCoords) return;

    if (!friendMarkerRef.current) {
      const friendIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      friendMarkerRef.current = L.marker([friendCoords.lat, friendCoords.lng], { icon: friendIcon })
        .addTo(mapRef.current)
        .bindPopup('<b>আপনার বন্ধু এখানে</b>')
        .openPopup();
    } else {
      friendMarkerRef.current.setLatLng([friendCoords.lat, friendCoords.lng]);
    }

    updatePolyline();
    if (userCoords) {
      const bounds = L.latLngBounds([
        [userCoords.lat, userCoords.lng],
        [friendCoords.lat, friendCoords.lng]
      ]);
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    }
  }, [friendCoords]);

  const updatePolyline = () => {
    if (!mapRef.current || !userCoords || !friendCoords) return;
    
    const latlngs = [
      [userCoords.lat, userCoords.lng],
      [friendCoords.lat, friendCoords.lng]
    ];

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latlngs);
    } else {
      polylineRef.current = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        className: 'leaflet-ant-path' // CSS animated class
      }).addTo(mapRef.current);
    }
  };

  return (
    <div className="relative w-full h-[350px] md:h-[450px] rounded-3xl overflow-hidden border border-white/20 shadow-2xl group">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
         {friendCoords && (
            <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/10 shadow-lg">
                📍 বন্ধু ট্র্যাকিং সক্রিয়
            </div>
         )}
      </div>
    </div>
  );
};

export default MapComponent;
