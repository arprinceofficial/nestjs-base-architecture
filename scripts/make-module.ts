import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI Module Generator for NestJS Base Architecture.
 *
 * Usage:
 *   pnpm make:module admin/products
 *   pnpm make:module customer/orders
 *   pnpm make:module blogs
 */

function toPascalCase(str: string): string {
    return str
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/^-/, '');
}

function toCamelCase(str: string): string {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function run() {
    const targetArg = process.argv[2];

    if (!targetArg) {
        console.error('❌ Please specify a module path.');
        console.error('   Example: pnpm make:module admin/products');
        console.error('   Example: pnpm make:module customer/orders');
        console.error('   Example: pnpm make:module payments');
        process.exit(1);
    }

    const segments = targetArg.split('/').filter(Boolean);
    const rawModuleName = segments[segments.length - 1];
    const moduleName = toKebabCase(rawModuleName);
    const pascalName = toPascalCase(rawModuleName);
    const camelName = toCamelCase(rawModuleName);

    const relativeFolder =
        segments.length > 1
            ? path.join('src', 'modules', ...segments.slice(0, -1), moduleName)
            : path.join('src', 'modules', moduleName);

    const targetDir = path.resolve(process.cwd(), relativeFolder);

    if (fs.existsSync(targetDir)) {
        console.error(`❌ Module directory already exists: ${relativeFolder}`);
        process.exit(1);
    }

    // Create directories: dto, models, views
    const dtoDir = path.join(targetDir, 'dto');
    const modelsDir = path.join(targetDir, 'models');
    const viewsDir = path.join(targetDir, 'views');

    fs.mkdirSync(dtoDir, { recursive: true });
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(viewsDir, { recursive: true });

    // 1. Model (<name>.model.ts)
    const modelContent = `import { BaseModel } from '@/common/models/base.model';

/**
 * ${pascalName} Model.
 *
 * Encapsulates model-level behavior and hidden fields for the ${pascalName} domain.
 * Any field added to \`hidden\` will be automatically stripped from API responses.
 */
export class ${pascalName}Model extends BaseModel {
    static override readonly hidden = [] as const;
}

export const sanitize${pascalName} = (item: any) =>
    ${pascalName}Model.sanitize(item);
export const sanitize${pascalName}List = (items: any[]) =>
    ${pascalName}Model.sanitizeMany(items);
`;
    fs.writeFileSync(
        path.join(modelsDir, `${moduleName}.model.ts`),
        modelContent,
        'utf8',
    );

    // 2. DTOs
    const createDtoContent = `import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class Create${pascalName}Dto {
    @ApiProperty({ example: 'Sample Name' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'Sample Description', required: false })
    @IsString()
    @IsOptional()
    description?: string;
}
`;
    fs.writeFileSync(
        path.join(dtoDir, `create-${moduleName}.dto.ts`),
        createDtoContent,
        'utf8',
    );

    const updateDtoContent = `import { PartialType } from '@nestjs/swagger';
import { Create${pascalName}Dto } from './create-${moduleName}.dto';

export class Update${pascalName}Dto extends PartialType(Create${pascalName}Dto) {}
`;
    fs.writeFileSync(
        path.join(dtoDir, `update-${moduleName}.dto.ts`),
        updateDtoContent,
        'utf8',
    );

    const filterDtoContent = `import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class Filter${pascalName}Dto extends PaginationQueryDto {}
`;
    fs.writeFileSync(
        path.join(dtoDir, `filter-${moduleName}.dto.ts`),
        filterDtoContent,
        'utf8',
    );

    // 3. Service
    const serviceContent = `import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Create${pascalName}Dto } from './dto/create-${moduleName}.dto';
import { Update${pascalName}Dto } from './dto/update-${moduleName}.dto';
import { Filter${pascalName}Dto } from './dto/filter-${moduleName}.dto';
import { ${pascalName}Model } from './models/${moduleName}.model';
import { ApiResponse } from '@/common/interfaces/api-response.interface';
import { ApiMessages } from '@/common/constants/api-messages.constant';

@Injectable()
export class ${pascalName}Service {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(query: Filter${pascalName}Dto): Promise<ApiResponse> {
        return {
            status: true,
            message: ApiMessages.GETALL,
            data: ${pascalName}Model.sanitizeMany([]),
        };
    }

    async findOne(id: number): Promise<ApiResponse> {
        return {
            status: true,
            message: ApiMessages.SHOW,
            data: ${pascalName}Model.sanitize({ id }),
        };
    }

    async create(dto: Create${pascalName}Dto): Promise<ApiResponse> {
        return {
            status: true,
            message: ApiMessages.STORE,
            data: ${pascalName}Model.sanitize(dto),
        };
    }

    async update(id: number, dto: Update${pascalName}Dto): Promise<ApiResponse> {
        return {
            status: true,
            message: ApiMessages.UPDATE,
            data: ${pascalName}Model.sanitize({ id, ...dto }),
        };
    }

    async remove(id: number): Promise<ApiResponse> {
        return {
            status: true,
            message: ApiMessages.DESTROY,
            data: null,
        };
    }
}
`;
    fs.writeFileSync(
        path.join(targetDir, `${moduleName}.service.ts`),
        serviceContent,
        'utf8',
    );

    // 4. Controller
    const controllerContent = `import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ${pascalName}Service } from './${moduleName}.service';
import { Create${pascalName}Dto } from './dto/create-${moduleName}.dto';
import { Update${pascalName}Dto } from './dto/update-${moduleName}.dto';
import { Filter${pascalName}Dto } from './dto/filter-${moduleName}.dto';

@ApiTags('${pascalName}')
@ApiBearerAuth()
@Controller('${moduleName}')
export class ${pascalName}Controller {
    constructor(private readonly ${camelName}Service: ${pascalName}Service) {}

    @Get()
    @ApiOperation({ summary: 'List all ${moduleName}' })
    findAll(@Query() query: Filter${pascalName}Dto) {
        return this.${camelName}Service.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get ${moduleName} by ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.${camelName}Service.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create new ${moduleName}' })
    create(@Body() dto: Create${pascalName}Dto) {
        return this.${camelName}Service.create(dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update ${moduleName}' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Update${pascalName}Dto,
    ) {
        return this.${camelName}Service.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete ${moduleName}' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.${camelName}Service.remove(id);
    }
}
`;
    fs.writeFileSync(
        path.join(targetDir, `${moduleName}.controller.ts`),
        controllerContent,
        'utf8',
    );

    // 5. Module
    const moduleContent = `import { Module } from '@nestjs/common';
import { ${pascalName}Controller } from './${moduleName}.controller';
import { ${pascalName}Service } from './${moduleName}.service';

@Module({
    controllers: [${pascalName}Controller],
    providers: [${pascalName}Service],
    exports: [${pascalName}Service],
})
export class ${pascalName}Module {}
`;
    fs.writeFileSync(
        path.join(targetDir, `${moduleName}.module.ts`),
        moduleContent,
        'utf8',
    );

    // 6. View sample (.hbs)
    const viewContent = `<div style="text-align: center; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #111827;">${pascalName} Notification</h1>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">{{message}}</p>
</div>
`;
    fs.writeFileSync(
        path.join(viewsDir, `${moduleName}-notification.hbs`),
        viewContent,
        'utf8',
    );

    console.log(`\n✅ Module created successfully in: ${relativeFolder}\n`);
    console.log(`   📁 ${relativeFolder}/`);
    console.log(`   ├── dto/`);
    console.log(`   │   ├── create-${moduleName}.dto.ts`);
    console.log(`   │   ├── update-${moduleName}.dto.ts`);
    console.log(`   │   └── filter-${moduleName}.dto.ts`);
    console.log(`   ├── models/`);
    console.log(`   │   └── ${moduleName}.model.ts  <-- (Has hidden = [] & sanitization)`);
    console.log(`   ├── views/`);
    console.log(`   │   └── ${moduleName}-notification.hbs`);
    console.log(`   ├── ${moduleName}.controller.ts`);
    console.log(`   ├── ${moduleName}.service.ts`);
    console.log(`   └── ${moduleName}.module.ts`);
    console.log(`\n👉 Next Step: Import ${pascalName}Module into its parent module (e.g. admin.module.ts or app.module.ts).\n`);
}

run();
