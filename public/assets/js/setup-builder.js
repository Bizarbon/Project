/**
 * TechDesk Studio — 2.5D Interactive Setup Builder & Live Compatibility Engine
 * 100% Semantic Vanilla JS, Zero-dependency
 */

(function () {
    'use strict';

    // Real MongoDB Product Catalog Mapping + Hardware Compatibility Specs
    const HARDWARE_CATALOG = [
        // Category: Laptops
        {
            id: 14,
            category: 'laptop',
            title: 'MacBook Air 13 inch M3 512GB',
            specs: 'Apple M3 • 16GB Unified • 512GB SSD • Pin 18h',
            price: 31990000,
            image: '../../assets/uploads/products/p14-macbook-air-m3-13-inch-2024-8cpu-10gpu-24gb-512gb-sac-70w-ch.png',
            ports: ['Thunderbolt / USB-C', 'MagSafe 3'],
            powerWattage: 70,
            supportsUsbCDisplay: true
        },
        {
            id: 16,
            category: 'laptop',
            title: 'Laptop ASUS ROG Strix G16 G614',
            specs: 'Core i9-14900HX • 32GB DDR5 • 1TB SSD • 240Hz',
            price: 39990000,
            image: '../../assets/uploads/products/asus-rog-strix-g16.png',
            ports: ['HDMI 2.1', 'Thunderbolt 4', 'USB-A 3.2'],
            powerWattage: 240,
            supportsUsbCDisplay: true
        },
        {
            id: 64,
            category: 'laptop',
            title: 'Laptop ASUS Zenbook 14 OLED UX3405MA',
            specs: 'Core Ultra 7 155H • 16GB • 1TB SSD • 3K OLED 1.2kg',
            price: 28490000,
            image: '../../assets/uploads/products/asus-zenbook-14-oled.png',
            ports: ['Thunderbolt 4 / USB-C', 'HDMI 2.1'],
            powerWattage: 65,
            supportsUsbCDisplay: true
        },

        // Category: Secondary Screen / Tablet 2-in-1
        {
            id: 22,
            category: 'monitor',
            title: 'iPad Pro 11 inch M4 Wi-Fi 256GB',
            specs: 'Apple M4 • Tandem OLED 120Hz • Sidecar Mở rộng Mac',
            price: 28990000,
            image: '../../assets/uploads/products/ipad-pro-11-m4.png',
            ports: ['Thunderbolt / USB 4'],
            requiresHubForUsbC: false,
            powerDeliveryWatt: 30
        },
        {
            id: 25,
            category: 'monitor',
            title: 'Samsung Galaxy Tab S9 Ultra 256GB',
            specs: '14.6" Dynamic AMOLED 2X • Kèm bút S Pen IP68 • DeX',
            price: 25990000,
            image: '../../assets/uploads/products/samsung-galaxy-tab-s9-ultra.png',
            ports: ['USB-C Display Out'],
            requiresHubForUsbC: true,
            powerDeliveryWatt: 45
        },
        {
            id: 98,
            category: 'monitor',
            title: 'Microsoft Surface Pro 9 2 Trong 1',
            specs: 'Core i5-1235U • 13" PixelSense 120Hz • 879g',
            price: 22990000,
            image: '../../assets/uploads/products/surface-pro-tablet.png',
            ports: ['2x Thunderbolt 4 / USB-C'],
            requiresHubForUsbC: false,
            powerDeliveryWatt: 65
        },

        // Category: Audio
        {
            id: 31,
            category: 'audio',
            title: 'Tai nghe chụp tai Sony WH-1000XM5',
            specs: 'Chống ồn hàng đầu • LDAC • Pin 30 giờ',
            price: 6990000,
            image: '../../assets/uploads/products/sony-wh-1000xm5.png',
            connectionType: 'Bluetooth 5.2 / Jack 3.5mm',
            isWireless: true
        },
        {
            id: 30,
            category: 'audio',
            title: 'Apple AirPods Pro 2 USB-C',
            specs: 'Chip H2 • Chống ồn chủ động ANC • Spatial Audio',
            price: 5490000,
            image: '../../assets/uploads/products/apple-airpods-pro-2.png',
            connectionType: 'Bluetooth 5.3 / USB-C',
            isWireless: true
        },
        {
            id: 34,
            category: 'audio',
            title: 'Tai nghe Marshall Major 5',
            specs: 'Pin >100 giờ • Chất âm ấm • Bluetooth 5.3 / 3.5mm',
            price: 3690000,
            image: '../../assets/uploads/products/marshall-major-5.png',
            connectionType: 'Bluetooth 5.3 / Jack 3.5mm',
            isWireless: true
        },

        // Category: Hub, Power & Mice
        {
            id: 4,
            category: 'hub',
            title: 'Hub chuyển đổi Ugreen USB-C 5 IN 1 CM478',
            specs: 'HDMI 4K • 3x USB 3.0 • Mở rộng cổng cho Laptop mỏng nhẹ',
            price: 280000,
            image: '../../assets/uploads/products/ugreen-hub-5in1.png',
            features: ['HDMI Out 4K', 'USB 3.0'],
            wattageSupport: 100,
            hasHdmiOut: true,
            hasAudioJack: false
        },
        {
            id: 58,
            category: 'hub',
            title: 'Củ sạc nhanh Anker Prime 100W GaN 3 cổng',
            specs: '2x USB-C + 1x USB-A • 100W PD sạc laptop & điện thoại',
            price: 1690000,
            image: '../../assets/uploads/products/anker-prime-100w.png',
            features: ['100W Fast Charge', 'GaN Technology'],
            wattageSupport: 100,
            hasHdmiOut: false,
            hasAudioJack: false
        },
        {
            id: 46,
            category: 'hub',
            title: 'Chuột không dây Logitech MX Master 3S',
            specs: 'Cuộn MagSpeed • Kết nối 3 thiết bị • Sạc USB-C 70 ngày',
            price: 2190000,
            image: '../../assets/uploads/products/logitech-mx-master-3s.png',
            features: ['Easy-Switch 3 máy', 'Quiet Clicks'],
            wattageSupport: 0,
            hasHdmiOut: false,
            hasAudioJack: false
        }
    ];

    // Current State on Virtual Desk
    const deskState = {
        laptop: null,
        monitor: null,
        audio: null,
        hub: null
    };

    let activeInventoryCategory = 'laptop';
    let draggedHardware = null;

    // Currency Formatter
    function fmt(num) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
    }

    async function syncLiveCatalogPricing() {
        try {
            const apiUrl = window.API_URL || (window.location.hostname.includes('vercel.app') ? 'https://techshopvn.vercel.app/api' : 'http://localhost:5000/api');
            const res = await fetch(`${apiUrl}/products?limit=150`);
            if (!res.ok) return;
            const list = await res.json();
            const map = new Map((Array.isArray(list) ? list : []).map(p => [Number(p._id), p]));
            let changed = false;
            HARDWARE_CATALOG.forEach(item => {
                const live = map.get(Number(item.id));
                if (live) {
                    if (live.price > 0) item.price = Number(live.price);
                    if (live.name) item.title = live.name;
                    if (live.image) item.image = /^https?:|^\//i.test(live.image) ? `../..${live.image}` : `../../${live.image}`;
                    changed = true;
                }
            });
            if (changed) {
                renderInventoryCards();
                updateDeskUI();
            }
        } catch (_) {}
    }

    // Initialize UI
    function init() {
        renderInventoryTabs();
        renderInventoryCards();
        setupDragAndDrop();
        setupDeskActions();
        updateDeskUI();
        syncLiveCatalogPricing();
    }

    // Render Category Filter Tabs
    function renderInventoryTabs() {
        const tabs = document.querySelectorAll('.inv-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeInventoryCategory = tab.getAttribute('data-category') || 'laptop';
                renderInventoryCards();
            });
        });
    }

    // Render Draggable Inventory Cards
    function renderInventoryCards() {
        const list = document.getElementById('inventoryItemsList');
        if (!list) return;

        const filtered = HARDWARE_CATALOG.filter(item => item.category === activeInventoryCategory);
        list.innerHTML = filtered.map(item => `
            <li class="inventory-card-item" draggable="true" data-item-id="${item.id}">
                <img src="${item.image}" alt="${item.title}" class="inventory-item-thumb" onerror="this.onerror=null; this.src='../../assets/images/product-placeholder.svg'">
                <div class="inventory-item-info">
                    <strong class="inventory-item-title">${item.title}</strong>
                    <div class="inventory-item-specs">${item.specs}</div>
                    <div class="inventory-item-price">${fmt(item.price)}</div>
                </div>
                <button type="button" class="btn-equip-item" data-equip-id="${item.id}" aria-label="Gắn ${item.title} vào bàn">
                    + Thêm
                </button>
            </li>
        `).join('');

        // Attach drag events to inventory cards
        list.querySelectorAll('.inventory-card-item').forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        // Attach click to equip button (for mobile / accessibility)
        list.querySelectorAll('.btn-equip-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-equip-id');
                const item = HARDWARE_CATALOG.find(i => i.id === id);
                if (item) equipItem(item.category, item);
            });
        });
    }

    // Drag and Drop Handlers
    function handleDragStart(e) {
        const itemId = this.getAttribute('data-item-id');
        draggedHardware = HARDWARE_CATALOG.find(i => i.id === itemId);
        if (draggedHardware) {
            e.dataTransfer.setData('text/plain', itemId);
            e.dataTransfer.effectAllowed = 'copy';
            this.classList.add('is-dragging');

            // Highlight suitable slot
            const targetSlot = document.getElementById(`slot-${draggedHardware.category}`);
            if (targetSlot) targetSlot.classList.add('is-drag-over');
        }
    }

    function handleDragEnd() {
        this.classList.remove('is-dragging');
        document.querySelectorAll('.desk-slot').forEach(s => s.classList.remove('is-drag-over'));
        draggedHardware = null;
    }

    function setupDragAndDrop() {
        const slots = document.querySelectorAll('.desk-slot');
        slots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                slot.classList.add('is-drag-over');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('is-drag-over');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('is-drag-over');
                const slotType = slot.getAttribute('data-slot');

                if (draggedHardware) {
                    if (draggedHardware.category === slotType) {
                        equipItem(slotType, draggedHardware);
                    } else {
                        // Category mismatch notification
                        if (typeof window.showToast === 'function') {
                            window.showToast(`Vị trí này dành riêng cho [${getCategoryLabel(slotType)}]!`, 'warning');
                        }
                    }
                }
            });
        });
    }

    function getCategoryLabel(cat) {
        switch (cat) {
            case 'monitor': return 'Màn hình';
            case 'laptop': return 'Laptop / PC';
            case 'audio': return 'Âm thanh';
            case 'hub': return 'Hub / Phụ kiện';
            default: return cat;
        }
    }

    // Equip an item into a slot
    function equipItem(slotType, item) {
        deskState[slotType] = item;
        updateDeskUI();
        if (typeof window.triggerVisualHaptic === 'function') {
            window.triggerVisualHaptic('success');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`✓ Đã gắn [${item.title}] lên bàn làm việc!`);
        }
    }

    // Unequip item
    function unequipItem(slotType) {
        deskState[slotType] = null;
        updateDeskUI();
        if (typeof window.triggerVisualHaptic === 'function') {
            window.triggerVisualHaptic('warning');
        }
    }

    // Update Virtual Desk UI & Diagnostic & Price
    function updateDeskUI() {
        let occupiedCount = 0;

        ['monitor', 'laptop', 'audio', 'hub'].forEach(slotType => {
            const slotEl = document.getElementById(`slot-${slotType}`);
            if (!slotEl) return;

            const emptyEl = slotEl.querySelector('.slot-empty-state');
            const cardEl = slotEl.querySelector('.slot-occupied-card');
            const item = deskState[slotType];

            if (item) {
                occupiedCount++;
                slotEl.classList.add('is-occupied');
                if (emptyEl) emptyEl.style.display = 'none';
                if (cardEl) {
                    cardEl.style.display = 'flex';
                    cardEl.innerHTML = `
                        <button type="button" class="btn-slot-remove" data-remove-slot="${slotType}" aria-label="Gỡ ${item.title}">×</button>
                        <img src="${item.image}" alt="${item.title}" class="slot-card-thumb" onerror="this.src='../../assets/images/product-placeholder.svg'">
                        <strong class="slot-card-title">${item.title}</strong>
                        <div class="slot-card-price">${fmt(item.price)}</div>
                        <div class="slot-card-tags">
                            <span class="badge-tag-spec">${item.specs.split('•')[0] || getCategoryLabel(slotType)}</span>
                        </div>
                    `;

                    // Remove button handler
                    cardEl.querySelector('.btn-slot-remove')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        unequipItem(slotType);
                    });
                }
            } else {
                slotEl.classList.remove('is-occupied');
                if (emptyEl) emptyEl.style.display = 'flex';
                if (cardEl) {
                    cardEl.style.display = 'none';
                    cardEl.innerHTML = '';
                }
            }
        });

        // Update items counter
        const counterEl = document.getElementById('deskItemsCount');
        if (counterEl) counterEl.textContent = `${occupiedCount}/4 Thiết bị đã gắn`;

        // Run Diagnostic Engine
        runCompatibilityDiagnostic(occupiedCount);

        // Run Pricing Engine
        updatePricing(occupiedCount);
    }

    // Realtime Diagnostic Engine
    function runCompatibilityDiagnostic(count) {
        const panel = document.getElementById('compatibilityPanel');
        const badge = document.getElementById('compatibilityBadge');
        const emptyHint = document.querySelector('.diagnostic-empty-hint');
        const rulesList = document.getElementById('diagnosticRulesList');
        if (!panel || !badge || !rulesList) return;

        if (count < 2) {
            badge.className = 'compatibility-status-badge badge-neutral';
            badge.textContent = 'CHỜ GẮN THIẾT BỊ';
            if (emptyHint) emptyHint.style.display = 'block';
            rulesList.style.display = 'none';
            rulesList.innerHTML = '';
            return;
        }

        if (emptyHint) emptyHint.style.display = 'none';
        rulesList.style.display = 'flex';

        const rules = [];
        let hasWarning = false;

        const laptop = deskState.laptop;
        const monitor = deskState.monitor;
        const audio = deskState.audio;
        const hub = deskState.hub;

        // Diagnostic 1: Video Display Signal Output
        if (laptop && monitor) {
            if (monitor.requiresHubForUsbC && !laptop.ports.includes('HDMI 2.1') && !hub?.hasHdmiOut) {
                hasWarning = true;
                rules.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: 'Cần Hub xuất hình HDMI',
                    desc: `${monitor.title} hỗ trợ xuất hình USB-C/HDMI nhưng ${laptop.title} ít cổng rời. Hãy gắn thêm Hub Ugreen 5-in-1 để xuất hình 4K mượt mà!`,
                    action: { text: '+ Thêm Hub Ugreen 5-in-1', targetId: 4 }
                });
            } else if (monitor.powerDeliveryWatt >= 90) {
                rules.push({
                    type: 'ok',
                    icon: '✓',
                    title: 'Kết nối 1 Cáp Duy Nhất (Single Cable Setup)',
                    desc: `${monitor.title} hỗ trợ sạc ngược 90W PD và truyền dữ liệu màn hình qua một sợi cáp USB-C duy nhất tới ${laptop.title}. Bàn làm việc hoàn toàn không dây thừa!`
                });
            } else if (hub?.hasHdmiOut) {
                rules.push({
                    type: 'ok',
                    icon: '✓',
                    title: 'Xuất hình qua Hub thành công',
                    desc: `${hub.title} nhận tín hiệu từ laptop và xuất hình ảnh 4K@60Hz mượt mà tới ${monitor.title}.`
                });
            } else {
                rules.push({
                    type: 'ok',
                    icon: '✓',
                    title: 'Tương thích cổng hình ảnh',
                    desc: 'Cổng HDMI 2.1 giữa Laptop và Màn hình kết nối đồng bộ, hỗ trợ tần số quét cao.'
                });
            }
        }

        // Diagnostic 2: Power Wattage Bottleneck Check
        if (laptop) {
            if (laptop.powerWattage >= 140 && hub && hub.wattageSupport < 140 && hub.wattageSupport > 0) {
                hasWarning = true;
                rules.push({
                    type: 'warning',
                    icon: '⚡',
                    title: 'Cảnh báo công suất nguồn sạc',
                    desc: `${laptop.title} là dòng Gaming/Hiệu năng cao yêu cầu nguồn từ 140W trở lên. ${hub.title} hỗ trợ 100W PD (đủ dùng cho tác vụ nhẹ, khi render nặng nên cắm sạc rời của máy).`
                });
            } else if (laptop.powerWattage <= 100) {
                rules.push({
                    type: 'ok',
                    icon: '✓',
                    title: 'Công suất nguồn sạc tối ưu',
                    desc: `Nguồn cấp điện đáp ứng hoàn hảo ${laptop.powerWattage}W cho thiết bị, duy trì hiệu năng 100% không chai pin.`
                });
            }
        }

        // Diagnostic 3: Audio Jack Compatibility
        if (audio) {
            if (audio.isWireless) {
                rules.push({
                    type: 'ok',
                    icon: '✓',
                    title: 'Âm thanh không dây độ trễ thấp',
                    desc: `${audio.title} kết nối chuẩn Bluetooth công nghệ mới, truyền tải âm thanh Hi-Res không nén và không vướng víu dây cáp trên bàn.`
                });
            }
        }

        // Render Rule Items
        rulesList.innerHTML = rules.map(r => `
            <li class="rule-item ${r.type === 'warning' ? 'is-warning' : 'is-ok'}">
                <span class="rule-icon" aria-hidden="true">${r.icon}</span>
                <div class="rule-details">
                    <strong>${r.title}</strong>
                    <div>${r.desc}</div>
                    ${r.action ? `<button type="button" class="btn-rule-quick-fix" data-quick-equip="${r.action.targetId}">${r.action.text}</button>` : ''}
                </div>
            </li>
        `).join('');

        // Quick fix action handler
        rulesList.querySelectorAll('.btn-rule-quick-fix').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-quick-equip');
                const targetItem = HARDWARE_CATALOG.find(i => String(i.id) === String(targetId));
                if (targetItem) equipItem(targetItem.category, targetItem);
            });
        });

        // Update Status Badge
        if (hasWarning) {
            badge.className = 'compatibility-status-badge badge-warning';
            badge.textContent = 'CẦN LƯU Ý KẾT NỐI';
        } else {
            badge.className = 'compatibility-status-badge badge-success';
            badge.textContent = '✓ 100% TƯƠNG THÍCH HOÀN HẢO';
        }
    }

    // Pricing & Combo Calculation
    function updatePricing(count) {
        const origEl = document.getElementById('comboOriginalPrice');
        const discEl = document.getElementById('comboDiscountAmount');
        const finalEl = document.getElementById('comboFinalPrice');
        const btnAdd = document.getElementById('btnAddComboToCart');
        const badgeEl = document.getElementById('comboDiscountBadge');

        let rawTotal = 0;
        ['monitor', 'laptop', 'audio', 'hub'].forEach(slotType => {
            if (deskState[slotType]) rawTotal += deskState[slotType].price;
        });

        if (count >= 1) {
            const discountPercent = count >= 2 ? 0.10 : 0.05;
            const discountAmount = Math.round(rawTotal * discountPercent);
            const finalAmount = rawTotal - discountAmount;

            if (origEl) origEl.textContent = fmt(rawTotal);
            if (discEl) discEl.textContent = `-${fmt(discountAmount)}`;
            if (finalEl) finalEl.textContent = fmt(finalAmount);
            if (btnAdd) btnAdd.disabled = false;
            if (badgeEl) badgeEl.textContent = count >= 2 ? 'COMBO TIẾT KIỆM -10%' : 'ƯU ĐÃI THÀNH VIÊN -5%';
        } else {
            if (origEl) origEl.textContent = '0 ₫';
            if (discEl) discEl.textContent = '-0 ₫';
            if (finalEl) finalEl.textContent = '0 ₫';
            if (btnAdd) btnAdd.disabled = true;
        }
    }

    // Setup Desk Action Buttons
    function setupDeskActions() {
        // Toggle Desk LED Strip
        const btnLed = document.getElementById('btnToggleDeskLed');
        const strip = document.getElementById('deskAmbientStrip');
        if (btnLed && strip) {
            btnLed.addEventListener('click', () => {
                strip.classList.toggle('is-off');
                const isOff = strip.classList.contains('is-off');
                btnLed.textContent = isOff ? '💡 Bật LED' : '💡 LED Gầm bàn';
            });
        }

        // Reset Desk
        const btnReset = document.getElementById('btnResetDesk');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                deskState.monitor = null;
                deskState.laptop = null;
                deskState.audio = null;
                deskState.hub = null;
                updateDeskUI();
                if (typeof window.showToast === 'function') {
                    window.showToast('Đã dọn sạch mặt bàn làm việc!');
                }
            });
        }

        // Add Entire Combo to Cart
        const btnAddCombo = document.getElementById('btnAddComboToCart');
        if (btnAddCombo) {
            btnAddCombo.addEventListener('click', () => {
                const activeItems = ['monitor', 'laptop', 'audio', 'hub']
                    .map(slot => deskState[slot])
                    .filter(Boolean);

                if (!activeItems.length) return;

                // Push real numeric Product IDs & consistent discount (5% single, 10% for >=2) to cart
                try {
                    const cartKey = window.auth?.getCartStorageKey?.() || 'cart:guest';
                    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
                    const discountPct = activeItems.length >= 2 ? 10 : 5;
                    const priceFactor = 1 - discountPct / 100;

                    activeItems.forEach(item => {
                        const pid = Number(item.id);
                        const discountedPrice = Math.round(Number(item.price || 0) * priceFactor);
                        const selectedImg = String(item.image || '').replace(/^(\.\.\/)+/, '/');
                        const existing = cart.find(c => Number(c.productId) === pid && !c.selectedColor && !c.selectedStorage);
                        if (existing) {
                            existing.quantity = (existing.quantity || 1) + 1;
                            if (discountedPrice > 0) existing.price = Math.min(Number(existing.price || discountedPrice), discountedPrice);
                        } else {
                            cart.push({
                                productId: pid,
                                quantity: 1,
                                price: discountedPrice,
                                selectedImage: selectedImg,
                                title: item.title,
                                image: selectedImg
                            });
                        }
                    });

                    localStorage.setItem(cartKey, JSON.stringify(cart));
                    window.dispatchEvent(new Event('cartUpdated'));

                    if (typeof window.triggerVisualHaptic === 'function') {
                        window.triggerVisualHaptic('success');
                    }

                    if (typeof window.showToast === 'function') {
                        window.showToast(`🎉 Đã thêm trọn bộ ${activeItems.length} thiết bị vào giỏ hàng với ưu đãi -${discountPct}%!`, 'success');
                    }

                    // Open cart drawer or redirect after 700ms
                    setTimeout(() => {
                        window.location.href = '../../index.html?openCart=1';
                    }, 700);

                } catch (err) {
                    console.error('Add combo cart error:', err);
                }
            });
        }
    }

    // Launch
    document.addEventListener('DOMContentLoaded', init);
})();
