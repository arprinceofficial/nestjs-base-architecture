import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const appName = process.env.APP_NAME || 'NestJS Application';

function createPostmanRequest(
    name: string,
    method: string,
    urlPath: string,
    bodyObj?: any,
    testScript?: string[],
    pathVariables: { key: string; value: string; description?: string }[] = [],
    queryParams: {
        key: string;
        value: string;
        description?: string;
        disabled?: boolean;
    }[] = [],
) {
    const pathParts = urlPath
        .replace(/^\//, '')
        .split('/')
        .filter(Boolean)
        .map((p) => (p.startsWith(':') ? p : p));

    const events: any[] = [];
    if (testScript && testScript.length > 0) {
        events.push({
            listen: 'test',
            script: {
                type: 'text/javascript',
                exec: testScript,
            },
        });
    }

    const req: any = {
        auth: {
            type: 'bearer',
            bearer: [
                {
                    key: 'token',
                    value: '{{admin-token}}',
                    type: 'string',
                },
            ],
        },
        method: method.toUpperCase(),
        header: [
            {
                key: 'Content-Type',
                value: 'application/json',
                type: 'text',
            },
            {
                key: 'Accept',
                value: 'application/json',
                type: 'text',
            },
        ],
        url: {
            raw: `{{host}}/${urlPath.replace(/^\//, '')}`,
            host: ['{{host}}'],
            path: pathParts,
            variable: pathVariables,
            query: queryParams,
        },
    };

    if (bodyObj && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        req.body = {
            mode: 'raw',
            raw: JSON.stringify(bodyObj, null, 2),
            options: {
                raw: {
                    language: 'json',
                },
            },
        };
    }

    return {
        name,
        event: events,
        request: req,
        response: [],
    };
}

async function generatePostmanCollection() {
    console.log(
        `🚀 Generating Postman Collection matching the ${appName} Admin hierarchy...`,
    );

    const loginTestScript = [
        'const responseJson = pm.response.json();',
        'if (responseJson && responseJson.data) {',
        '    var token = responseJson.data.token || responseJson.data.access_token;',
        '    var refresh_token = responseJson.data.refresh_token;',
        '    if (token) {',
        '        pm.environment.set("admin-token", token);',
        '    }',
        '    if (refresh_token) {',
        '        pm.environment.set("admin-reToken", refresh_token);',
        '    }',
        '}',
    ];

    const logoutTestScript = [
        'pm.environment.unset("admin-token");',
        'pm.environment.unset("admin-reToken");',
    ];

    // 1. Auth Folder
    const authItems = [
        createPostmanRequest(
            'POST Login',
            'POST',
            'api/v1/admin/login',
            {
                login_id: 'admin@example.com',
                password: 'Password123!',
            },
            loginTestScript,
        ),
        createPostmanRequest('POST Get auth info', 'POST', 'api/v1/admin/user'),
        createPostmanRequest(
            'POST Refresh Token',
            'POST',
            'api/v1/admin/refresh-token',
            {
                refresh_token: '{{admin-reToken}}',
            },
        ),
        createPostmanRequest(
            'POST Logout',
            'POST',
            'api/v1/admin/logout',
            undefined,
            logoutTestScript,
        ),
        createPostmanRequest(
            'POST Forgot Password',
            'POST',
            'api/v1/admin/forgot-password',
            {
                email: 'admin@example.com',
            },
        ),
        createPostmanRequest(
            'POST Otp Verify',
            'POST',
            'api/v1/admin/otp-verify',
            {
                email: 'admin@example.com',
                otp: '123456',
            },
        ),
        createPostmanRequest(
            'POST Otp Resend',
            'POST',
            'api/v1/admin/otp-resend',
            {
                email: 'admin@example.com',
            },
        ),
        createPostmanRequest(
            'POST Set password',
            'POST',
            'api/v1/admin/set-password',
            {
                email: 'admin@example.com',
                token: '123456',
                password: 'NewPassword123!',
            },
        ),
    ];

    // 2. Menu Folder (Tree Entity)
    const menuItems = [
        createPostmanRequest(
            'GET Tree Entity',
            'GET',
            'api/v1/admin/tree-entity',
            undefined,
            undefined,
            [],
            [
                { key: 'paginate', value: 'true', disabled: true },
                { key: 'page', value: '1', disabled: true },
                { key: 'length', value: '15', disabled: true },
                { key: 'search', value: '', disabled: true },
            ],
        ),
        createPostmanRequest(
            'GET Tree Entity (tree_entity)',
            'GET',
            'api/v1/admin/tree-entity/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '3', description: 'Tree Entity ID' }],
        ),
        createPostmanRequest(
            'GET Tree Entity (build-menu)',
            'GET',
            'api/v1/admin/tree-entity/build-menu',
        ),
        createPostmanRequest('POST Store', 'POST', 'api/v1/admin/tree-entity', {
            pid: 0,
            node_name: 'Content Management',
            route_name: '/admin/content',
            route_location: 'admin-content',
            icon: 'file-text',
            status: 1,
            serials: 2,
        }),
        createPostmanRequest(
            'PUT Update',
            'PUT',
            'api/v1/admin/tree-entity/:id',
            {
                node_name: 'Updated Content Management',
                icon: 'folder',
                status: 1,
            },
            undefined,
            [{ key: 'id', value: '3', description: 'Tree Entity ID' }],
        ),
        createPostmanRequest(
            'POST Tree Entity (update-menu)',
            'POST',
            'api/v1/admin/tree-entity/update-menu',
            [
                {
                    id: 3,
                    menus: [{ id: 5 }],
                },
            ],
        ),
        createPostmanRequest(
            'POST Tree Entity (delete-menu)',
            'POST',
            'api/v1/admin/tree-entity/delete-menu',
            {
                id: 3,
                status: 0,
            },
        ),
        createPostmanRequest(
            'DEL Tree Entity (tree_entity)',
            'DELETE',
            'api/v1/admin/tree-entity/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '3', description: 'Tree Entity ID' }],
        ),
        createPostmanRequest(
            'POST Tree Entity (Restore delete menu)',
            'POST',
            'api/v1/admin/tree-entity/delete-menu',
            {
                id: 3,
                status: 1,
            },
        ),
        createPostmanRequest(
            'POST Tree Entity (restore id)',
            'POST',
            'api/v1/admin/tree-entity/restore/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '3', description: 'Tree Entity ID' }],
        ),
        createPostmanRequest(
            'POST Menu',
            'POST',
            'api/v1/admin/tree-entity/main-menu',
            {
                role_id: 1,
            },
        ),
    ];

    // 3. Role Folder
    const roleItems = [
        createPostmanRequest(
            'GET Roles',
            'GET',
            'api/v1/admin/roles',
            undefined,
            undefined,
            [],
            [
                { key: 'paginate', value: 'true', disabled: true },
                { key: 'page', value: '1', disabled: true },
                { key: 'length', value: '15', disabled: true },
                { key: 'search', value: '', disabled: true },
            ],
        ),
        createPostmanRequest(
            'POST Roles (all)',
            'POST',
            'api/v1/admin/roles/all',
            {
                paginate: true,
                page: 1,
                length: 15,
                search: '',
            },
        ),
        createPostmanRequest('POST Store', 'POST', 'api/v1/admin/roles', {
            role_name: 'Manager',
            status: 1,
        }),
        createPostmanRequest(
            'GET Show',
            'GET',
            'api/v1/admin/roles/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
        createPostmanRequest(
            'PUT Update',
            'PUT',
            'api/v1/admin/roles/:id',
            {
                role_name: 'Executive Manager',
                status: 1,
            },
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
        createPostmanRequest(
            'DEL Destroy',
            'DELETE',
            'api/v1/admin/roles/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
        createPostmanRequest(
            'POST Restore',
            'POST',
            'api/v1/admin/roles/restore/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
    ];

    // 4. Role Permissions Folder
    const rolePermissionItems = [
        createPostmanRequest(
            'GET Show',
            'GET',
            'api/v1/admin/role-permissions/show/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
        createPostmanRequest(
            'POST Show (post)',
            'POST',
            'api/v1/admin/role-permissions/show/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
        createPostmanRequest(
            'POST Permission Update',
            'POST',
            'api/v1/admin/role-permissions/permission-update/:id',
            {
                permissions: [
                    { viewP: 3, addP: 3, editP: 3, deleteP: 3 },
                    { viewP: 5, addP: 5, editP: 5, deleteP: 5 },
                ],
            },
            undefined,
            [{ key: 'id', value: '1', description: 'Role ID' }],
        ),
    ];

    // 5. Users Folder
    const userItems = [
        createPostmanRequest(
            'GET Users',
            'GET',
            'api/v1/admin/users',
            undefined,
            undefined,
            [],
            [
                { key: 'paginate', value: 'true', disabled: true },
                { key: 'page', value: '1', disabled: true },
                { key: 'length', value: '15', disabled: true },
                { key: 'search', value: '', disabled: true },
                { key: 'role', value: '1', disabled: true },
            ],
        ),
        createPostmanRequest(
            'POST Users (all)',
            'POST',
            'api/v1/admin/users/all',
            {
                paginate: true,
                page: 1,
                length: 15,
                search: '',
            },
        ),
        createPostmanRequest('POST Store', 'POST', 'api/v1/admin/users', {
            mobile: '+8801722222222',
            ccode: '+880',
            email: 'staff@example.com',
            password: 'Password123!',
            user_type: 1,
            first_name: 'John',
            last_name: 'Doe',
            dob: '1998-01-01',
            gender: 1,
            occupation: 'Admin Assistant',
            pre_city: 'Dhaka',
            pre_country: 1,
        }),
        createPostmanRequest(
            'GET Show',
            'GET',
            'api/v1/admin/users/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'User ID' }],
        ),
        createPostmanRequest(
            'PUT Update',
            'PUT',
            'api/v1/admin/users/:id',
            {
                first_name: 'Jonathan',
                occupation: 'Senior Staff',
            },
            undefined,
            [{ key: 'id', value: '1', description: 'User ID' }],
        ),
        createPostmanRequest(
            'DEL Destroy',
            'DELETE',
            'api/v1/admin/users/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'User ID' }],
        ),
        createPostmanRequest(
            'POST Restore',
            'POST',
            'api/v1/admin/users/restore/:id',
            undefined,
            undefined,
            [{ key: 'id', value: '1', description: 'User ID' }],
        ),
    ];

    // Build the complete Admin, CMS, and Customer hierarchy tree
    const adminFolder = {
        name: 'Admin',
        item: [
            {
                name: 'Auth',
                item: authItems,
            },
            {
                name: 'Menu',
                item: menuItems,
            },
            {
                name: 'Role',
                item: roleItems,
            },
            {
                name: 'Role Permissions',
                item: rolePermissionItems,
            },
            {
                name: 'Users',
                item: userItems,
            },
        ],
    };

    const cmsFolder = {
        name: 'CMS',
        item: [createPostmanRequest('GET Status', 'GET', 'api/v1/cms/status')],
    };

    const customerFolder = {
        name: 'Customer',
        item: [
            createPostmanRequest('GET Status', 'GET', 'api/v1/customer/status'),
        ],
    };

    const postmanCollection = {
        info: {
            _postman_id: randomUUID(),
            name: `${appName} API`,
            description: `${appName} API Collection partitioned into Admin, CMS, and Customer`,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [adminFolder, cmsFolder, customerFolder],
        event: [],
        variable: [],
    };

    // Environment file
    const postmanEnvironment = {
        id: randomUUID(),
        name: `${appName} Dev`,
        values: [
            {
                key: 'host',
                value: 'http://localhost:3000',
                type: 'default',
                enabled: true,
            },
            {
                key: 'base_url',
                value: 'http://localhost:3000',
                type: 'default',
                enabled: true,
            },
            {
                key: 'admin-token',
                value: '',
                type: 'secret',
                enabled: true,
            },
            {
                key: 'admin-reToken',
                value: '',
                type: 'secret',
                enabled: true,
            },
        ],
        _postman_variable_scope: 'environment',
        _postman_exported_at: new Date().toISOString(),
        _postman_exported_using: `${appName} Postman Generator`,
    };

    const outputDir = path.join(__dirname, '..', 'postman');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const collectionPath = path.join(
        outputDir,
        'api_collection.postman_collection.json',
    );
    const envPath = path.join(
        outputDir,
        'api_environment.postman_environment.json',
    );

    // Also write backwards-compatible files if older references exist
    fs.writeFileSync(
        collectionPath,
        JSON.stringify(postmanCollection, null, 2),
    );
    fs.writeFileSync(envPath, JSON.stringify(postmanEnvironment, null, 2));

    const legacyCollection = path.join(
        outputDir,
        'nestjs_basement.postman_collection.json',
    );
    const legacyEnv = path.join(
        outputDir,
        'nestjs_basement.postman_environment.json',
    );
    fs.writeFileSync(
        legacyCollection,
        JSON.stringify(postmanCollection, null, 2),
    );
    fs.writeFileSync(legacyEnv, JSON.stringify(postmanEnvironment, null, 2));

    console.log(`✅ Collection exported to: ${collectionPath}`);
    console.log(`✅ Environment exported to: ${envPath}`);
    console.log(`🎉 Successfully generated ${appName} collection structure!`);
}

generatePostmanCollection().catch((err) => {
    console.error('❌ Error generating Postman collection:', err);
    process.exit(1);
});
