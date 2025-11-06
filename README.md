# 📦 @ashotsiroyan/file-manager

A **modular file management system for NestJS** supporting **Local**, **AWS S3**, and **Google Cloud Storage (GCS)** backends.  
It provides a unified API for uploading, downloading, listing, deleting, and signing files — all with a clean, injectable design.

---

## 🚀 Features

- ⚙️ **Plug-and-play NestJS module**
- 📁 **Supports multiple storage engines:** Local, S3, GCS
- 🚀 **Streaming uploads/downloads** (no buffering)
- 🔐 **Signed URL generation** for direct-to-cloud uploads
- 🧩 **Optional REST controller** (`/files`) for quick integration
- 🧠 **Extensible interface (`StorageEngine`)** for custom backends
- 🔒 **Security-first design** — control access and serve privately

---

## 📥 Installation

```bash
# Base package
npm install --save @ashotsiroyan/file-manager

# Optional: install for S3
npm install --save @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Optional: install for Google Cloud Storage
npm install --save @google-cloud/storage
```

---

## 🧱 Quick Start (Local Storage)

**app.module.ts**
```ts
import { Module } from '@nestjs/common';
import {
  FileManagerModule,
  LocalStorageEngine,
  FileManagerController,
} from '@ashotsiroyan/file-manager';

@Module({
  imports: [
    FileManagerModule.forRoot({
      engine: new LocalStorageEngine({
        baseDir: './uploads',
        publicBaseUrl: 'http://localhost:3000/static',
      }),
      defaultPrefix: 'uploads',
      publicReadByDefault: true,
    }),
  ],
  controllers: [FileManagerController], // optional
})
export class AppModule {}
```

`forRoot` receives a single configuration object:
- `engine` (required): any `StorageEngine`
- `defaultPrefix` / `publicReadByDefault` (optional service defaults)
- `global` (optional): register the module globally across your app

**main.ts**
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/static' });
  await app.listen(3000);
  console.log('🚀 Running at http://localhost:3000');
}
bootstrap();
```

---

## 🧩 REST Endpoints (optional)

If you include `FileManagerController`, these endpoints are available:

| Method  | Endpoint           | Description                        |
|----------|--------------------|------------------------------------|
| `POST`   | `/files`           | Upload file (multipart/form-data)  |
| `GET`    | `/files`           | List files (with prefix/filter)    |
| `GET`    | `/files/:key(*)`   | Stream file from backend           |
| `DELETE` | `/files/:key(*)`   | Delete a file                      |

### Example Upload
```bash
curl -F "file=@photo.jpg" http://localhost:3000/files
```

Response:
```json
{
  "key": "uploads/photo-abc123.jpg",
  "url": "http://localhost:3000/static/uploads/photo-abc123.jpg",
  "size": 28499,
  "contentType": "image/jpeg"
}
```

---

## 🧠 Using the Service

```ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from 'stream';
import { Response } from 'express';
import { FileManagerService } from '@ashotsiroyan/file-manager';

@Controller('avatars')
export class AvatarController {
  constructor(private readonly files: FileManagerService) {}
  
  /**
   * Upload an avatar
   * Works for both memoryStorage (buffer) and diskStorage (stream/path)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const stream =
      file.stream ??
      Readable.from(file.buffer ?? Buffer.alloc(0));
    
    const res = await this.files.put({
      prefix: 'avatars',
      originalName: file.originalname,
      contentType: file.mimetype,
      body: stream,
    });
    
    return { key: res.key, url: this.files.publicUrl(res.key) };
  }
  
  /**
   * Get (download) an avatar
   */
  @Get(':key(*)')
  async get(@Param('key') key: string, @Res() res: Response) {
    const file = await this.files.get(`avatars/${ key }`);
    
    if (file.contentType) res.setHeader('Content-Type', file.contentType);
    if (file.size) res.setHeader('Content-Length', String(file.size));
    
    file.stream.pipe(res);
  }
  
  /**
   * Remove (delete) an avatar
   */
  @Delete(':key(*)')
  async remove(@Param('key') key: string) {
    await this.files.delete(`avatars/${ key }`);
    return { success: true, deleted: key };
  }
  
