# 🏰 TỨ ĐẠI THÀNH

## 📌 1. Giới thiệu dự án

**Tứ Đại Thành** là tựa game chiến thuật đối kháng 4 người theo lượt (Turn-based Strategy). Mỗi người chơi nắm giữ một Tòa thành với 30 HP khởi đầu:
- **Thành Đỏ**
- **Thành Vàng**
- **Thành Trắng**
- **Thành Lục**

Luật chơi mang tính chiến lược giữa các lựa chọn: **Tấn công**, **Phòng thủ**, hoặc **Kêu gọi hòa bình**. Dự án được xây dựng từ niềm đam mê hiện thực hóa một mô hình chiến thuật bàn cờ trên trang giấy thành một tựa game trực tuyến hoàn chỉnh, hỗ trợ nhiều người chơi tham gia thi đấu cùng lúc trong thời gian thực.

---

## 📁 2. Cấu trúc Repository
Repository này được tổ chức theo tiêu chuẩn phát triển phần mềm hiện đại, phân tách rõ ràng giữa **Mã nguồn phát triển (Development / Source Code)** và **Bản triển khai tối ưu hóa (Production Build)**:

```text
TuDaiThanh/
├── src/                                  # 📂 THƯ MỤC MÃ NGUỒN GỐC (DÀNH CHO BAN GIÁM KHẢO)
│   ├── ui.html                           # Toàn bộ mã nguồn giao diện HTML5, bố cục DOM & CSS Styling
│   └── game.js                           # Logic cốt lõi: Kết nối Firebase, Three.js 3D, phân giải lượt đấu
│
├── assets/                               # 📂 Bản đóng gói Production (Tối ưu hóa & Mã hóa bảo mật)
│   ├── index-CrGW0zpE.js                 # JS Bundle đã được mã hóa luồng, đóng gói DOM động và logic
│   └── index-D0Je_Ieh.css                 # CSS đã được minified tối đa tốc độ tải trang
│
├── index.html                            # Cổng nạp ứng dụng chuẩn SPA (Single Page Application - 18 dòng)
├── favicon.svg                           # Biểu tượng Vector chính thức của Tứ Đại Thành
├── firestore.rules                       # Hệ thống Security Rules bảo mật cấp cơ sở dữ liệu trên Firebase
└── README.md                             # Tài liệu giới thiệu và hướng dẫn dự án
```

> 🔍 **Lưu ý**  
> Toàn bộ logic thuật toán, phân giải sát thương, xử lý bất đồng bộ và cơ chế bảo mật nguyên bản được trình bày chi tiết, có chú thích đầy đủ tại thư mục **[`src/`](./src/)** (bao gồm [`src/ui.html`](./src/ui.html) và [`src/game.js`](./src/game.js)).

---

## ⚙️ 3. Kiến trúc Công nghệ & Kỹ thuật Nổi bật

### 🎮 Đồ họa & Trải nghiệm Người dùng (Frontend)
- **Three.js & Canvas 2.5D:** Hiệu ứng bắn pháo xoay nòng 360 độ, dựng khiên chắn năng lượng, tia khói đạn và cháy nổ hạt (particle system) chân thực.
- **Responsive 100% Khung hình:** Tự động tính toán tỷ lệ Viewport Scale thích ứng mọi kích thước màn hình máy tính, máy tính bảng và hiển thị hoàn hảo trong thẻ `<iframe>`.
- **Chống Spam & Giật lag (Debounce / Cooldown Locks):** Hệ thống khóa logic tạm thời chống spam click, ngăn chặn xung đột dữ liệu khi người chơi bấm nút liên tục.

### 🌐 Đồng bộ Mạng & Dữ liệu Thời gian thực (Backend & Networking)
- **Google Firebase Firestore:** Lưu trữ và đồng bộ hóa trạng thái phòng đấu tức thì giữa 4 người chơi theo mô hình Pub/Sub.
- **Firebase Anonymous Authentication:** Tự động cấp định danh (UID) ẩn danh độc lập cho từng người chơi, chống việc mở nhiều tab chiếm chỗ (seat spoofing).
- **Phân giải lượt đấu nguyên tử (Firestore Transactions):** Áp dụng ACID Transaction trên Firestore để xử lý tính toán điểm số đồng thời, loại bỏ hoàn toàn hiện tượng Race-condition hoặc xung đột kết quả khi hết giờ.
- **Dọn rác phòng tự động (Heartbeat & Ghost Cleanup):** Cơ chế nhịp tim phát hiện và loại bỏ người chơi mất kết nối, tự động giải phóng phòng chờ sau thời gian hết hạn (TTL).
- **Mật thư 1-1 (Private Chat Channels):** Hệ thống chat chiến thuật bí mật giữa từng cặp người chơi được bảo mật bằng phân quyền subcollection riêng biệt trên Firestore Rules.

---

## 🚀 4. Hướng dẫn Chạy Thử Dự Án

### Cách 1: Trải nghiệm Trực tiếp (Khuyên dùng)
Truy cập trực tiếp liên kết hosting game:  
👉 **[https://tudaithanh.vercel.app](https://tudaithanh.vercel.app)**

### Cách 2: Chạy cục bộ trên máy tính (Local Development)
1. Clone repository về máy:
   ```bash
   git clone https://github.com/vutieu1804k25-wq/TuDaiThanh.git
   ```
2. Mở thư mục dự án bằng VS Code hoặc bất kỳ trình soạn thảo mã nguồn nào.
3. Chạy file **`src/ui.html`** bằng tiện ích **Live Server** (hoặc mở trực tiếp file `index.html` trên trình duyệt hỗ trợ Module).

---

## 📜 5. Bản quyền & Thông tin tác giả
- **Tác giả kỹ thuật:** Tiêu Công Nguyên Vũ
- **Luật chơi được em tham khảo từ tác phẩm Liar Game, viết bởi tác giả Shinobu Kaitani**
