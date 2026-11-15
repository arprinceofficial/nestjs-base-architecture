# NestJS Basement

A production-ready base backend architecture built with **NestJS**, **Prisma ORM**, and **PostgreSQL**. It provides essential foundational systems—Authentication, User Management, Role-Based Access Control (RBAC), and Dynamic Menu Trees—so developers can build business features without reinventing core infrastructure.

---

## 🎯 Main Features

- **🔐 Authentication & Security**: Complete JWT token authentication (Login, Refresh Token, Profile, Password Reset) with bcrypt password hashing and token management.
- **👥 User Management**: Unified `User` and `UserInfo` data models with transactional CRUD, soft deletes, and automatic password sanitization.
- **🛡️ Role-Based Access Control (RBAC)**: Manage roles and dynamic permissions (`view`, `add`, `edit`, `delete`) per menu item.
- **🌳 Dynamic Menu Setup (Tree Entity)**: Self-referencing hierarchical menu trees with re-ordering, cascading status updates, and role-based menu filtering.
- **📦 Uniform API Response**: Consistent `{ status, message, data }` JSON envelope with global exception handling and validation pipes.
- **🪵 MongoDB Error Tracking Logger**: Global exception filter captures all runtime and HTTP errors into MongoDB (`error_logs` collection) with unique `error_id`, stack traces, sanitized payloads, and user context.
- **📮 Auto Postman Collection**: One-click CLI command to export organized Postman collections and environments with token-storing test scripts.
- **📑 OpenAPI / Swagger**: Built-in interactive API documentation at `/api/docs`.

---

## 🚀 Quick Start for Developers

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to create `.env` in the root directory:
```bash
cp .env.example .env
```

Review or customize your `.env` settings:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/nestjs_base_dev?schema=public"

# Authentication & JWT Configuration
JWT_SECRET="nestjs-basement-secret-key-1234567890"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

# MongoDB Logger Configuration
MONGODB_URI="mongodb://localhost:27017/nestjs_basement_logs"

# SMTP Mail Configuration
SMTP_ENABLED=false
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@example.com"
SMTP_FROM_NAME="NestJS Basement"
```

### 3. Database Setup & Seeding (Prisma)
Run the following commands to create the tables in PostgreSQL and seed the default Super Administrator user and role:
```bash
# Push schema to database
npm run prisma:push

# Generate Prisma Client
npm run prisma:generate

# Seed default Super Admin user and role
npm run prisma:seed
```

### 4. Start Development Server
```bash
npm run start:dev
```

> **Tip**: To view verbose route mappings on startup during debugging:
> ```bash
> DEBUG_ROUTES=true npm run start:dev
> ```

The API will be available at: `http://localhost:3000/api/v1/admin`  
Swagger documentation: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 🔑 Default Credentials (Development)

Once `npm run prisma:seed` is executed, you can immediately log in with:

| Field | Value |
|---|---|
| **Email** | `admin@example.com` |
| **Password** | `Password123!` |
| **Role** | Super Administrator (`role_id: 1`) |

---

## 🗄️ Database Commands Reference

| Command | Description |
|---|---|
| `npm run prisma:push` | Pushes schema changes directly to PostgreSQL without migration files |
| `npm run prisma:seed` | Seeds default Super Admin (`admin@example.com`) and default roles |
| `npm run prisma:generate` | Re-generates Prisma client types |
| `npm run prisma:studio` | Launches interactive browser GUI on `http://localhost:5555` to view/edit database records |

---

## 📮 Postman Collection & Environment Export

Export the complete Postman collection and environment with one command:

```bash
npm run postman:export
```

- **Collection**: `postman/nestjs_basement.postman_collection.json`
- **Environment**: `postman/nestjs_basement.postman_environment.json`

**How it works in Postman:**
1. Import both JSON files into Postman.
2. Select the **`nestjs-basement Dev`** environment.
3. Send **`Admin > Auth > POST Login`**.
4. The response script automatically saves `{{admin-token}}` and `{{admin-reToken}}` so all other requests authenticate automatically.

---

## 🪵 Centralized Error Tracking (MongoDB & Local File Fallback)

All application errors, unhandled exceptions, and rejected requests are automatically captured by the global exception filter and persisted.

### Dual Storage Strategy (MongoDB vs. Local File)
1. **With MongoDB (`MONGODB_URI` set in `.env`)**:
   - Error logs are stored in MongoDB in the `error_logs` collection.
2. **Without MongoDB (`MONGODB_URI` omitted or empty)**:
   - The application boots without needing MongoDB.
   - Logs automatically fallback to local file storage at **`logs/errors.log`**.
   - The `logs/` directory is automatically ignored by `.gitignore` so logs are never committed to git.

