import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { content_id, page_number, device_id } = await req.json();

    if (!content_id || page_number === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing content_id or page_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate device ID matches the one in profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("active_device_id, email, name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate device ID
    if (device_id && profile.active_device_id && device_id !== profile.active_device_id) {
      return new Response(
        JSON.stringify({ error: "Session invalid - logged in on another device", code: "DEVICE_MISMATCH" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has access to this content (admin or via user_content_access)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user is admin (role-based check)
    const isAdmin = profile.role === 'admin';

    if (!isAdmin) {
      // Check user_content_access table
      const { data: access, error: accessError } = await adminClient
        .from("user_content_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_id", content_id)
        .single();

      if (accessError || !access) {
        return new Response(
          JSON.stringify({ error: "You don't have access to this content" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get content details
    const { data: content, error: contentError } = await adminClient
      .from("content")
      .select("file_path, title, is_active")
      .eq("id", content_id)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content.is_active && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Content is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the PDF file from storage
    const { data: fileData, error: fileError } = await adminClient.storage
      .from("content-files")
      .download(content.file_path);

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to load content file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert PDF file to base64 for the client to process
    // The client will render using react-pdf but we add security via watermark
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Generate watermark data with user info and timestamp
    const watermarkData = {
      userName: profile.name || profile.email.split("@")[0],
      userEmail: profile.email,
      timestamp: new Date().toISOString(),
      sessionId: crypto.randomUUID().substring(0, 8),
    };

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: base64,
        contentType: "application/pdf",
        title: content.title,
        watermark: watermarkData,
        pageRequested: page_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in render-pdf-page:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
