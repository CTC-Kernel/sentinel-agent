import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { ErrorLogger } from '../../services/errorLogger';

// Constants
const GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const EARTH_RADIUS = 2.01; // Matches ThreatPlanet surface radius

interface EarthCountriesProps {
    color?: string;
}

interface GeoJsonFeature {
    geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
    };
}

interface GeoJsonData {
    features: GeoJsonFeature[];
}

export const EarthCountries: React.FC<EarthCountriesProps> = ({ color = '#38bdf8' }) => {
    const [geoJson, setGeoJson] = useState<GeoJsonData | null>(null);

    useEffect(() => {
        fetch(GEOJSON_URL)
            .then(res => res.json())
            .then(data => setGeoJson(data))
            .catch(err => ErrorLogger.error(err, 'EarthCountries.loadGeoJson'));
    }, []);

    const geometry = useMemo(() => {
        if (!geoJson) return null;

        const points: THREE.Vector3[] = [];

        const addLine = (coords: number[][]) => {
            for (let i = 0; i < coords.length - 1; i++) {
                const [lon1, lat1] = coords[i];
                const [lon2, lat2] = coords[i + 1];

                points.push(latLonToVector3(lat1, lon1, EARTH_RADIUS));
                points.push(latLonToVector3(lat2, lon2, EARTH_RADIUS));
            }
        };

        geoJson.features.forEach((feature: GeoJsonFeature) => {
            const { geometry } = feature;
            if (geometry.type === 'Polygon') {
                (geometry.coordinates as number[][][]).forEach((ring: number[][]) => addLine(ring));
            } else if (geometry.type === 'MultiPolygon') {
                (geometry.coordinates as number[][][][]).forEach((polygon: number[][][]) => {
                    polygon.forEach((ring: number[][]) => addLine(ring));
                });
            }
        });

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return geo;
    }, [geoJson]);

    if (!geometry) return null;

    return (
        <lineSegments geometry={geometry}>
            <lineBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </lineSegments>
    );
};

// Helper: Convert Lat/Lon to 3D position
const latLonToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
};
