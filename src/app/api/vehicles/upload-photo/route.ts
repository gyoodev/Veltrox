import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server-auth";

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

    // 5. Forward to ImgBB REST API v1
    try {
      const imgbbForm = new FormData();
      imgbbForm.append("image", base64Data);
      imgbbForm.append("name", `veltrox-${Date.now()}`);

      const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: imgbbForm,
      });

      if (imgbbRes.ok) {
        const imgbbJson = (await imgbbRes.json()) as ImgbbResponse;
        if (imgbbJson.success && imgbbJson.data) {
          const directUrl = imgbbJson.data.display_url || imgbbJson.data.url;
          return NextResponse.json({
            ok: true,
            url: directUrl,
            storagePath: `imgbb:${imgbbJson.data.id || Date.now()}`,
            deleteUrl: imgbbJson.data.delete_url || null,
            provider: "imgbb",
          });
        }
      } else {
        const errText = await imgbbRes.text().catch(() => "");
        console.warn("ImgBB API returned non-OK status:", imgbbRes.status, errText);
      }
    } catch (cloudErr) {
      console.warn("ImgBB cloud upload from server encountered an error:", cloudErr);
    }

    // 6. Resilient inline Data URI fallback so form submissions never crash
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
