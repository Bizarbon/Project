const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { protect, admin, requirePermission } = require('../middleware/auth');

const DEFAULT_BLOG_SEED = [
    {
        title: 'Đánh giá chi tiết Laptop ASUS TUF Gaming A16 FA607: Cỗ máy gaming đáng mua nhất phân khúc',
        category: 'Đánh giá',
        author: 'Vũ Phi Long',
        excerpt: 'Sở hữu vi xử lý AMD Ryzen thế hệ mới cùng card đồ họa rời mạnh mẽ, ASUS TUF A16 mang lại hiệu năng ổn định vượt bậc cho cả game thủ lẫn người làm sáng tạo nội dung.',
        content: 'ASUS TUF Gaming A16 FA607 là một trong những mẫu laptop gaming cân bằng tốt nhất giữa hiệu năng, tản nhiệt và độ bền đạt chuẩn quân đội MIL-STD-810H.\n\n1. Thiết kế & Màn hình:\nMàn hình 16 inch tỷ lệ 16:10, tần số quét 165Hz cùng độ phủ màu 100% sRGB giúp hiển thị chuyển động mượt mà khi chơi game FPS lẫn dựng video, chỉnh ảnh chuẩn màu.\n\n2. Hiệu năng & Tản nhiệt:\nHệ thống tản nhiệt 2 quạt Arc Flow 84 cánh kết hợp 5 ống đồng giúp máy duy trì xung nhịp ổn định trong các tựa game AAA ở thiết lập High/Ultra mà nhiệt độ vùng kê tay vẫn dễ chịu.\n\n3. Thời lượng pin & Cổng kết nối:\nViên pin 90Wh kết hợp sạc nhanh Type-C PD giúp bạn tự tin mang máy lên giảng đường hay văn phòng cả ngày dài.\n\nKết luận: Nếu bạn cần một chiếc laptop bền bỉ, cấu hình khỏe để chiến game kiêm học lập trình, đồ họa trong tầm giá hợp lý, ASUS TUF A16 FA607 là lựa chọn rất đáng cân nhắc tại TechEcommerce.',
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
        tags: ['laptop', 'asus', 'gaming', 'tuf'],
        status: 'published',
        views: 1420
    },
    {
        title: 'Top 5 phụ kiện Apple không thể thiếu cho góc làm việc tối giản năm 2026',
        category: 'Tư vấn',
        author: 'TechEcommerce Editorial',
        excerpt: 'Từ củ sạc đa cổng GaN công suất cao, tai nghe không dây chống ồn đến bàn phím Magic Keyboard và đế sạc MagSafe gọn gàng.',
        content: 'Một góc làm việc gọn gàng, tối giản giúp tăng hiệu suất tập trung đáng kể. Dưới đây là 5 món phụ kiện đáng đầu tư nhất cho hệ sinh thái Apple năm 2026:\n\n1. Củ sạc GaN đa cổng 65W–140W: Chỉ cần một củ sạc duy nhất cho cả MacBook, iPhone và iPad, giảm hẳn mớ dây nhợ rườm rà.\n\n2. Hub chuyển đổi USB-C đa năng: Hỗ trợ xuất hình 4K@60Hz, khe thẻ SD tốc độ cao và sạc truyền qua PD 100W.\n\n3. Tai nghe AirPods Pro hoặc chống ồn chủ động: Cách ly tạp âm hiệu quả trong không gian văn phòng hoặc quán cà phê.\n\n4. Đế sạc MagSafe 3-trong-1: Giữ iPhone, Apple Watch và AirPods luôn đầy pin ngay trên bàn.\n\n5. Chuột công thái học & Bàn phím không dây: Bảo vệ cổ tay khi làm việc 8 tiếng mỗi ngày.\n\nBạn có thể phối thử toàn bộ combo này trực quan bằng công cụ TechDesk Studio (Setup Builder 2.5D) ngay trên TechEcommerce!',
        image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80',
        tags: ['apple', 'phụ kiện', 'setup', 'tối giản'],
        status: 'published',
        views: 980
    },
    {
        title: 'Hướng dẫn tối ưu hóa Windows 11 giúp tăng tốc độ mở ứng dụng và chơi game mượt hơn',
        category: 'Thủ thuật',
        author: 'Admin Support',
        excerpt: 'Tổng hợp các mẹo tinh chỉnh hệ thống an toàn, quản lý ứng dụng khởi động, bật Game Mode và tối ưu GPU chuẩn xác nhất.',
        content: 'Sau một thời gian sử dụng, Windows 11 có thể chậm dần do các ứng dụng chạy nền. Thực hiện 5 bước tối ưu chuẩn kỹ thuật sau để máy mượt như mới:\n\n1. Tắt ứng dụng khởi động cùng Windows: Mở Task Manager > Startup Apps và vô hiệu hóa các phần mềm không cần thiết chạy ngay khi bật máy.\n\n2. Bật Game Mode & Hardware-Accelerated GPU Scheduling: Vào Settings > Gaming > Game Mode (Bật) và Graphics Settings để ưu tiên GPU rời cho phần mềm đồ họa/game.\n\n3. Cập nhật driver chipset & GPU chính hãng: Luôn dùng driver mới nhất từ NVIDIA, AMD hoặc Intel để vá lỗi tụt FPS.\n\n4. Bật Storage Sense: Tự động dọn dẹp tệp tạm và thùng rác định kỳ giúp SSD luôn duy trì tốc độ đọc ghi tối đa.\n\n5. Chọn chế độ năng lượng Best Performance khi cắm sạc và Balanced khi dùng pin.',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
        tags: ['windows 11', 'thủ thuật', 'tối ưu', 'gaming'],
        status: 'published',
        views: 2310
    },
    {
        title: 'Xu hướng chip xử lý AI (NPU) trên smartphone và laptop cá nhân trong năm 2026',
        category: 'Tin tức',
        author: 'Vũ Phi Long',
        excerpt: 'Cuộc đua NPU tích hợp trực tiếp trên vi xử lý di động đang định hình lại cách người dùng dịch thuật, chỉnh ảnh và làm việc ngay trên thiết bị.',
        content: 'Năm 2026 đánh dấu bước ngoặt lớn khi hầu hết smartphone flagship và laptop tầm trung trở lên đều sở hữu nhân xử lý AI chuyên dụng (NPU) đạt trên 45 TOPS.\n\n• Xử lý AI trực tiếp trên máy (On-device AI): Giúp tóm tắt văn bản, dịch thuật thời gian thực, tách nền ảnh/video mà không cần gửi dữ liệu nhạy cảm lên đám mây.\n\n• Tiết kiệm pin vượt trội: Thay vì bắt CPU/GPU tiêu tốn nhiều điện năng cho tác vụ AI, NPU đảm nhận công việc với mức tiêu thụ điện thấp hơn nhiều lần.\n\n• Hỗ trợ sáng tạo nội dung & học tập: Từ ghi chú thông minh bằng bút cảm ứng trên tablet đến hỗ trợ lập trình cục bộ trên laptop mỏng nhẹ.\n\nKhám phá ngay các dòng smartphone và laptop tích hợp chip AI thế hệ mới chính hãng tại TechEcommerce.',
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
        tags: ['ai', 'npu', 'chip', 'công nghệ 2026'],
        status: 'published',
        views: 850
    }
];

