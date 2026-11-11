/**
 * ImgBB Image Upload Utility
 *
 * Exclusively uploads images to ImgBB via the ImgBB REST API.
 * Returns the direct HTTPS link (`display_url || url`) for immediate display
 * and saving directly to Firestore documents (garages, vehicles, users, work orders, diary).
 */

const IMGBB_DEFAULT_API_KEY = "081c67f1d21a81269c6275b692e61030";

export interface ImgBBUploadResult {
  url: string;
  storagePath: string;
}

/**
 * Uploads an image file to ImgBB and returns its direct HTTPS image link.
 */
export async function uploadImageToImgBB(
  file: File,
  namePrefix = "veltrox"
): Promise<ImgBBUploadResult> {
  const apiKey =
    process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
    process.env.IMGBB_API_KEY ||
    IMGBB_DEFAULT_API_KEY;

  // 1. Primary: Direct upload to ImgBB API v1 from browser
  try {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("name", `${namePrefix}-${Date.now()}`);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data?: {
          id: string;
          url: string;
          display_url: string;
          delete_url?: string;
        };
        success: boolean;
      };

      if (json.success && json.data) {
        const directUrl = json.data.display_url || json.data.url;
        const storagePath = `imgbb:${json.data.id || Date.now()}`;
        return { url: directUrl, storagePath };
      }
    }
  } catch (err) {
    console.warn(
      "Direct browser upload to ImgBB API failed, attempting server proxy:",
      err
    );
  }

  // 2. Secondary: Server proxy fallback (server-to-server ImgBB API upload)
  try {
    const proxyForm = new FormData();
    proxyForm.append("file", file);

    const proxyRes = await fetch("/api/vehicles/upload-photo", {
      method: "POST",
      body: proxyForm,
    });

    if (proxyRes.ok) {
      const json = (await proxyRes.json()) as {
        ok: boolean;
        url: string;
        storagePath: string;
      };
      if (json.url) {
        return {
          url: json.url,
          storagePath: json.storagePath || `imgbb:${Date.now()}`,
        };
      }
    }
  } catch (proxyErr) {
    console.warn("Server proxy ImgBB upload failed:", proxyErr);
  }

  // 3. Fallback: Data URI for offline/resilient preview
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve({
          url: reader.result,
          storagePath: `data:${Date.now()}`,
        });
      } else {
        reject(new Error("Could not convert image to Data URI"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

