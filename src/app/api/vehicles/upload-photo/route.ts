import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireRole } from "@/lib/auth/server-auth";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

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

    // 3. Validate file size
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image size exceeds 10 MB limit" },
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
          error: "Invalid image type. Allowed formats: JPEG, PNG, WebP, AVIF.",
        },
        { status: 400 }
      );
    }

    // 5. Ensure target directory exists in public/uploads/cars
    const uploadDir = path.join(process.cwd(), "public", "uploads", "cars");
    await fs.mkdir(uploadDir, { recursive: true });

    // 6. Generate collision-free unique filename
    const uniqueId = crypto.randomBytes(6).toString("hex");
    const filename = `car-${Date.now()}-${uniqueId}.${extension}`;
    const targetFilePath = path.join(uploadDir, filename);

    // 7. Write file buffer to public folder
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetFilePath, fileBuffer);

    // 8. Public relative URL accessible directly in Next.js
    const publicUrl = `/uploads/cars/${filename}`;
    const storagePath = `public/uploads/cars/${filename}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      storagePath,
      filename,
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