  /**
   * List all avatars (optionally filter by prefix)
   */
  @Get()
  async list(@Query('prefix') prefix = 'avatars/') {
    const files = await this.files.list(prefix);
    return { prefix, files };
  }
}
```

✅ Tip:
> For large files, use diskStorage() and fs.createReadStream(file.path) instead of buffers.

> For small files, memoryStorage() + Readable.from(file.buffer) is fastest.

---

## ☁️ Using AWS S3 (`forRootAsync`)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileManagerModule, S3StorageEngine } from '@ashotsiroyan/file-manager';

@Module({
  imports: [
    FileManagerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        engine: new S3StorageEngine({
          bucket: config.get('S3_BUCKET'),
          region: config.get('AWS_REGION'),
          baseUrlPublic: config.get('S3_PUBLIC_URL'),
          credentials: {
            accessKeyId: config.get('S3_ACCESS_KEY_ID'),
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
            sessionToken: config.get('S3_SESSION_TOKEN'),
          },
        }),
        defaultPrefix: 'uploads',
        publicReadByDefault: true,
      }),
    }),
  ],
})
export class AppModule {}
```

When using `forRootAsync`, ensure the factory returns the same shape as `forRoot` (an object with at least an `engine` property, plus any optional defaults or `global` flag).

---

## 🌍 Using Google Cloud Storage (`forRootAsync`)


```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileManagerModule, GcsStorageEngine } from '@ashotsiroyan/file-manager';

@Module({
  imports: [
    FileManagerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        engine: new GcsStorageEngine({
          bucket: config.get('GCS_BUCKET'),
          baseUrlPublic: config.get('GCS_PUBLIC_BASE_URL'),
          projectId: config.get('GCP_PROJECT'),
          auth: {
            keyFilename: config.get('GOOGLE_APPLICATION_CREDENTIALS'),
            keyFileJson: config.get('GOOGLE_APPLICATION_CREDENTIALS_JSON'),
            clientEmail: config.get('GCS_CLIENT_EMAIL'),
            privateKey: config.get('GCS_PRIVATE_KEY'),
          },
        }),
        defaultPrefix: 'uploads',
        publicReadByDefault: true,
      }),
    }),
  ],
})
export class AppModule {}
```

The `GcsStorageEngine` can work with either a key file (`GOOGLE_APPLICATION_CREDENTIALS`), a JSON blob (`GOOGLE_APPLICATION_CREDENTIALS_JSON`, raw or base64), or explicit `clientEmail` / `privateKey` pairs.

> ✅ You can also supply a preconfigured `Storage` instance (via `storage`) or additional `storageOptions` if you need advanced Google Cloud Storage setup.

> ✅ For AWS you can pass a ready-made `S3Client` through the `client` option or inject extra configuration with `clientConfig`.

---

## 🔐 Signed URLs (Direct Uploads)

```ts
const url = await this.files.signedUrl({
  key: 'uploads/user123/avatar.png',
  action: 'put',
  expiresInSeconds: 600,
  contentType: 'image/png',
});

console.log('Upload directly to:', url);
```

For downloads:
```ts
await this.files.signedUrl({ key, action: 'get', expiresInSeconds: 300 });
```

> ⚠️ Local engine doesn’t produce real signatures — it just returns `publicBaseUrl + key`.

---

## 🎧 Streaming via Backend

```ts
@Get('files/:key(*)')
async download(@Param('key') key: string, @Res() res: Response) {
  const obj = await this.files.get(key);
  if (obj.contentType) res.setHeader('Content-Type', obj.contentType);
  if (obj.size) res.setHeader('Content-Length', String(obj.size));
  obj.stream.pipe(res);
}
```

✅ **Why stream via backend?**
- Authorization & ownership checks
- Metrics & audit logs
- Prevent hotlinking
- Unified CORS and headers
- Range support for media

---

## 🧩 Advanced Usage

### Dynamic engine setup
```ts
FileManagerModule.forRootAsync({
  useFactory: async () => ({
    engine: new LocalStorageEngine({ baseDir: './data' }),
    defaultPrefix: 'user_uploads',
  }),
});
```

### Custom engine
```ts
class MyEngine implements StorageEngine {
  async putObject() {
    // ...
  }
  
  async getObject() {
    // ...
  }
  
  async deleteObject() {
    // ...
  }
}
```

---

## ⚡ Troubleshooting

| Issue | Cause | Fix |
|--------|-------|-----|
| `Cannot find module '@aws-sdk/...` | Missing dependency | Install optional deps |
| `Forbidden` on S3 | Wrong IAM policy | Update bucket permissions |
| `ENOENT` local | Missing folder | Check `baseDir` |
| `GCS invalid_grant` | Bad credentials | Fix service account JSON |