let blogSeedChecked = false;
async function ensureBlogSeeded() {
    if (blogSeedChecked) return;
    const count = await BlogPost.countDocuments();
    if (count === 0) {
        for (const item of DEFAULT_BLOG_SEED) {
            await new BlogPost(item).save();
        }
    }
    blogSeedChecked = true;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializePost(doc) {
    return {
        id: doc._id,
        _id: doc._id,
        title: doc.title,
        slug: doc.slug || '',
        category: doc.category,
        author: doc.author || 'TechEcommerce Editorial',
        excerpt: doc.excerpt || '',
        content: doc.content || '',
        image: doc.image || '',
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        status: doc.status || 'published',
        views: Number(doc.views || 0),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : '',
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : ''
    };
}

// Public: GET /api/blog (published articles)
router.get('/', async (req, res) => {
    try {
        await ensureBlogSeeded();
        const filter = { status: 'published' };
        const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (category && category !== 'all') filter.category = category;
        if (search) {
            const rx = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ title: rx }, { excerpt: rx }, { content: rx }, { tags: rx }];
        }
        const docs = await BlogPost.find(filter).sort({ createdAt: -1, _id: -1 }).limit(100).lean();
        res.json({ articles: docs.map(serializePost) });
    } catch (error) {
        res.status(500).json({ message: 'Không thể tải danh sách bài viết.' });
    }
});

