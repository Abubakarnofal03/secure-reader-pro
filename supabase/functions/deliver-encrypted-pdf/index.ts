import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, degrees, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

async function encrypt(
  data: Uint8Array,
  password: string,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { ciphertext: new Uint8Array(encrypted), iv, salt };
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Watermark a single segment ──────────────────────────────────────────────

async function watermarkSegment(
  pdfBytes: Uint8Array,
  userName: string,
  userEmail: string,
  timestamp: string,
  sessionId: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const watermarkText = `${userName}  •  ${userEmail}  •  ${timestamp}  •  ${sessionId}`;
  const fontSize = 10;
  const color = rgb(0.7, 0.7, 0.7);
  const opacity = 0.15;
  const angle = degrees(-45);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const spacingX = 300;
    const spacingY = 200;
    const diagonal = Math.sqrt(width * width + height * height);

    for (let y = -diagonal / 2; y < diagonal; y += spacingY) {
      for (let x = -diagonal / 2; x < diagonal; x += spacingX) {
        page.drawText(watermarkText, {
          x,
          y,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: angle,
        });
      }
    }
  }

  return pdfDoc.save();
}

// ── Auth & access validation (shared) ────────────────────────────────────────

async function validateRequest(req: Request, adminClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw { status: 401, error: "Missing authorization header" };

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);
  if (authError || !user) throw { status: 401, error: "Invalid or expired token" };

  return user;
}

async function validateAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  contentId: string,
  deviceId?: string,
) {
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("active_device_id, email, name, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) throw { status: 404, error: "Profile not found" };

  if (deviceId && profile.active_device_id && deviceId !== profile.active_device_id) {
    throw { status: 401, error: "Session invalid - logged in on another device", code: "DEVICE_MISMATCH" };
  }

  const isAdmin = profile.role === "admin";
  if (!isAdmin) {
    const { data: access, error: accessError } = await adminClient
      .from("user_content_access")
      .select("id")
      .eq("user_id", userId)
      .eq("content_id", contentId)
      .single();
    if (accessError || !access) throw { status: 403, error: "You don't have access to this content" };
  }

  return { profile, isAdmin };
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const user = await validateRequest(req, adminClient);
    const userId = user.id;

    const body = await req.json();
    const { content_id, device_id, segment_index } = body;

    if (!content_id) {
      return new Response(JSON.stringify({ error: "Missing content_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile, isAdmin } = await validateAccess(adminClient, userId, content_id, device_id);

    // ── Content metadata ──
    const { data: contentMeta, error: contentError } = await adminClient
      .from("content")
      .select("title, total_pages, table_of_contents, file_path, is_active, updated_at")
      .eq("id", content_id)
      .single();

    if (contentError || !contentMeta) {
      return new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contentMeta.is_active && !isAdmin) {
      return new Response(JSON.stringify({ error: "Content is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get segments ──
    const { data: segments } = await adminClient
      .from("content_segments")
      .select("file_path, segment_index, start_page, end_page")
      .eq("content_id", content_id)
      .order("segment_index", { ascending: true });

    const segmentList = segments || [];
    const versionInput = `${content_id}:${contentMeta.updated_at}:${userId}`;
    const versionHash = await sha256Hex(versionInput);

    // ════════════════════════════════════════════════════════════════════════
    // MODE 1: METADATA REQUEST (no segment_index) — returns segment info
    // ════════════════════════════════════════════════════════════════════════
    if (segment_index === undefined || segment_index === null) {
      // Check cache
      if (device_id) {
        const { data: cached } = await adminClient
          .from("encrypted_content_cache")
          .select("version_hash")
          .eq("user_id", userId)
          .eq("content_id", content_id)
          .eq("device_id", device_id)
          .maybeSingle();

        if (cached?.version_hash === versionHash) {
          return new Response(
            JSON.stringify({
              cached: true,
              versionHash,
              title: contentMeta.title,
              totalPages: contentMeta.total_pages,
              tableOfContents: contentMeta.table_of_contents,
              segmentCount: segmentList.length || 1,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Generate a per-session watermark identifier
      const sessionId = crypto.randomUUID().substring(0, 8);
      const timestamp = new Date().toISOString();

      return new Response(
        JSON.stringify({
          cached: false,
          versionHash,
          title: contentMeta.title,
          totalPages: contentMeta.total_pages,
          tableOfContents: contentMeta.table_of_contents,
          segmentCount: segmentList.length || 1,
          // Pass these back so client sends them with each segment request
          sessionId,
          timestamp,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // MODE 2: SEGMENT DOWNLOAD (with segment_index) — watermark + encrypt one chunk
    // ════════════════════════════════════════════════════════════════════════
    const { session_id: sessionId, timestamp } = body;
    const userName = profile.name || profile.email.split("@")[0];

    let segmentBytes: Uint8Array;

    if (segmentList.length > 0) {
      const seg = segmentList[segment_index];
      if (!seg) {
        return new Response(JSON.stringify({ error: `Segment ${segment_index} not found` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fileData, error: dlError } = await adminClient.storage
        .from("content-files")
        .download(seg.file_path);

      if (dlError || !fileData) {
        return new Response(JSON.stringify({ error: `Failed to download segment ${segment_index}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      segmentBytes = new Uint8Array(await fileData.arrayBuffer());
    } else {
      // Legacy single-file content (treat as segment 0)
      if (segment_index !== 0) {
        return new Response(JSON.stringify({ error: "Invalid segment index for single-file content" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: fileData, error: dlError } = await adminClient.storage
        .from("content-files")
        .download(contentMeta.file_path);

      if (dlError || !fileData) {
        return new Response(JSON.stringify({ error: "Failed to download content file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      segmentBytes = new Uint8Array(await fileData.arrayBuffer());
    }

    // Watermark this segment
    let watermarkedBytes: Uint8Array;
    try {
      watermarkedBytes = await watermarkSegment(
        segmentBytes,
        userName,
        profile.email,
        timestamp || new Date().toISOString(),
        sessionId || crypto.randomUUID().substring(0, 8),
      );
    } catch (wmError) {
      console.error("Watermarking failed:", wmError);
      return new Response(
        JSON.stringify({
          error: "Failed to process PDF for delivery. The file may be corrupted or password-protected.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Encrypt
    const encryptionPassword = `${userId}:${device_id || "web"}:${content_id}`;
    const { ciphertext, iv, salt } = await encrypt(new Uint8Array(watermarkedBytes), encryptionPassword);

    // Update cache on last segment
    const isLastSegment = segment_index >= (segmentList.length || 1) - 1;
    if (device_id && isLastSegment) {
      await adminClient
        .from("encrypted_content_cache")
        .upsert(
          { user_id: userId, content_id, device_id, version_hash: versionHash },
          { onConflict: "user_id,content_id,device_id" },
        );
    }

    console.log(
      `[deliver-encrypted-pdf] Segment ${segment_index} of ${content_id} to user ${userId}, ` +
        `size=${ciphertext.length}`,
    );

    return new Response(
      JSON.stringify({
        segmentIndex: segment_index,
        encryptedPdf: toBase64(ciphertext),
        iv: toBase64(iv),
        salt: toBase64(salt),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    // Structured error from validateRequest/validateAccess
    if (error && typeof error === "object" && "status" in error) {
      const e = error as { status: number; error: string; code?: string };
      return new Response(JSON.stringify({ error: e.error, code: e.code }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("Error in deliver-encrypted-pdf:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
