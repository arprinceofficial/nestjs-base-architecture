# NestJS Base Architecture API

A scalable enterprise NestJS backend with **Prisma ORM** and **PostgreSQL**, engineered with the business logic migrated from the Laravel `accesimate-api` codebase.

---

## 📌 Architecture & Modules

### 1. **User Module** (`/users`)
- **Entities**: `User` & `UserInfo`
- **Features**:
  - Full CRUD operations with atomic database transactions.
  - Password hashing via `bcryptjs` with auto-hiding of passwords from API responses.
  - Auto-generated UUID `uid`.
  - Filterable by `search` (email, mobile, name), `role` (`user_type`), `status`, and `trashed`.
  - Pagination support (`paginate=true`, `page`, `length`).
  - Soft delete and restore support (`POST /users/restore/:id`).

### 2. **Role & Role Permissions Module** (`/roles`, `/role-permissions`)
- **Entities**: `Role` & `RolePermission`
- **Features**:
  - Full Role CRUD with soft deletes and restore.
  - Role Permissions Matrix (`GET/POST /role-permissions/show/:id`): Dynamically links the full tree hierarchy of permissions (`view`, `add`, `edit`, `delete`) for each menu item with `haschild` calculations.
  - Permission updates (`POST /role-permissions/permission-update/:id`): Transactional delete-and-bulk-insert of role permissions.

### 3. **Menu Setup Module (Tree Entities)** (`/tree-entity`)
- **Entities**: `TreeEntity` (self-referencing parent/child hierarchy)
- **Features**:
  - **`GET /tree-entity/build-menu`**: Builds complete nested tree structure for admin navigation.
  - **`POST /tree-entity/main-menu`**: Generates user-specific navigation menu filtered by the authenticated user's role permissions.
  - **`POST /tree-entity/update-menu`**: Recursive parser that flattens nested menus to reorder serials and re-parent (`pid`).
  - **`POST /tree-entity/delete-menu`**: Cascading recursive deactivation of a menu node and all its child descendants.
  - Standard RESTful CRUD with soft deletes and restore.

---

## 🚀 Getting Started

### 1. Environment Setup
Configure your database in `.env`:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:Root%401234@localhost:5432/nestjs_base_dev?schema=public"
```

### 2. Prisma Database Migration
```bash
npm run prisma:push
npm run prisma:generate
```

### 3. Run Development Server
```bash
npm run start:dev
```

To display verbose route mappings on startup during debugging:
```bash
DEBUG_ROUTES=true npm run start:dev
```

The application runs on: `http://localhost:3000`

---

## 📖 Swagger Interactive Documentation
Once started, explore and test all APIs interactively via Swagger UI:
- **Swagger URL**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 📮 Postman Collection & Environment Export

To generate the Postman Collection and Environment files automatically for all registered APIs:

```bash
npm run postman:export
```

### What this command generates:
1. **`postman/nestjs_api.postman_collection.json`**:
   - Organizes endpoints into folders (`Users`, `Roles`, `Role Permissions`, `Menu Setup (Tree Entity)`).
   - Pre-configures `Bearer {{admin-token}}` for all requests.
   - Includes sample request payloads and parameter definitions.
   - Automatically attaches a Post-response script to any Auth/Login endpoints to capture and store the token:
     ```javascript
     const responseJson = pm.response.json();
     if (responseJson && responseJson.data) {
         var token = responseJson.data.token || responseJson.data.access_token;
         var refresh_token = responseJson.data.refresh_token;
         if (token) {
             pm.environment.set("admin-token", token);
         }
         if (refresh_token) {
             pm.environment.set("admin-reToken", refresh_token);
         }
     }
     ```
2. **`postman/nestjs_local.postman_environment.json`**:
   - Pre-configured variables: `host` (`http://localhost:3000`), `base_url`, `admin-token`, and `admin-reToken`.

Both files are automatically ignored in `.gitignore` to keep your repository clean.

---