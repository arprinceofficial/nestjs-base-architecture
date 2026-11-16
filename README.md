# NestJS Base Architecture

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
pnpm install
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
pnpm prisma:push

# Generate Prisma Client
pnpm prisma:generate

# Seed default Super Admin user and role
pnpm prisma:seed
```

### 4. Start Development Server

```bash
pnpm start:dev
```

> **Tip**: To view verbose route mappings on startup during debugging:
>
> ```bash
> DEBUG_ROUTES=true pnpm start:dev
> ```

The API will be available at: `http://localhost:3000/api/v1/admin`  
Swagger documentation: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 🔑 Default Credentials (Development)

Once `pnpm prisma:seed` is executed, you can immediately log in with:

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **Email**    | `admin@example.com`                |
| **Password** | `Password123!`                     |
| **Role**     | Super Administrator (`role_id: 1`) |

---

## 🗄️ Database Commands Reference

| Command                | Description                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm prisma:push`     | Pushes schema changes directly to PostgreSQL without migration files                      |
| `pnpm prisma:seed`     | Seeds default Super Admin (`admin@example.com`) and default roles                         |
| `pnpm prisma:generate` | Re-generates Prisma client types                                                          |
| `pnpm prisma:studio`   | Launches interactive browser GUI on `http://localhost:5555` to view/edit database records |

---

## 📮 Postman Collection & Environment Export

Export the complete Postman collection and environment with one command:

```bash
pnpm postman:export
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

## 📧 Email Logging (`email_logs` Collection)

Every outgoing email dispatched by the application is automatically recorded in MongoDB in the **`email_logs`** collection (with fallback to `logs/mail.log` if MongoDB is disabled):

### Stored Email Log Details

- `mail_id`: Message ID generated by SMTP (or unique reference)
- `to`: Recipient email address
- `from`: Sender name and email address
- `subject`: Email subject
- `body_text` & `body_html`: Full message content
- `status`: `'success'`, `'error'`, or `'skipped'` (when `SMTP_ENABLED=false`)
- `smtp_response`: Server response codes, accepted recipients, and IDs
- `error`: Error message if sending failed
- `created_at`: Timestamp of dispatch

---

## ⚡ High-Performance Queued Mail with BullMQ & MongoDB (`queue_logs` Collection)

To guarantee sub-50ms API response times, email delivery is handled asynchronously via **BullMQ** and **Redis**. When an endpoint calls `sendOtpEmail` or `sendTemplateMail`, the email is enqueued immediately and processed in the background with automatic retries and exponential backoff.

### BullMQ Queue Lifecycle & MongoDB Logging

Every queue event across all jobs is persisted to MongoDB in the **`queue_logs`** collection (with fallback to `logs/queue.log`):

- **`waiting`**: Enqueued job with sanitized payload and attempt count.
- **`active`**: Job started processing by `MailProcessor`.
- **`completed`**: Job finished successfully with execution duration in milliseconds and result details.
- **`failed`**: Job encountered an error, recording error message, stack trace, and attempt number.
- **`stalled` / `progress`**: Worker heartbeat recovery and progress events.

### How It Works

```typescript
// 1. Asynchronous non-blocking dispatch (returns in < 30ms)
await this.mailService.sendOtpEmail('user@example.com', '123456', 'John Doe');

// 2. Synchronous direct dispatch (if ever needed to block for delivery)
await this.mailService.sendMail({
    to: 'user@example.com',
    subject: 'Urgent Notification',
    html: '<p>Content</p>',
    sync: true, // bypasses queue
});
```

---

## 🩺 Mail Server Diagnostic CLI (`pnpm mail:test-server`)

A production-ready diagnostic command that validates SMTP connectivity from your hosting server before dispatching customer notifications:

```bash
# 1. Standard diagnostic check (DNS, Outbound TCP, ESMTP, TLS certificates, and Authentication)
pnpm mail:test-server

# 2. Check configuration and send a live test message to an inbox
pnpm mail:test-server --to=user@example.com

# 3. Test .env configuration directly without checking database connectivity
pnpm mail:test-server --config-only

