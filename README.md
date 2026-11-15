# NestJS Basement

A production-ready base backend architecture built with **NestJS**, **Prisma ORM**, and **PostgreSQL**. It provides essential foundational systems—Authentication, User Management, Role-Based Access Control (RBAC), and Dynamic Menu Trees—so developers can build business features without reinventing core infrastructure.

---

## 🎯 Main Features

- **🔐 Authentication & Security**: Complete JWT token authentication (Login, Refresh Token, Profile, Password Reset) with bcrypt password hashing and token management.
- **👥 User Management**: Unified `User` and `UserInfo` data models with transactional CRUD, soft deletes, and automatic password sanitization.
- **🛡️ Role-Based Access Control (RBAC)**: Manage roles and dynamic permissions (`view`, `add`, `edit`, `delete`) per menu item.
- **🌳 Dynamic Menu Setup (Tree Entity)**: Self-referencing hierarchical menu trees with re-ordering, cascading status updates, and role-based menu filtering.
- **📦 Uniform API Response**: Consistent `{ status, message, data }` JSON envelope with global exception handling and validation pipes.
- **📮 Auto Postman Collection**: One-click CLI command to export organized Postman collections and environments with token-storing test scripts.
- **📑 OpenAPI / Swagger**: Built-in interactive API documentation at `/api/docs`.

---

## 🚀 Quick Start for Developers

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create or edit `.env` in the root directory:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/nestjs_base_dev?schema=public"

# Optional: Set to true to bypass authentication during local development
DISABLE_AUTH=false
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

The API will be available at: `http://localhost:3000/api/admin`  
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

> **Testing without login**: Set `DISABLE_AUTH=true` in `.env` to test endpoints without passing an authorization token.

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

### Step 2: Create Module Files
Create your module under `src/modules/<feature-name>/`:
- `dto/`: Request validation classes using `class-validator` and `@nestjs/swagger`.
- `<feature>.service.ts`: Business logic utilizing `PrismaService`.
- `<feature>.controller.ts`: Route definitions with `@Controller('feature-name')`.
- `<feature>.module.ts`: NestJS module declaration.

### Step 3: Register in App Module
Import your new module in `src/app.module.ts`:
```typescript
@Module({
  imports: [
    PrismaModule,
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
