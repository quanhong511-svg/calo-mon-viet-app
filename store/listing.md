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
Chụp hoặc chọn ảnh món ăn, ứng dụng nhận diện món và ước tính calo, đạm, tinh bột, chất béo. Bạn có thể dùng Google Gemini miễn phí bằng khoá của mình, hoặc tự nhập mô tả kiểu "phở bò tô lớn, trà đá".

🍜 BẢNG MÓN VIỆT SẴN CÓ
Không có mạng vẫn ghi được: chọn món trong bảng, chỉnh số gram, ứng dụng tự tính dinh dưỡng.

🎯 MỤC TIÊU MỖI NGÀY
Vòng calo cho biết hôm nay còn bao nhiêu kcal, cùng tỉ lệ đạm – tinh bột – chất béo. Chuỗi ngày ghi liên tục giúp bạn giữ thói quen.

💧 NHẮC UỐNG NƯỚC
Ghi nước theo cốc 250 ml, đặt mục tiêu mỗi ngày và nhận nhắc nhở theo khung giờ bạn chọn. Uống đủ thì ứng dụng tự ngừng nhắc trong ngày.

📈 TIẾN ĐỘ & BÁO CÁO PDF
Biểu đồ calo 7, 14, 30 hoặc 90 ngày, chia theo đạm, tinh bột, chất béo. Xuất báo cáo PDF để lưu trữ hoặc gửi bác sĩ, huấn luyện viên.

🔒 DỮ LIỆU CỦA BẠN Ở TRÊN MÁY
Không cần tạo tài khoản, không quảng cáo, không theo dõi. Nhật ký ăn uống chỉ lưu trên điện thoại; bạn có thể sao lưu và khôi phục bằng tệp.

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
- **Mã hoá khi truyền:** Có (HTTPS tới Gemini / OpenRouter / Groq).
- **Người dùng yêu cầu xoá dữ liệu được không:** Dữ liệu chỉ ở trên máy; gỡ ứng dụng là xoá hết.
- Không thu thập: vị trí, danh bạ, thông tin cá nhân, sức khoẻ gửi về máy chủ, mã thiết bị, dữ liệu phân tích.
