import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireRole } from "@/lib/auth/server-auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const IMGBB_DEFAULT_API_KEY = "081c67f1d21a81269c6275b692e61030";
const MAX_PHOTO_BYTES = 32 * 1024 * 1024; // Up to 32 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

interface ImgbbResponse {
  data?: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: string | number;
    height: string | number;
    size: string | number;
    delete_url: string;
  };
  success: boolean;
  status: number;
  error?: {
    message: string;
    code: number;
  };
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    await requireRole(["USER", "GARAGE_OWNER", "ADMIN"]);

    // 2. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    // 3. Validate file size (max 32 MB)
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image size exceeds 32 MB limit" },
        { status: 400 }
      );
    }

    // 4. Validate MIME type
    const mime = file.type.toLowerCase();
    const extension = ALLOWED_MIME_TYPES[mime];
    if (!extension) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid image type. Allowed formats: JPEG, PNG, WebP, AVIF, GIF.",
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64Data = fileBuffer.toString("base64");
    const apiKey =
      process.env.IMGBB_API_KEY ||
      process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
      IMGBB_DEFAULT_API_KEY;

    // 5. Primary: Forward to ImgBB Cloud API v1
    try {
      const imgbbForm = new FormData();
      imgbbForm.append("image", base64Data);
      imgbbForm.append("name", `veltrox-${Date.now()}`);

      const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: imgbbForm,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (imgbbRes.ok) {
        const imgbbJson = (await imgbbRes.json()) as ImgbbResponse;
        if (imgbbJson.success && imgbbJson.data) {
          const directUrl = imgbbJson.data.display_url || imgbbJson.data.url;
          return NextResponse.json({
            ok: true,
            url: directUrl,
            storagePath: `imgbb:${imgbbJson.data.id || imgbbJson.data.title}`,
            deleteUrl: imgbbJson.data.delete_url || null,
            provider: "imgbb",
          });
        }
      }
    } catch (cloudErr) {
      console.warn("ImgBB cloud upload from server encountered an error:", cloudErr);
    }

    // 6. Secondary fallback: Firebase Admin Cloud Storage
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        const bucket = admin.adminStorage.bucket();
        const uniqueId = crypto.randomBytes(6).toString("hex");
        const filename = `uploads/${Date.now()}-${uniqueId}.${extension}`;
        const fileRef = bucket.file(filename);

        await fileRef.save(fileBuffer, {
          metadata: {
            contentType: mime,
            cacheControl: "public, max-age=31536000",
          },
        });

        await fileRef.makePublic().catch(() => {});
        const bucketName = bucket.name;
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;

        return NextResponse.json({
          ok: true,
          url: publicUrl,
          storagePath: filename,
          filename,
          provider: "firebase-storage",
        });
      } catch (storageErr) {
        console.warn("Firebase Storage upload fallback encountered an error:", storageErr);
      }
    }

    // 7. Tertiary fallback: Local public storage (only in dev where filesystem is writable)
    if (process.env.NODE_ENV !== "production") {
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "cars");
        await fs.mkdir(uploadDir, { recursive: true });

        const uniqueId = crypto.randomBytes(6).toString("hex");
        const filename = `car-${Date.now()}-${uniqueId}.${extension}`;
        const targetFilePath = path.join(uploadDir, filename);

        await fs.writeFile(targetFilePath, fileBuffer);

        const publicUrl = `/uploads/cars/${filename}`;
        const storagePath = `public/uploads/cars/${filename}`;

        return NextResponse.json({
          ok: true,
          url: publicUrl,
          storagePath,
          filename,
          provider: "local",
        });
      } catch (localErr) {
        console.warn("Local storage fallback failed:", localErr);
      }
    }

    // 8. Final resilient fallback: Base64 data URI
    const dataUri = `data:${mime};base64,${base64Data}`;
    return NextResponse.json({
      ok: true,
      url: dataUri,
      storagePath: `data:${Date.now()}`,
      provider: "inline",
    });
  } catch (error) {
    console.error("Vehicle photo upload failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during photo upload.",
      },
      { status: 500 }
    );
  }
}
