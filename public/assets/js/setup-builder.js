/**
 * TechDesk Studio — 2.5D Interactive Setup Builder & Live Compatibility Engine
 * 100% Semantic Vanilla JS, Zero-dependency
 */

(function () {
    'use strict';

    // Curated Hardware Database with Real Hardware Specifications
    const HARDWARE_CATALOG = [
        // Category: Laptops / PC
        {
            id: 'sb-lap-1',
            category: 'laptop',
            title: 'Apple MacBook Pro 14 inch M3 Pro',
            specs: '18GB RAM • 512GB SSD • 3x Thunderbolt 4',
            price: 49990000,
            image: '../../assets/images/products/macbook-pro-14-m3.jpg',
            ports: ['Thunderbolt 4 / USB-C', 'HDMI', 'MagSafe 3'],
            powerWattage: 70,
            supportsUsbCDisplay: true
        },
        {
            id: 'sb-lap-2',
            category: 'laptop',
            title: 'Laptop Gaming ASUS ROG Strix SCAR 16',
            specs: 'Core i9-14900HX • RTX 4080 • 32GB RAM',
            price: 64990000,
            image: '../../assets/images/products/asus-rog-strix-g16.jpg',
            ports: ['HDMI 2.1', 'Thunderbolt 4', 'USB-A 3.2'],
            powerWattage: 240,
            supportsUsbCDisplay: true
        },
        {
            id: 'sb-lap-3',
            category: 'laptop',
            title: 'Laptop ASUS Zenbook 14 OLED UX3405',
            specs: 'Intel Core Ultra 7 • 16GB RAM • Siêu mỏng nhẹ',
            price: 26990000,
            image: '../../assets/images/products/asus-zenbook-14.jpg',
            ports: ['Thunderbolt 4 / USB-C', 'HDMI 2.1'],
            powerWattage: 65,
            supportsUsbCDisplay: true
        },

        // Category: Monitors
        {
            id: 'sb-mon-1',
            category: 'monitor',
            title: 'Màn hình Dell UltraSharp 27 inch 4K (U2723QE)',
            specs: '4K IPS Black • 90W Type-C Hub • 100% sRGB',
            price: 13890000,
            image: '../../assets/images/products/dell-ultrasharp-27.jpg',
            ports: ['USB-C 90W PD', 'HDMI 2.1', 'DisplayPort 1.4'],
            requiresHubForUsbC: false,
            powerDeliveryWatt: 90
        },
        {
            id: 'sb-mon-2',
            category: 'monitor',
            title: 'Màn hình Gaming Cong LG UltraGear 34 inch OLED 240Hz',
            specs: 'WQHD 3440x1440 • 0.03ms • 240Hz Gaming',
            price: 24990000,
            image: '../../assets/images/products/lg-ultragear-oled.jpg',
            ports: ['HDMI 2.1', 'DisplayPort 1.4'],
            requiresHubForUsbC: true,
            powerDeliveryWatt: 0
        },
        {
            id: 'sb-mon-3',
            category: 'monitor',
            title: 'Màn hình Đồ họa Samsung ViewFinity S9 5K 27 inch',
            specs: '5K 5120x2880 • Thunderbolt 4 • Smart Calibration',
            price: 21990000,
            image: '../../assets/images/products/cand-monitor.jpg',
            ports: ['Thunderbolt 4', 'Mini DisplayPort'],
            requiresHubForUsbC: false,
            powerDeliveryWatt: 90
        },

        // Category: Audio / Speakers
        {
            id: 'sb-aud-1',
            category: 'audio',
            title: 'Tai nghe Chống ồn Không dây Sony WH-1000XM5',
            specs: 'Chống ồn đỉnh cao • LDAC • Pin 30 giờ',
            price: 6990000,
            image: '../../assets/images/products/sony-wh-1000xm5.jpg',
            connectionType: 'Bluetooth 5.2 / Jack 3.5mm',
            isWireless: true
        },
        {
            id: 'sb-aud-2',
            category: 'audio',
            title: 'Tai nghe Apple AirPods Max USB-C',
            specs: 'Spatial Audio • Chống ồn chủ động ANC • Thiết kế kim loại',
            price: 12990000,
            image: '../../assets/images/products/airpods-max.jpg',
            connectionType: 'Bluetooth 5.3 / USB-C Audio',
            isWireless: true
        },
        {
            id: 'sb-aud-3',
            category: 'audio',
            title: 'Loa Để bàn Cao cấp Marshall Major IV Hi-Res',
            specs: 'Âm thanh nổi vang dội • Bluetooth 5.2 • Cổng AUX',
            price: 4990000,
            image: '../../assets/images/products/marshall-major-iv.jpg',
            connectionType: 'Bluetooth 5.2 / AUX 3.5mm',
            isWireless: true
        },

        // Category: Hub & Accessories
        {
            id: 'sb-hub-1',
            category: 'hub',
            title: 'Hub Chuyển Đổi HyperDrive Pro 10-in-1 Dual 4K HDMI',
            specs: '2x HDMI 4K@60Hz • 100W PD Pass-through • Jack 3.5mm • RJ45',
            price: 1290000,
            image: '../../assets/images/products/hyperdrive-hub-10in1.jpg',
            features: ['HDMI Out', '100W PD Pass-Through', '3.5mm Audio', 'USB 3.0'],
            wattageSupport: 100,
            hasHdmiOut: true,
            hasAudioJack: true
        },
        {
            id: 'sb-hub-2',
            category: 'hub',
            title: 'Củ Sạc Nhanh GaN Anker Prime 100W 3 Cổng',
            specs: '2x USB-C + 1x USB-A • Chuẩn PD 3.0 • PowerIQ 4.0',
            price: 1490000,
            image: '../../assets/images/products/anker-prime-100w.jpg',
            features: ['100W Fast Charge', 'GaN Technology'],
            wattageSupport: 100,
            hasHdmiOut: false,
            hasAudioJack: false
        },
        {
            id: 'sb-hub-3',
            category: 'hub',
            title: 'Cáp Sạc Nhanh Apple USB-C Đan Dệt Siêu Bền 240W',
            specs: 'Chuẩn sạc 240W • Vỏ bọc dù chống đứt gãy • Chiều dài 2m',
            price: 690000,
            image: '../../assets/images/products/apple-usbc-cable-240w.jpg',
            features: ['240W Max Power', 'Vỏ đan dù'],
            wattageSupport: 240,
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

    // Initialize UI
    function init() {
        renderInventoryTabs();
        renderInventoryCards();
        setupDragAndDrop();
        setupDeskActions();
        updateDeskUI();
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
            <li class="inventory-card-item" draggable="true" data-item-id="${item.id}" tabindex="0" role="button" aria-label="${item.title}, giá ${fmt(item.price)}">
                <img src="${item.image}" alt="${item.title}" class="inventory-item-thumb" onerror="this.src='../../assets/images/product-placeholder.svg'">
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
                    desc: `${monitor.title} yêu cầu cổng HDMI/DisplayPort trong khi ${laptop.title} tối ưu cổng Type-C. Hãy gắn thêm Hub 10-in-1 để xuất hình 4K!`,
                    action: { text: '+ Thêm Hub Ugreen 10-in-1', targetId: 'sb-hub-1' }
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
                const targetItem = HARDWARE_CATALOG.find(i => i.id === targetId);
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

                // Push items to localStorage cart
                try {
                    const cartKey = window.auth?.getCartStorageKey?.() || 'cart:guest';
                    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');

                    activeItems.forEach(item => {
                        const existing = cart.find(c => String(c.productId) === String(item.id));
                        if (existing) {
                            existing.quantity = (existing.quantity || 1) + 1;
                        } else {
                            cart.push({
                                productId: item.id,
                                quantity: 1,
                                price: Math.round(item.price * 0.9), // 10% Combo discount applied
                                title: item.title,
                                image: item.image
                            });
                        }
                    });

                    localStorage.setItem(cartKey, JSON.stringify(cart));
                    window.dispatchEvent(new Event('cartUpdated'));

                    // Trigger visual haptic
                    if (typeof window.triggerVisualHaptic === 'function') {
                        window.triggerVisualHaptic('success');
                    }

                    if (typeof window.showToast === 'function') {
                        window.showToast(`🎉 Đã thêm trọn bộ ${activeItems.length} thiết bị vào giỏ hàng với ưu đãi -10%!`, 'success');
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