### Error Response Envelope
Every failed API call returns a unique tracking `error_id`:
```json
{
  "status": false,
  "message": "Invalid credentials",
  "error_id": "ERR-5D8CEE0C"
}
```

### Stored Error Data
Each log entry in MongoDB or `logs/errors.log` includes:
- `error_id`: Unique reference code returned to the client for instant debugging
- `status_code`: HTTP status code (400, 401, 404, 500, etc.)
- `message` & `error_name`: Exception type and descriptive message
- `stack`: Complete trace stack for pinpoint debugging
- `path` & `method`: Target endpoint URL and HTTP verb
- `user_id` & `user_email`: Authenticated user identity (if available)
- `ip` & `user_agent`: Client network metadata
- `body` & `headers`: Auto-sanitized request payloads (passwords, tokens, and authorization credentials are automatically redacted)

---

## 🏛️ Domain Architecture (Admin, CMS, Customer)

Just like domain-partitioned controllers and routes in Laravel (`routes/api/admin.php`, `cms.php`, `customer.php`), NestJS accomplishes this using **Modular Architecture** and **`RouterModule`** (`@nestjs/core`):

```text
src/modules/
├── admin/       --> Routes under /api/v1/admin/*
│   ├── auth/              (Authentication, OTP, Reset Password)
│   ├── roles/             (Roles & Matrix Permissions)
│   ├── tree-entities/     (Hierarchical Menu Navigation)
│   ├── users/             (User & UserInfo Management)
│   └── admin.module.ts    (Admin aggregate module)
├── cms/         --> Routes under /api/v1/cms/*
│   ├── cms.controller.ts
│   ├── cms.service.ts
│   └── cms.module.ts
├── customer/    --> Routes under /api/v1/customer/*
│   ├── customer.controller.ts
│   ├── customer.service.ts
│   └── customer.module.ts
└── logger/      --> Global Error Logger & MongoDB tracking
```

### Centralized Routing Configuration (`src/app.module.ts`)
```typescript
RouterModule.register([
  {
    path: 'admin',
    module: AdminModule,
    children: [AuthModule, RolesModule, TreeEntitiesModule, UsersModule],
  },
  {
    path: 'cms',
    module: CmsModule,
  },
  {
    path: 'customer',
    module: CustomerModule,
  },
])
```

---

## 🛠️ How to Extend this Project (Developer Instructions)

When adding a new feature or module to this architecture:

### Step 1: Define Model in Prisma
Add your model to `prisma/schema.prisma`:
```prisma
model Product {
  id         Int       @id @default(autoincrement())
  name       String
  price      Float
  status     Int       @default(1)
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
}
```
Apply schema changes:
```bash
npm run prisma:push
npm run prisma:generate
```

### Step 2: Create Module Files in the Appropriate Domain
Choose which domain the feature belongs to:
- **Admin**: `src/modules/admin/<feature>/`
- **CMS**: `src/modules/cms/<feature>/`
- **Customer**: `src/modules/customer/<feature>/`

Create standard NestJS components:
- `dto/`: Request validation classes using `class-validator` and `@nestjs/swagger`.
- `<feature>.service.ts`: Business logic utilizing `PrismaService`.
- `<feature>.controller.ts`: Route definitions (e.g., `@Controller('products')` inside `admin` will automatically route to `/api/v1/admin/products`).
- `<feature>.module.ts`: NestJS module declaration.

### Step 3: Register in Domain & Router
Add the new module to its domain module (e.g., `AdminModule`) and the `RouterModule` children list in `src/app.module.ts`:
```typescript
RouterModule.register([
  {
    path: 'admin',
    module: AdminModule,
    children: [
      AuthModule,
      RolesModule,
      TreeEntitiesModule,
      UsersModule,
      ProductsModule, // <-- your new module
    ],
  },
  // ...
])
```
    AuthModule,
    RolesModule,
    TreeEntitiesModule,
    UsersModule,
    ProductsModule, // <-- your new module
  ],
})
export class AppModule {}
```

### Step 4: Update Postman Collection
Run the export script to immediately sync your new endpoints into Postman:
```bash
npm run postman:export
```

---

## 🚀 Production Build & Deployment

```bash
# 1. Sync Prisma Client & Database
npm run prisma:generate
npm run prisma:push

# 2. Compile to production bundle (dist/)
npm run build

# 3. Start production server
npm run start:prod
# or directly:
node dist/main.js
```

### Process Management with PM2
```bash
pm2 start dist/main.js --name "nestjs-basement"
pm2 status
pm2 logs nestjs-basement
pm2 restart nestjs-basement
```
