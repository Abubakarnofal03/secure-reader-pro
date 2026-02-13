import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, degrees, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
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
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return { ciphertext: new Uint8Array(encrypted), iv, salt };
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Watermarking ─────────────────────────────────────────────────────────────

async function watermarkPdf(
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
  const color = rgb(0.7, 0.7, 0.7); // light gray
  const opacity = 0.15;
  const angle = degrees(-45);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Create a repeating diagonal grid
    const spacingX = 300;
    const spacingY = 200;
    const diagonal = Math.sqrt(width * width + height * height);

    for (let y = -diagonal / 2; y < diagonal; y += spacingY) {
      for (let x = -diagonal / 2; x < diagonal; x += spacingX) {
        page.drawText(watermarkText, {
          x: x,
          y: y,
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

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // ── Parse body ──
    const { content_id, device_id } = await req.json();
    if (!content_id) {
      return new Response(
        JSON.stringify({ error: "Missing content_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Profile & device validation ──
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("active_device_id, email, name, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (device_id && profile.active_device_id && device_id !== profile.active_device_id) {
      return new Response(
        JSON.stringify({ error: "Session invalid - logged in on another device", code: "DEVICE_MISMATCH" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Access check ──
    const isAdmin = profile.role === "admin";
    if (!isAdmin) {
      const { data: access, error: accessError } = await adminClient
        .from("user_content_access")
        .select("id")
        .eq("user_id", userId)
        .eq("content_id", content_id)
        .single();

      if (accessError || !access) {
        return new Response(
          JSON.stringify({ error: "You don't have access to this content" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Content metadata ──
    const { data: contentMeta, error: contentError } = await adminClient
      .from("content")
      .select("title, total_pages, table_of_contents, file_path, is_active, updated_at")
      .eq("id", content_id)
      .single();

    if (contentError || !contentMeta) {
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!contentMeta.is_active && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Content is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Compute version hash ──
    const versionInput = `${content_id}:${contentMeta.updated_at}:${userId}`;
    const versionHash = await sha256Hex(versionInput);

    // ── Check if client already has this version ──
    if (device_id) {
      const { data: cached } = await adminClient
        .from("encrypted_content_cache")
        .select("version_hash")
        .eq("user_id", userId)
        .eq("content_id", content_id)
        .eq("device_id", device_id)
        .maybeSingle();

      if (cached?.version_hash === versionHash) {
        // Client already has the latest version
        return new Response(
          JSON.stringify({
            cached: true,
            versionHash,
            title: contentMeta.title,
            totalPages: contentMeta.total_pages,
            tableOfContents: contentMeta.table_of_contents,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Download PDF segments (or single file) ──
    const { data: segments } = await adminClient
      .from("content_segments")
      .select("file_path, segment_index, start_page, end_page")
      .eq("content_id", content_id)
      .order("segment_index", { ascending: true });

    let fullPdfBytes: Uint8Array;

    if (segments && segments.length > 0) {
      // Merge segments into one PDF
      const mergedDoc = await PDFDocument.create();

      for (const seg of segments) {
        const { data: fileData, error: dlError } = await adminClient.storage
          .from("content-files")
          .download(seg.file_path);

        if (dlError || !fileData) {
          console.error(`Failed to download segment ${seg.segment_index}:`, dlError);
          return new Response(
            JSON.stringify({ error: `Failed to download segment ${seg.segment_index}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const segBytes = new Uint8Array(await fileData.arrayBuffer());
        const segDoc = await PDFDocument.load(segBytes, { ignoreEncryption: true });
        const pageIndices = segDoc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(segDoc, pageIndices);
        copiedPages.forEach((p) => mergedDoc.addPage(p));
      }

      fullPdfBytes = await mergedDoc.save();
    } else {
      // Single-file (legacy) content
      const { data: fileData, error: dlError } = await adminClient.storage
        .from("content-files")
        .download(contentMeta.file_path);

      if (dlError || !fileData) {
        return new Response(
          JSON.stringify({ error: "Failed to download content file" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      fullPdfBytes = new Uint8Array(await fileData.arrayBuffer());
    }

    // ── Watermark ──
    const sessionId = crypto.randomUUID().substring(0, 8);
    const timestamp = new Date().toISOString();
    const userName = profile.name || profile.email.split("@")[0];

    const watermarkedBytes = await watermarkPdf(
      fullPdfBytes,
      userName,
      profile.email,
      timestamp,
      sessionId,
    );

    // ── Encrypt ──
    const encryptionPassword = `${userId}:${device_id || "web"}:${content_id}`;
    const { ciphertext, iv, salt } = await encrypt(
      new Uint8Array(watermarkedBytes),
      encryptionPassword,
    );

    // ── Store cache record ──
    if (device_id) {
      await adminClient
        .from("encrypted_content_cache")
        .upsert(
          {
            user_id: userId,
            content_id,
            device_id,
            version_hash: versionHash,
          },
          { onConflict: "user_id,content_id,device_id" },
        );
    }

    console.log(
      `[deliver-encrypted-pdf] Delivered ${content_id} to user ${userId}, ` +
      `size=${ciphertext.length}, pages=${contentMeta.total_pages}`,
    );

    // ── Return encrypted payload ──
    return new Response(
      JSON.stringify({
        cached: false,
        encryptedPdf: toBase64(ciphertext),
        iv: toBase64(iv),
        salt: toBase64(salt),
        versionHash,
        title: contentMeta.title,
        totalPages: contentMeta.total_pages,
        tableOfContents: contentMeta.table_of_contents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in deliver-encrypted-pdf:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
