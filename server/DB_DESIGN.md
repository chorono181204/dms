# Database Schema Design for DMS & Signing System

## 1. Overview
Thiết kế database tập trung vào khả năng quản lý văn bản (DMS) và quy trình ký duyệt (Signing Workflow). Hệ thống cần hỗ trợ lưu trữ văn bản (nội dung HTML/JSON từ editor), quản lý các phiên bản, và theo dõi lịch sử ký/phê duyệt.

## 2. Proposed Schema (Prisma - SQLite)

> [!NOTE]
> Chuyển đổi sang **SQLite** theo yêu cầu. Lưu ý SQLite có một số hạn chế so với PostgreSQL (ví dụ: không có enum native, nhưng Prisma sẽ giả lập).

### Data Isolation Strategy (Chính sách phân quyền)
Để đảm bảo **"Phòng ban nào chỉ thấy dữ liệu của phòng ban đó"**:
1. Các bảng dữ liệu chính (`Document`, `Template`) sẽ bắt buộc có trường `departmentId`.
2. Logic truy vấn:
    - **User/Manager**: Luôn kèm điều kiện `WHERE departmentId = currentUser.departmentId`.
    - **Admin**: Không cần điều kiện này (thấy tất cả).
3. **Không cần liên kết mọi bảng**: Các bảng con (như `Signature`, `DocumentHistory`) ăn theo `Document`, nên chỉ cần chặn ở `Document` là đủ.

### User Management Permission
- **Admin**: Xem toàn bộ User của hệ thống.
- **Manager**: Chỉ xem được danh sách User có cùng `departmentId` với mình.
- **User**: Chỉ xem được thông tin của chính mình (hoặc public profile cơ bản của đồng nghiệp nếu cần thiết cho workflow).

### Document Permissions (Thay thế Workflow)
Thay vì quy trình cứng, ta dùng cơ chế **Phân quyền trên từng tài liệu**:
- **DocumentPermission**: Bảng trung gian xác định User A được làm gì trên Document B.
- Quyền: `VIEW` (Xem), `EDIT` (Sửa), `SIGN` (Ký), `APPROVE` (Duyệt).

### Core Models
- **User**: Mở rộng để lưu thông tin chữ ký (ảnh chữ ký), phòng ban (Department), chức vụ.
- **Department**: Quản lý phòng ban (Khoa hóa sinh, Khoa nội...).
- **Document**: Bảng chính lưu văn bản.
- **Template**: Lưu mẫu văn bản (để dùng lại).

### Workflow & Signing Models
- **Workflow**: Định nghĩa quy trình mẫu (Ví dụ: Quy trình duyệt báo cáo xét nghiệm: KTV soạn -> Trưởng khoa duyệt -> Giám đốc ký).
- **WorkflowStep**: Các bước trong quy trình.
- **DocumentHistory**: Lưu lịch sử thay đổi trạng thái, vết ký.
- **Signature**: Lưu trữ chữ ký số/chữ ký điện tử trên văn bản.

## 3. Detailed Schema

```prisma
// SQLite không hỗ trợ Enum native, Prisma sẽ map sang String
// Nhưng trong file schema ta vẫn khai báo enum để generate code TypeScript

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// Enums
enum UserRole {
  USER
  MANAGER
  ADMIN
}

enum PermissionType {
  VIEW
  EDIT
  SIGN
  APPROVE
}

enum DocumentStatus {
  DRAFT       // Nháp
  PENDING     // Đang chờ duyệt/ký
  APPROVED    // Đã duyệt (nhưng chưa ký hết)
  SIGNED      // Đã ký hoàn tất
  REJECTED    // Bị từ chối
  ARCHIVED    // Lưu trữ
}

enum SignatureType {
  IMAGE       // Ký ảnh (vẽ hoặc upload ảnh)
  DIGITAL     // Ký số (USB Token, HSM)
  OTP         // Ký xác thực qua SMS/Email OTP
}

// 1. Tổ chức & Người dùng
model Department {
  id          Int       @id @default(autoincrement())
  name        String
  code        String    @unique // Mã khoa/phòng (KHS, KKB...)
  users       User[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model User {
  id              Int       @id @default(autoincrement())
  email           String    @unique
  password        String
  fullName        String?
  phone           String?
  role            UserRole  @default(USER)
  
  // Quan hệ tổ chức
  departmentId    Int?
  department      Department? @relation(fields: [departmentId], references: [id])
  
  // Thông tin chữ ký
  signatureImage  String?   // URL ảnh chữ ký mặc định
  digitalCert     String?   // Serial number của chứng thư số (nếu cần mapping)

  // Quan hệ văn bản
  createdDocs     Document[] @relation("CreatedDocs")
  signatures      Signature[]
  
  // Auth
  tokens          Token[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// 2. Mẫu văn bản
model Template {
  id          Int       @id @default(autoincrement())
  name        String
  content     String 
  category    String? 
  
  // Data Isolation
  departmentId Int?
  department   Department? @relation(fields: [departmentId], references: [id])
  
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// 3. Văn bản & Phân quyền
model Document {
  id          Int       @id @default(autoincrement())
  code        String?   @unique 
  title       String
  content     String 
  
  status      String @default("DRAFT")
  
  // Data Isolation
  departmentId Int
  department   Department @relation(fields: [departmentId], references: [id])
  
  // Người tạo
  creatorId   Int
  creator     User      @relation("CreatedDocs", fields: [creatorId], references: [id])
  
  // Phân quyền: Ai được làm gì với văn bản này?
  permissions DocumentPermission[]
  
  // Dữ liệu ký
  signatures  Signature[]
  history     DocumentHistory[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model DocumentPermission {
  id          Int       @id @default(autoincrement())
  
  documentId  Int
  document    Document  @relation(fields: [documentId], references: [id])
  
  userId      Int
  user        User      @relation(fields: [userId], references: [id])
  
  // Quyền: "VIEW", "EDIT", "SIGN", "APPROVE"
  permission  String    
  
  createdAt   DateTime  @default(now())
  
  @@unique([documentId, userId, permission]) // Một người có thể có nhiều quyền, nhưng không trùng lặp record
}

// 4. Chữ ký & Lịch sử
model Signature {
  id          Int       @id @default(autoincrement())
  documentId  Int
  document    Document  @relation(fields: [documentId], references: [id])
  
  signerId    Int
  signer      User      @relation(fields: [signerId], references: [id])
  
  step        Int       // Ký ở bước nào
  type        SignatureType
  signedAt    DateTime  @default(now())
  
  // Metadata cho chữ ký số
  comment     String?   // Ý kiến phê duyệt
  hash        String?   // Hash của tài liệu tại thời điểm ký
  signatureValue String? // Chuỗi ký mã hóa (nếu cần lưu để verify)
}

model DocumentHistory {
  id          Int       @id @default(autoincrement())
  documentId  Int
  document    Document  @relation(fields: [documentId], references: [id])
  
  actorId     Int?      // Người thực hiện hành động (có thể là system)
  action      String    // "CREATED", "UPDATED", "SUBMITTED", "SIGNED", "REJECTED"
  description String?
  
  createdAt   DateTime  @default(now())
}

// Giữ lại model cũ
model Token {
  id          Int       @id @default(autoincrement())
  token       String
  type        TokenType
  expires     DateTime
  blacklisted Boolean
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id])
  userId      Int
}

enum TokenType {
  ACCESS
  REFRESH
  RESET_PASSWORD
  VERIFY_EMAIL
}
```
