# Refactor Pagination & Response Standard

## Goal Description
Hiện tại API trả về dữ liệu thô (mảng) và logic phân trang bị sai (mất trang đầu tiên). Cần chuẩn hóa format trả về để Client (Frontend) có thể hiển thị thanh phân trang chính xác.

## User Review Required
> [!IMPORTANT]
> Change API Response Format: Response của API `GET /users` (và các API list sau này) sẽ thay đổi từ `Array<User>` sang Object `{ results: User[], page, limit, totalPages, totalResults }`. Client cần cập nhật để hứng đúng format này.

## Proposed Changes

### Logic Fixes
*   **Correction**: Sửa logic `skip` trong Prisma query từ `page * limit` thành `(page - 1) * limit` (do page bắt đầu từ 1).

### Structure Chances
#### [MODIFY] [user.service.ts](file:///e:/DMS/server/src/services/user.service.ts)
*   Update `queryUsers` return type.
*   Add `count` query to get total records.
*   Return standard pagination object.

## Verification Plan

### Manual Verification
1.  **Check Page 1**: `GET /v1/users?page=1&limit=10`.
    *   Verify `results` is not empty (if data exists).
    *   Verify `page: 1` in response.
2.  **Check Pagination Metadata**:
    *   Verify response keys: `results`, `page`, `limit`, `totalPages`, `totalResults`.
