# Common Errors & Development Notes

This document serves as a log of common issues, errors, and lessons learned during the development of the DMS project.

## 1. Database & Prisma (SQLite)

### **Error: `Foreign key constraint failed` during `prisma db push`**
*   **Context**: Occurs when removing tables or changing relations (e.g., removing `Token` table, changing `User` relations) in SQLite.
*   **Cause**: SQLite has limited support for destructive schema changes compared to PostgreSQL/MySQL. Prisma often cannot migrate existing data safely.
*   **Solution**:
    1.  **Force Reset**: Use `npx prisma db push --force-reset` to wipe and recreate the database. **Warning**: This deletes all data.
    2.  **Re-seed**: Immediately run `npx prisma db seed` to repopulate initial data.
    3.  **Delete DB File**: If stuck, delete `server/prisma/dev.db` manually and run `db push` again.

### **Error: `Foreign key constraint failed` during Deletion (Runtime)**
*   **Context**: Trying to delete a parent record (e.g., `Department`) that still has children (e.g., `User`, `Document`).
*   **Best Practice**:
    *   **Schema Level**: Use `onDelete: Cascade` in `schema.prisma` if you want children to disappear automatically (e.g., `DocumentPermission` should vanish if `Document` is deleted).
    *   **Service Level**: For critical entities (like Departments), **check manually** before deletion.
        ```typescript
        // In department.service.ts
        const userCount = await prisma.user.count({ where: { departmentId: id } });
        if (userCount > 0) throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete...");
        ```

## 2. Backend (Node.js/Express)

### **Error: `TypeError: Cannot convert undefined or null to object` (req.body undefined)**
*   **Context**: Accessing `req.body` in a middleware (like a logger) results in error.
*   **Cause**: The middleware was placed **before** `express.json()` or `express.urlencoded()`.
*   **Solution**: Ensure body parsing middleware comes **first** in `app.ts`.
    ```typescript
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // ... then your logger ...
    app.use(requestLogger);
    ```

### **Error: `EADDRINUSE: address already in use :::3000`**
*   **Context**: Server fails to start because port 3000 is taken.
*   **Cause**: A previous `nodemon` process didn't exit cleanly, or another terminal is running the server.
*   **Solution**:
    *   **Powershell**: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force`
    *   **CMD**: `netstat -ano | findstr :3000` -> `taskkill /PID <PID> /F`

## 3. Frontend (React/AntD)

### **Error Handling & UX**
*   **Issue**: User sees generic "Error" toast instead of specific reason (e.g., "Username taken").
*   **Solution**: Always extract the message from the Axios response object.
    ```typescript
    try {
      await apiCall();
    } catch (error: any) {
      // Prioritize backend message
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
    ```

### **Role-Based Access Control (RBAC)**
*   **Context**: Hiding UI elements based on Role (e.g., only Admin sees "Department Management").
*   **Implementation**:
    *   **Menu**: Conditional rendering in `MainLayout.tsx`.
    *   **Forms**: Disable inputs or hide generic options (like preventing Manager from creating Admins) in `SettingsPages.tsx`.
    *   **API**: Always enforce `auth('manageUsers')` or check `req.user.role` in Controller/Service as the final barrier.

## 4. General Workflow
## 5. Development Rules (Strict)

### **1. Audit Fields**
*   **Rule**: Every table MUST have `createdBy` and `updatedBy` fields.
*   **Action**:
    *   **Schema**: Add `createdBy String?` and `updatedBy String?`.
    *   **Controller**: Always inject `req.user.username` into these fields during Create/Update.
    *   **Frontend**: Display "Updated By" (`Người cập nhật`) instead of timestamps.

### **2. Data Isolation (Department)**
*   **Rule**: Non-Admin users must ONLY see data belonging to their Department.
*   **Action**:
    *   **Service**: In `query` functions, check user role.
    *   **Logic**:
        ```typescript
        const filter: any = {};
        if (user.role !== 'ADMIN') {
            filter.departmentId = user.departmentId;
        }
        ```
    *   **Note**: Admin sees all.

