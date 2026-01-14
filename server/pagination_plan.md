# Refactor Pagination & Response

## 1. Goal
Fix logic phân trang sai và chuẩn hóa cấu trúc response API để Client có thể render phân trang (Pagination UI).

## 2. Issues Found
1.  **Logic sai**: `skip: page * limit`. Nếu `page=1`, `limit=10` -> `skip=10` (Bỏ qua 10 bản ghi đầu tiên, tức là mất trang 1).
    *   *Fix*: `skip: (page - 1) * limit`.
2.  **Thiếu Metadata**: Response hiện tại chỉ trả về `[User1, User2...]`. Client không biết tổng số bản ghi để tính số trang.
    *   *Fix*: Trả về object `{ results, page, limit, totalPages, totalResults }`.

## 3. Proposed Changes

### `src/types/response.d.ts` (New)
Định nghĩa Interface cho Paginated Response.

### `src/services/user.service.ts`
Sửa hàm `queryUsers`:
- Query thêm `prisma.user.count({ where: filter })` để lấy `totalResults`.
- Tính `totalPages = Math.ceil(totalResults / limit)`.
- Sửa `skip`.
- Return object thay vì array.

### `src/controllers/user.controller.ts`
- Không cần sửa nhiều, chỉ cần đảm bảo TypeScript nhận đúng kiểu trả về từ service.

## 4. Verification
- Manual Test: Gọi API `GET /v1/users?page=1&limit=10`.
    - Kỳ vọng: Nhận được kết quả trang 1 (không bị skip mất).
    - Response có field `totalResults`.