# 4. Custom socket timeout (1-60 seconds, default: 10)
pnpm mail:test-server --timeout=15

# 5. Run automated diagnostic unit tests
pnpm test:mail
```

### Diagnostic Stages Tested:

- **Settings Source**: Validates `.env` and database accessibility (or skips database with `--config-only`).
- **DNS Resolution**: Resolves `SMTP_HOST` against system DNS and validates reachable IPv4/IPv6 records.
- **Outbound TCP**: Opens socket to `host:port` to detect cloud firewall or provider port restrictions (ports 25, 587, 2525, 465).
- **ESMTP Capability**: Negotiates `EHLO` banner and inspects advertised server capabilities (`STARTTLS`, `AUTH`, `SIZE`, etc.).
- **TLS / SSL & Certificates**: Tests STARTTLS or direct SMTPS, validates certificate issuer, expiry date, and peer verification.
- **SMTP Authentication**: Authenticates with `SMTP_USER` and `SMTP_PASS` over encrypted channel while strictly redacting secrets from all console outputs.
- **Message Acceptance**: Optional test message submission via `--to` confirming remote server acceptance (`250 OK`).

---

## 🎨 Template Engine: Global & Feature Module Views

The application features a centralized, manageable template rendering system powered by Handlebars (`handlebars`). Templates can be defined globally or **co-located directly inside their respective feature modules**:

### Directory Structure

```text
src/
├── modules/admin/users/
│   ├── dto/
│   ├── views/
│   │   └── otp.hbs         # Feature-specific email view (e.g. Password Reset OTP)
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
└── templates/
    ├── emails/
    │   └── layout.hbs      # Shared responsive email layout (header, logo, body slot, signature, footer)
    └── reports/
        └── sample-report.hbs # Base report template for PDF generation and document exports
```

### Compiler Asset Pipeline

When compiling with `pnpm run build`, Nest CLI is configured via `nest-cli.json` to automatically copy both global templates and module views:
- `templates/**/*` -> `dist/src/templates/`
- `modules/**/views/**/*` -> `dist/src/modules/**/views/`

`TemplateService` dynamically resolves templates whether running via `ts-node` or production `dist/`.

### How to Render Templates

Inject `TemplateService` into any service:

```typescript
import { TemplateService } from '@/modules/template/template.service';

@Injectable()
export class ReportService {
    constructor(private readonly templateService: TemplateService) {}

    async generateInvoicePdf(invoice: any): Promise<string> {
        // Renders src/templates/reports/invoice.hbs
        const html = await this.templateService.renderReport('invoice', {
            invoiceNumber: invoice.number,
            items: invoice.items,
            total: invoice.total,
        });
        // Pass html to Puppeteer, Playwright, or PDF generator
        return html;
    }
}
```

### How to Send Templated Emails

Send templated emails via `MailService`:

```typescript
// 1. Send OTP email (built-in helper)
await this.mailService.sendOtpEmail('user@example.com', '123456', 'John Doe');

// 2. Send any custom templated email
await this.mailService.sendTemplateMail({
    to: 'user@example.com',
    subject: 'Welcome to Our Platform',
    template: 'welcome', // automatically loads src/templates/emails/welcome.hbs wrapped in layout.hbs
    context: {
        userName: 'John Doe',
        activationLink: 'https://example.com/activate',
    },
});
```

---

## 🏛️ Domain Architecture (Admin, CMS, Customer)

To cleanly partition routes across functional domains (e.g. `admin`, `cms`, `customer`), NestJS accomplishes this using **Modular Architecture** and **`RouterModule`** (`@nestjs/core`):

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
]);
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
pnpm prisma:push
pnpm prisma:generate
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
]);
```

### Step 4: Update Postman Collection

Run the export script to immediately sync your new endpoints into Postman:

```bash
pnpm postman:export
```

---

## 🚀 Production Build & Deployment

```bash
# 1. Sync Prisma Client & Database
pnpm prisma:generate
pnpm prisma:push

# 2. Compile to production bundle (dist/)
pnpm build

# 3. Start production server
pnpm start:prod
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
