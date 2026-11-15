import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';

async function generatePostman() {
  console.log('🚀 Initializing NestJS application to extract routes...');
  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Base Architecture API')
    .setDescription('Postman API Collection')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const openApiDoc = SwaggerModule.createDocument(app, swaggerConfig);
  await app.close();

  console.log('📦 Converting OpenAPI endpoints to Postman Collection v2.1.0...');

  // Group endpoints by tags (folders)
  const folders: Record<string, any[]> = {};

  const schemas = openApiDoc.components?.schemas || {};

  function resolveSchemaExample(schemaRefOrObj: any): any {
    if (!schemaRefOrObj) return {};
    if (schemaRefOrObj.$ref) {
      const schemaName = schemaRefOrObj.$ref.replace('#/components/schemas/', '');
      return resolveSchemaExample(schemas[schemaName]);
    }

    if (schemaRefOrObj.example !== undefined) {
      return schemaRefOrObj.example;
    }

    if (schemaRefOrObj.properties) {
      const example: Record<string, any> = {};
      for (const [propKey, propVal] of Object.entries<any>(schemaRefOrObj.properties)) {
        if (propVal.example !== undefined) {
          example[propKey] = propVal.example;
        } else if (propVal.type === 'string') {
          example[propKey] = propVal.default || 'sample string';
        } else if (propVal.type === 'number' || propVal.type === 'integer') {
          example[propKey] = propVal.default !== undefined ? propVal.default : 1;
        } else if (propVal.type === 'boolean') {
          example[propKey] = propVal.default !== undefined ? propVal.default : true;
        } else if (propVal.type === 'array') {
          example[propKey] = [];
        } else if (propVal.$ref) {
          example[propKey] = resolveSchemaExample(propVal);
        } else {
          example[propKey] = null;
        }
      }
      return example;
    }

    return {};
  }

  // Iterate over paths and methods
  for (const [pathStr, pathItem] of Object.entries<any>(openApiDoc.paths)) {
    for (const [method, operation] of Object.entries<any>(pathItem)) {
      if (['get', 'post', 'put', 'patch', 'delete'].indexOf(method.toLowerCase()) === -1) {
        continue;
      }

      const tag = operation.tags?.[0] || 'Default';
      if (!folders[tag]) {
        folders[tag] = [];
      }

      const urlPathParts = pathStr.split('/').filter(Boolean).map((part) => {
        if (part.startsWith(':') || (part.startsWith('{') && part.endsWith('}'))) {
          const varName = part.replace(/[:{}]/g, '');
          return `:${varName}`;
        }
        return part;
      });

      // Postman path variables
      const pathVariables: any[] = [];
      const queryParams: any[] = [];

      if (operation.parameters) {
        for (const param of operation.parameters) {
          if (param.in === 'path') {
            pathVariables.push({
              key: param.name,
              value: param.example || '1',
              description: param.description || '',
            });
          } else if (param.in === 'query') {
            queryParams.push({
              key: param.name,
              value: param.example !== undefined ? String(param.example) : '',
              description: param.description || '',
              disabled: !param.required,
            });
          }
        }
      }

      // Request Body
      let requestBody: any = undefined;
      const content = operation.requestBody?.content;
      if (content && content['application/json']) {
        const schema = content['application/json'].schema;
        const bodyExample = resolveSchemaExample(schema);
        requestBody = {
          mode: 'raw',
          raw: JSON.stringify(bodyExample, null, 2),
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      }

      // Test Script for Auth / Login or token returning endpoints
      const event: any[] = [];
      const isLoginOrAuth =
        pathStr.toLowerCase().includes('login') ||
        pathStr.toLowerCase().includes('auth') ||
        operation.summary?.toLowerCase().includes('login');

      if (isLoginOrAuth) {
        event.push({
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: [
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
            ],
          },
        });
      }

      const postmanItem: any = {
        name: operation.summary || `${method.toUpperCase()} ${pathStr}`,
        event,
        request: {
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
            raw: `{{host}}${pathStr}`,
            host: ['{{host}}'],
            path: urlPathParts,
            variable: pathVariables,
            query: queryParams,
          },
          description: operation.description || operation.summary || '',
        },
        response: [],
      };

      if (requestBody) {
        postmanItem.request.body = requestBody;
      }

      folders[tag].push(postmanItem);
    }
  }

  // Construct final Postman Collection
  const collectionItems = Object.entries(folders).map(([tagName, items]) => ({
    name: tagName,
    item: items,
  }));

  const postmanCollection = {
    info: {
      _postman_id: randomUUID(),
      name: 'NestJS Base Architecture Collection',
      description: 'Auto-generated Postman API Collection for NestJS Base Architecture',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: collectionItems,
    event: [],
    variable: [],
  };

  // Construct Postman Environment
  const postmanEnvironment = {
    id: randomUUID(),
    name: 'NestJS Local Environment',
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
    _postman_exported_using: 'NestJS Postman Generator',
  };

  const outputDir = path.join(__dirname, '..', 'postman');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const collectionPath = path.join(outputDir, 'nestjs_api.postman_collection.json');
  const envPath = path.join(outputDir, 'nestjs_local.postman_environment.json');

  fs.writeFileSync(collectionPath, JSON.stringify(postmanCollection, null, 2));
  fs.writeFileSync(envPath, JSON.stringify(postmanEnvironment, null, 2));

  console.log(`✅ Postman Collection exported to: ${collectionPath}`);
  console.log(`✅ Postman Environment exported to:  ${envPath}`);
  console.log('🎉 Done! Import both JSON files into Postman to test immediately.');
}

generatePostman().catch((err) => {
  console.error('❌ Error generating Postman collection:', err);
  process.exit(1);
});
