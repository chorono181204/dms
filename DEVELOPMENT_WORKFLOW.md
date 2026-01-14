# Standard Module Development Workflow

Quy trình chuẩn để phát triển một module mới (ví dụ: Quản lý Khoa, Quản lý Tài liệu...).

## 1. Backend Development (Server)
*   **Database**: Cập nhật `schema.prisma` và chạy `npx prisma db push` (hoặc migrate).
*   **Validation**: Viết validate (`Joi`) trong `src/validations`.
*   **Service**: Viết logic nghiệp vụ (CRUD) trong `src/services`.
*   **Controller**: Viết logic xử lý request/response trong `src/controllers`.
*   **Route**: Khai báo API route trong `src/routes/v1` và đăng ký trong `index.ts`.
*   *Check*: Đảm bảo Server chạy không lỗi (`npm run dev`).

## 2. Frontend Integration (Client)
*   **API Service**: Tạo file service trong `src/services` (ví dụ: `user.service.ts`) để gọi API.
*   **Interface**: Định nghĩa Types/Interfaces khớp với dữ liệu trả về từ Backend.
*   **UI Component**: Tạo hoặc update màn hình trong `src/pages` hoặc `src/components`.
*   **Integration**:
    *   Fetch dữ liệu (List).
    *   Bind biến vào Form (Create/Edit).
    *   Xử lý sự kiện (Submit, Delete, Pagination).

## 3. Verification & Testing (Browser)
*   **Mở Browser**: Truy cập trực tiếp `http://localhost:5173`.
*   **Test Case**:
    *   **Read**: Dữ liệu hiển thị đúng cột? (vd: Tên Khoa, Role).
    *   **Create**: Thêm mới thành công? Có validate lỗi không?
    *   **Update**: Sửa dữ liệu, reload trang có cập nhật không?
    *   **Delete**: Xóa thành công không?
    *   **Edge Cases**: Pagination, Search, Empty data.

## 4. Finalize
*   Review lại code.
*   Update `task.md`.
