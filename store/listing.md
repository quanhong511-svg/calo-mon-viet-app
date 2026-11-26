# Trang CH Play — Calo Món Việt

Dán từng mục vào **Play Console → Phát triển (Grow) → Hiện diện trên cửa hàng → Trang thông tin chính**.

## Tên ứng dụng (≤ 30 ký tự)

```
Calo Món Việt – Đếm calo
```

## Mô tả ngắn (≤ 80 ký tự)

```
Chụp ảnh món Việt, biết ngay calo. Theo dõi bữa ăn, uống nước, xem tiến độ.
```

## Mô tả đầy đủ (≤ 4000 ký tự)

```
Calo Món Việt giúp bạn đếm calo cho bữa ăn hằng ngày, được làm riêng cho món Việt: phở, bún chả, cơm tấm, bánh mì, bún bò Huế, xôi, gỏi cuốn… và hơn 70 món quen thuộc khác.

📸 CHỤP ẢNH LÀ BIẾT CALO
Chụp hoặc chọn ảnh món ăn, ứng dụng nhận diện món và ước tính calo, đạm, tinh bột, chất béo. Dùng Google Gemini miễn phí, Claude hoặc ChatGPT bằng khoá API của bạn, hoặc tự nhập mô tả kiểu "phở bò tô lớn, trà đá".

✨ TƯ VẤN DINH DƯỠNG BẰNG AI
AI xem 3 ngày ăn uống gần nhất và nhận xét: đủ năng lượng chưa, đủ chất chưa, nên thêm món gì. Nội dung chỉ mang tính chất tham khảo, không thay thế tư vấn y tế.

🎯 MỤC TIÊU CALO, ĐẠM, TINH BỘT, CHẤT BÉO
Biểu đồ vòng cho biết hôm nay còn bao nhiêu kcal và từng chất so với mục tiêu bạn tự đặt. Thẻ so sánh 3 ngày chấm điểm và cho biết ngày nào ăn uống tối ưu nhất.

🍽️ 6 BỮA & NHẮC GIỜ ĂN
Bữa sáng, trưa, tối và 3 bữa phụ. Hẹn giờ nhắc từng bữa, nhắc tổng kết mỗi tối – bữa nào đã ghi thì không nhắc nữa.

💧 NƯỚC & ☕ CÀ PHÊ
Ghi nước theo cốc, đặt mục tiêu và nhận nhắc nhở. Ghi cà phê theo ly (Pour Over, Espresso, Latte, Just Coffee), ước tính caffeine, nhắc 4 giờ sau ly gần nhất.

👥 SO SÁNH VỚI BẠN BÈ
Quét mã QR của nhau để xem bảng xếp hạng ăn uống 3 ngày, TOP 1-2-3, và tạo ảnh chia sẻ lên Instagram, Facebook.

🎨 ẢNH MÓN ĂN CÓ FILTER & HASHTAG
5 filter, 5 bố cục (cả Story 9:16), tự thêm tên món, calo, dinh dưỡng và hashtag để đăng mạng xã hội.

🏆 LỜI CHÚC THÀNH TÍCH
Ăn khoẻ, uống đủ nước, giữ phong độ nhiều ngày liền… chạm vào tên ứng dụng để nhận lời chúc.

📈 TIẾN ĐỘ, BÁO CÁO & SAO LƯU
Biểu đồ calo 7–90 ngày, xuất báo cáo PDF; sao lưu và khôi phục bằng tệp .json hoặc .pdf.

🔒 DỮ LIỆU CỦA BẠN Ở TRÊN MÁY
Không cần tạo tài khoản, không quảng cáo, không theo dõi. Nhật ký ăn uống chỉ lưu trên điện thoại.

Lưu ý: số liệu dinh dưỡng là ước tính để tham khảo, không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.
```

## Đồ hoạ

| Mục | Tệp | Yêu cầu của Play |
|---|---|---|
| Biểu tượng ứng dụng | `store/icon-512.png` | PNG 512×512, ≤ 1 MB |
| Hình ảnh nổi bật | `store/feature-1024x500.png` | PNG/JPG 1024×500 |
| Ảnh chụp màn hình điện thoại | `store/screens/*.png` (4 ảnh, 1080×2160) | 2–8 ảnh, tỉ lệ tối đa 2:1 |

Tạo lại đồ hoạ: `cd scripts && npm i --no-save sharp && node make-store-art.mjs ../store`
Chụp lại màn hình (cần `npx expo start --web --port 8092` đang chạy): `npm i --no-save puppeteer-core && node scripts/store-screens.mjs store/screens`

## Phân loại

- Danh mục: **Sức khoẻ & Thể hình (Health & Fitness)**
- Thẻ gợi ý: Đếm calo, Dinh dưỡng, Ăn kiêng
- Email liên hệ: quanhong.511@gmail.com
- Chính sách quyền riêng tư: _(URL công khai của `docs/privacy/index.html`)_

## Gợi ý trả lời mục Bảo mật dữ liệu (Data safety)

- **Ứng dụng có thu thập hoặc chia sẻ dữ liệu không?** Có — chỉ ảnh do người dùng chủ động gửi đi nhận diện.
- **Loại dữ liệu:** Ảnh và video → *Ảnh*.
  - Thu thập: Có · Chia sẻ: Không (gửi tới nhà cung cấp dịch vụ xử lý thay mặt người dùng không tính là "chia sẻ").
  - Xử lý tạm thời (ephemeral): Có · Bắt buộc: Không (người dùng có thể dùng chế độ offline).
  - Mục đích: Chức năng ứng dụng.
- **Mã hoá khi truyền:** Có (HTTPS tới Gemini / Claude / ChatGPT).
- Tư vấn AI gửi tóm tắt nhật ký ăn uống (không kèm ảnh) khi người dùng bấm phân tích → khai thêm *Sức khoẻ & thể chất → Thông tin thể chất/dinh dưỡng*: Thu thập: Có, xử lý tạm thời, không bắt buộc, mục đích Chức năng ứng dụng.
- **Người dùng yêu cầu xoá dữ liệu được không:** Dữ liệu chỉ ở trên máy; gỡ ứng dụng là xoá hết.
- Không thu thập: vị trí, danh bạ, thông tin cá nhân, sức khoẻ gửi về máy chủ, mã thiết bị, dữ liệu phân tích.