// Admin: GET /api/blog/admin/all
router.get('/admin/all', protect, admin, requirePermission('blog', 'view'), async (req, res) => {
    try {
        await ensureBlogSeeded();
        const docs = await BlogPost.find().sort({ createdAt: -1, _id: -1 }).limit(200).lean();
        res.json({ articles: docs.map(serializePost) });
    } catch (error) {
        res.status(500).json({ message: 'Không thể tải danh sách bài viết quản trị.' });
    }
});

// Public: GET /api/blog/:id (single article + view increment)
router.get('/:id', async (req, res) => {
    try {
        await ensureBlogSeeded();
        const id = Number(req.params.id);
        const query = Number.isFinite(id) ? { _id: id, status: 'published' } : { slug: String(req.params.id), status: 'published' };
        const doc = await BlogPost.findOneAndUpdate(query, { $inc: { views: 1 } }, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        res.json({ article: serializePost(doc) });
    } catch (error) {
        res.status(500).json({ message: 'Không thể tải chi tiết bài viết.' });
    }
});

// Admin: POST /api/blog
router.post('/', protect, admin, requirePermission('blog', 'create'), async (req, res) => {
    try {
        const { title, category, author, image, excerpt, content, tags, status } = req.body || {};
        if (!title || !content) {
            return res.status(400).json({ message: 'Vui lòng nhập tiêu đề và nội dung bài viết.' });
        }
        const tagList = Array.isArray(tags)
            ? tags.map(t => String(t).trim()).filter(Boolean)
            : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);

        const created = await new BlogPost({
            title: String(title).trim(),
            category: String(category || 'Tin tức').trim(),
            author: String(author || req.user?.name || 'TechEcommerce Editorial').trim(),
            image: String(image || '').trim(),
            excerpt: String(excerpt || '').trim() || String(content).trim().slice(0, 180),
            content: String(content).trim(),
            tags: tagList,
            status: status === 'draft' ? 'draft' : 'published',
            views: 0
        }).save();

        res.status(201).json({ message: 'Đã tạo bài viết thành công.', article: serializePost(created) });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Không thể tạo bài viết.' });
    }
});

// Admin: PUT /api/blog/:id
router.put('/:id', protect, admin, requirePermission('blog', 'edit'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const doc = await BlogPost.findById(id);
        if (!doc) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });

        const { title, category, author, image, excerpt, content, tags, status } = req.body || {};
        if (title !== undefined) doc.title = String(title).trim();
        if (category !== undefined) doc.category = String(category).trim();
        if (author !== undefined) doc.author = String(author).trim();
        if (image !== undefined) doc.image = String(image).trim();
        if (excerpt !== undefined) doc.excerpt = String(excerpt).trim();
        if (content !== undefined) doc.content = String(content).trim();
        if (tags !== undefined) {
            doc.tags = Array.isArray(tags)
                ? tags.map(t => String(t).trim()).filter(Boolean)
                : String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
        }
        if (status !== undefined) doc.status = status === 'draft' ? 'draft' : 'published';

        await doc.save();
        res.json({ message: 'Đã cập nhật bài viết thành công.', article: serializePost(doc) });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Không thể cập nhật bài viết.' });
    }
});

// Admin: DELETE /api/blog/:id
router.delete('/:id', protect, admin, requirePermission('blog', 'delete'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const deleted = await BlogPost.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Không tìm thấy bài viết.' });
        res.json({ message: 'Đã xóa bài viết thành công.', deletedId: id });
    } catch (error) {
        res.status(500).json({ message: 'Không thể xóa bài viết.' });
    }
});

module.exports = router;
