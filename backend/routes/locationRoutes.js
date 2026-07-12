const express = require('express');
const axios = require('axios');

const router = express.Router();
const GEOCODING_BASE_URL = process.env.GEOCODING_BASE_URL || 'https://photon.komoot.io';
const VIETNAM_BBOX = '102.14,8.18,109.47,23.39';
const CACHE_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map();

function uniqueParts(parts) {
    const seen = new Set();
    return parts.filter(part => {
        const value = String(part || '').trim();
        if (!value) return false;
        const key = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .toLocaleLowerCase('vi')
            .replace(/^(tinh|thanh pho)\s+/u, '')
            .replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function formatFeature(feature) {
    const properties = feature?.properties || {};
    const [longitude, latitude] = feature?.geometry?.coordinates || [];
    const streetAddress = uniqueParts([properties.housenumber, properties.street]).join(' ');
    const labelParts = uniqueParts([
        streetAddress,
        properties.name,
        properties.locality,
        properties.district,
        properties.city,
        properties.state,
        properties.country
    ]);

    return {
        id: `${properties.osm_type || 'place'}-${properties.osm_id || `${latitude}-${longitude}`}`,
        label: labelParts.join(', '),
        name: properties.name || streetAddress || properties.city || properties.state || 'Địa chỉ gợi ý',
        context: uniqueParts([
            properties.district || properties.locality,
            properties.city || properties.state,
            properties.country
        ]).join(', '),
        province: properties.state || properties.city || '',
        ward: properties.district || properties.locality || '',
        coordinates: {
            latitude: Number(latitude),
            longitude: Number(longitude)
        }
    };
}

function readCache(key) {
    const cached = resultCache.get(key);
    if (!cached || Date.now() - cached.createdAt > CACHE_TTL_MS) {
        resultCache.delete(key);
        return null;
    }
    return cached.value;
}

function writeCache(key, value) {
    if (resultCache.size >= 100) resultCache.delete(resultCache.keys().next().value);
    resultCache.set(key, { createdAt: Date.now(), value });
}

async function requestPhoton(path, params) {
    const response = await axios.get(`${GEOCODING_BASE_URL}${path}`, {
        params,
        timeout: 8000,
        headers: {
            Accept: 'application/json',
            'Accept-Language': 'vi',
            'User-Agent': 'TechEcommerce/1.0 (graduation project)'
        }
    });
    return Array.isArray(response.data?.features) ? response.data.features : [];
}

router.get('/suggest', async (req, res) => {
    try {
        const query = String(req.query.q || '').trim().slice(0, 120);
        if (query.length < 3) return res.json({ suggestions: [] });

        const cacheKey = `suggest:${query.toLocaleLowerCase('vi')}`;
        const cached = readCache(cacheKey);
        if (cached) return res.json({ suggestions: cached });

        const features = await requestPhoton('/api/', {
            q: /việt\s*nam/i.test(query) ? query : `${query}, Việt Nam`,
            limit: 6,
            bbox: VIETNAM_BBOX
        });
        const suggestions = features
            .filter(feature => feature?.properties?.countrycode === 'VN')
            .map(formatFeature)
            .filter(item => item.label && Number.isFinite(item.coordinates.latitude) && Number.isFinite(item.coordinates.longitude));

        writeCache(cacheKey, suggestions);
        return res.json({ suggestions });
    } catch (error) {
        console.error('Address suggestion error:', error.message);
        return res.status(502).json({ message: 'Dịch vụ gợi ý địa chỉ đang tạm thời gián đoạn.' });
    }
});

router.get('/reverse', async (req, res) => {
    try {
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ message: 'Tọa độ không hợp lệ.' });
        }
        if (latitude < 8 || latitude > 24 || longitude < 102 || longitude > 110.5) {
            return res.status(400).json({ message: 'Vị trí hiện tại nằm ngoài phạm vi giao hàng tại Việt Nam.' });
        }

        const cacheKey = `reverse:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
        const cached = readCache(cacheKey);
        if (cached) return res.json({ address: cached });

        const features = await requestPhoton('/reverse', {
            lat: latitude,
            lon: longitude,
            limit: 1,
            radius: 5
        });
        const feature = features.find(item => item?.properties?.countrycode === 'VN');
        if (!feature) return res.status(404).json({ message: 'Không tìm thấy địa chỉ gần vị trí hiện tại.' });

        const address = formatFeature(feature);
        writeCache(cacheKey, address);
        return res.json({ address });
    } catch (error) {
        console.error('Reverse geocoding error:', error.message);
        return res.status(502).json({ message: 'Chưa thể xác định địa chỉ từ vị trí hiện tại.' });
    }
});

module.exports = router;
