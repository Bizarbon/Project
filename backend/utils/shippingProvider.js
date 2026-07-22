function envValue(name) {
    return String(process.env[name] || '').trim();
}

function shippingProviderStatus() {
    const provider = envValue('SHIPPING_PROVIDER').toLowerCase();
    if (!provider || provider === 'manual' || provider === 'internal' || provider === 'tech_internal') {
        return {
            provider: 'tech_internal', configured: true,
            message: 'Dùng mã giao vận nội bộ TechEcommerce; mã hãng vận chuyển có thể được cập nhật sau.'
        };
    }
    if (provider !== 'ghn') {
        return { provider, configured: false, message: `Chưa hỗ trợ adapter giao vận ${provider}.` };
    }
    const required = [
        'GHN_TOKEN', 'GHN_SHOP_ID', 'GHN_SERVICE_TYPE_ID',
        'GHN_DEFAULT_WEIGHT_GRAMS', 'GHN_DEFAULT_LENGTH_CM',
        'GHN_DEFAULT_WIDTH_CM', 'GHN_DEFAULT_HEIGHT_CM'
    ];
    const missingKeys = required.filter(key => !envValue(key));
    return {
        provider: 'ghn',
        configured: missingKeys.length === 0,
        missingKeys,
        message: missingKeys.length
            ? `GHN chưa được cấu hình. Thiếu: ${missingKeys.join(', ')}`
            : 'GHN đã sẵn sàng tạo vận đơn.'
    };
}

function internalTrackingNumber(order) {
    const sourceDate = new Date(order.createdAt || order.orderDate || Date.now());
    const datePart = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(sourceDate).replaceAll('-', '');
    return `TECH-${datePart}-${String(order._id).padStart(6, '0')}`;
}

function createInternalShipment(order) {
    return {
        created: true,
        provider: 'tech_internal',
        providerLabel: 'TechEcommerce Delivery',
        trackingType: 'internal',
        trackingNumber: internalTrackingNumber(order),
        expectedDeliveryTime: null,
        message: 'Mã giao vận nội bộ đã tạo. Admin có thể thay bằng mã của hãng vận chuyển khi bàn giao kiện hàng.'
    };
}

async function createGhnShipment(order) {
    const districtId = Number(order.shippingMetadata?.ghnDistrictId || 0);
    const wardCode = String(order.shippingMetadata?.ghnWardCode || '').trim();
    if (!districtId || !wardCode) {
        return {
            created: false,
            reason: 'missing_destination_codes',
            message: 'Địa chỉ chưa có mã Quận/Huyện và Phường/Xã theo danh mục GHN.'
        };
    }
    const baseUrl = envValue('GHN_API_BASE_URL') || 'https://online-gateway.ghn.vn/shiip/public-api/v2';
    const payload = {
        payment_type_id: 1,
        required_note: 'CHOXEMHANGKHONGTHU',
        client_order_code: `TECH-${order._id}`,
        to_name: order.recipientName,
        to_phone: order.recipientPhone,
        to_address: order.shippingAddress,
        to_district_id: districtId,
        to_ward_code: wardCode,
        service_type_id: Number(envValue('GHN_SERVICE_TYPE_ID')),
        cod_amount: order.paymentMethod === 'cod' ? Math.round(Number(order.totalAmount || 0)) : 0,
        insurance_value: Math.min(Math.round(Number(order.totalAmount || 0)), 5000000),
        content: (order.products || []).map(item => item.productName).filter(Boolean).join(', ').slice(0, 1900),
        weight: Number(envValue('GHN_DEFAULT_WEIGHT_GRAMS')),
        length: Number(envValue('GHN_DEFAULT_LENGTH_CM')),
        width: Number(envValue('GHN_DEFAULT_WIDTH_CM')),
        height: Number(envValue('GHN_DEFAULT_HEIGHT_CM'))
    };
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/shipping-order/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Token: envValue('GHN_TOKEN'),
            ShopId: envValue('GHN_SHOP_ID')
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok || !result.data?.order_code) {
        throw new Error(result.message || 'GHN không tạo được vận đơn.');
    }
    return {
        created: true,
        provider: 'ghn',
        providerLabel: 'Giao Hàng Nhanh',
        trackingNumber: result.data.order_code,
        fee: Number(result.data.total_fee || 0),
        expectedDeliveryTime: result.data.expected_delivery_time || null,
        raw: result.data
    };
}

async function createShipmentForOrder(order) {
    if (!order || order.trackingNumber) return { created: false, reason: 'already_created' };
    const status = shippingProviderStatus();
    if (!status.configured) return { created: false, reason: 'provider_not_configured', message: status.message };
    try {
        if (status.provider === 'tech_internal') return createInternalShipment(order);
        if (status.provider === 'ghn') return await createGhnShipment(order);
        return { created: false, reason: 'unsupported_provider', message: status.message };
    } catch (error) {
        return { created: false, reason: 'provider_error', message: error.message };
    }
}

module.exports = { shippingProviderStatus, createShipmentForOrder, internalTrackingNumber };
