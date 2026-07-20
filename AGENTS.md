# TechEcommerce Frontend Rules

## Core Requirement

Khi tạo mới hoặc chỉnh sửa giao diện frontend, luôn tuân thủ yêu cầu sau:

> Hãy viết code cho trang này bằng 100% Semantic HTML5, tuyệt đối không lạm dụng thẻ `div` vô nghĩa, tối ưu cấu trúc dữ liệu để chuẩn SEO và các công cụ tìm kiếm AI.

## Semantic HTML5

- Uu tien cac phan tu co y nghia nhu `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `figure`, `figcaption`, `address`, `time`, `details`, `summary`, `form`, `fieldset`, `legend`, `label`, `ul`, `ol` va `table`.
- Chi dung `div` hoac `span` khi khong co phan tu semantic phu hop va phan tu do thuc su can cho bo cuc, styling hoac script.
- Moi trang chi co mot noi dung `main`; dung mot `h1` ro rang va duy tri thu tu heading hop ly, khong nhay cap tuy tien.
- Dung `a` cho dieu huong va dung `button` cho hanh dong. Khong bien `div` thanh nut bam.
- Form phai co `label`, ten truong ro rang, kieu input phu hop, thong bao loi de hieu va co the thao tac bang ban phim.
- Anh noi dung phai co `alt` mo ta dung muc dich; anh trang tri dung `alt=""`. Uu tien `picture`, kich thuoc anh ro rang va lazy loading khi phu hop.
- Uu tien semantic goc cua HTML; chi them ARIA khi HTML native chua dien dat du thong tin.

## SEO And AI Search

- Moi trang phai co `title`, meta description, canonical URL va metadata Open Graph phu hop voi noi dung.
- Noi dung quan trong phai ton tai trong HTML co the doc duoc, khong chi duoc chen bang CSS, anh hoac thanh phan tuong tac.
- Dung URL, anchor text, heading, breadcrumb va noi dung tieng Viet ro rang; khong nhoi nhet tu khoa hoac tao noi dung an.
- Them JSON-LD Schema.org dung ngu canh khi can: `Organization`, `WebSite`, `BreadcrumbList`, `Product`, `Offer`, `AggregateRating` va `FAQPage`.
- Du lieu co cau truc phai khop voi noi dung ma nguoi dung nhin thay va duoc tao tu du lieu san pham thuc te.
- Cac trang san pham can co ten, thuong hieu, SKU, gia, tinh trang ton kho, hinh anh, mo ta, thong so ky thuat va danh gia o cau truc de may tim kiem co the hieu.

## Quality Gate

- Giu nguyen ngon ngu thiet ke va chuc nang hien co tru khi yeu cau thay doi.
- Kiem tra responsive tren desktop va mobile, thao tac ban phim, focus, contrast, text overflow va cac lien ket dieu huong.
- Khong tao wrapper thua, heading rong, lien ket gia, metadata sai hoac schema khong ton tai tren giao dien.
- Khi thay doi frontend, chi sua ma nguon trong `frontend/`. Sau do chay `npm run build` de dong bo sang `public/` truoc khi test va deploy.
- Truoc khi ket thuc, kiem tra trang khong co loi console nghiem trong, duong dan noi bo hoat dong va noi dung semantic van hop le sau khi JavaScript render.
