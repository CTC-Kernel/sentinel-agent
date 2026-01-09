/**
 * Static database of country coordinates and ISO codes.
 * Used to map threat country names to physical locations on 2D/3D maps
 * without relying on external geocoding APIs.
 */
export interface CountryData {
    name: string;
    iso3: string;
    lat: number;
    lon: number;
}

export const CountryCoordinates: Record<string, CountryData> = {
    // North America
    'United States': { name: 'United States', iso3: 'USA', lat: 37.0902, lon: -95.7129 },
    'Canada': { name: 'Canada', iso3: 'CAN', lat: 56.1304, lon: -106.3468 },
    'Mexico': { name: 'Mexico', iso3: 'MEX', lat: 23.6345, lon: -102.5528 },

    // South America
    'Brazil': { name: 'Brazil', iso3: 'BRA', lat: -14.2350, lon: -51.9253 },
    'Argentina': { name: 'Argentina', iso3: 'ARG', lat: -38.4161, lon: -63.6167 },
    'Colombia': { name: 'Colombia', iso3: 'COL', lat: 4.5709, lon: -74.2973 },
    'Chile': { name: 'Chile', iso3: 'CHL', lat: -35.6751, lon: -71.5430 },
    'Peru': { name: 'Peru', iso3: 'PER', lat: -9.1900, lon: -75.0152 },
    'Venezuela': { name: 'Venezuela', iso3: 'VEN', lat: 6.4238, lon: -66.5897 },

    // Europe
    'France': { name: 'France', iso3: 'FRA', lat: 46.2276, lon: 2.2137 },
    'Germany': { name: 'Germany', iso3: 'DEU', lat: 51.1657, lon: 10.4515 },
    'United Kingdom': { name: 'United Kingdom', iso3: 'GBR', lat: 55.3781, lon: -3.4359 },
    'Italy': { name: 'Italy', iso3: 'ITA', lat: 41.8719, lon: 12.5674 },
    'Spain': { name: 'Spain', iso3: 'ESP', lat: 40.4637, lon: -3.7492 },
    'Russia': { name: 'Russia', iso3: 'RUS', lat: 61.5240, lon: 105.3188 },
    'Ukraine': { name: 'Ukraine', iso3: 'UKR', lat: 48.3794, lon: 31.1656 },
    'Poland': { name: 'Poland', iso3: 'POL', lat: 51.9194, lon: 19.1451 },
    'Netherlands': { name: 'Netherlands', iso3: 'NLD', lat: 52.1326, lon: 5.2913 },
    'Belgium': { name: 'Belgium', iso3: 'BEL', lat: 50.5039, lon: 4.4699 },
    'Sweden': { name: 'Sweden', iso3: 'SWE', lat: 60.1282, lon: 18.6435 },
    'Switzerland': { name: 'Switzerland', iso3: 'CHE', lat: 46.8182, lon: 8.2275 },
    'Norway': { name: 'Norway', iso3: 'NOR', lat: 60.4720, lon: 8.4689 },

    // Asia
    'China': { name: 'China', iso3: 'CHN', lat: 35.8617, lon: 104.1954 },
    'India': { name: 'India', iso3: 'IND', lat: 20.5937, lon: 78.9629 },
    'Japan': { name: 'Japan', iso3: 'JPN', lat: 36.2048, lon: 138.2529 },
    'South Korea': { name: 'South Korea', iso3: 'KOR', lat: 35.9078, lon: 127.7669 },
    'North Korea': { name: 'North Korea', iso3: 'PRK', lat: 40.3399, lon: 127.5101 },
    'Taiwan': { name: 'Taiwan', iso3: 'TWN', lat: 23.6978, lon: 120.9605 },
    'Iran': { name: 'Iran', iso3: 'IRN', lat: 32.4279, lon: 53.6880 },
    'Israel': { name: 'Israel', iso3: 'ISR', lat: 31.0461, lon: 34.8516 },
    'Saudi Arabia': { name: 'Saudi Arabia', iso3: 'SAU', lat: 23.8859, lon: 45.0792 },
    'Turkey': { name: 'Turkey', iso3: 'TUR', lat: 38.9637, lon: 35.2433 },
    'Indonesia': { name: 'Indonesia', iso3: 'IDN', lat: -0.7893, lon: 113.9213 },
    'Vietnam': { name: 'Vietnam', iso3: 'VNM', lat: 14.0583, lon: 108.2772 },
    'Thailand': { name: 'Thailand', iso3: 'THA', lat: 15.8700, lon: 100.9925 },

    // Oceania
    'Australia': { name: 'Australia', iso3: 'AUS', lat: -25.2744, lon: 133.7751 },
    'New Zealand': { name: 'New Zealand', iso3: 'NZL', lat: -40.9006, lon: 174.8860 },

    // Africa
    'South Africa': { name: 'South Africa', iso3: 'ZAF', lat: -30.5595, lon: 22.9375 },
    'Egypt': { name: 'Egypt', iso3: 'EGY', lat: 26.8206, lon: 30.8025 },
    'Nigeria': { name: 'Nigeria', iso3: 'NGA', lat: 9.0820, lon: 8.6753 },
    'Kenya': { name: 'Kenya', iso3: 'KEN', lat: -0.0236, lon: 37.9062 },
    'Morocco': { name: 'Morocco', iso3: 'MAR', lat: 31.7917, lon: -7.0926 },
};

/**
 * Fuzzy finder to get coordinates even if name is slightly different
 */
export const getCountryCoordinates = (countryName: string): [number, number] | null => {
    if (!countryName) return null;

    // Direct match
    if (CountryCoordinates[countryName]) {
        return [CountryCoordinates[countryName].lon, CountryCoordinates[countryName].lat]; // [Lon, Lat] for GeoJSON
    }

    // Normalized match (case insensitive)
    const normalized = countryName.toLowerCase().trim();
    const entry = Object.values(CountryCoordinates).find(c =>
        c.name.toLowerCase() === normalized ||
        c.iso3.toLowerCase() === normalized
    );

    if (entry) {
        return [entry.lon, entry.lat];
    }

    return null;
};
