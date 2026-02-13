import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Create client with user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the token by getting the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Token validation failed:", authError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const userEmail = user.email || "";

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
      .eq("id", userId)
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
        .eq("user_id", userId)
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

    // Generate a signed URL (90 minutes) for better reading sessions
    // This avoids loading the entire file into memory
    const urlExpirySeconds = 5400; // 90 minutes
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("content-files")
      .createSignedUrl(content.file_path, urlExpirySeconds);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Failed to create signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate content access URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expiry timestamp for client-side refresh logic
    const expiresAt = Date.now() + (urlExpirySeconds * 1000);

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
        signedUrl: signedUrlData.signedUrl,
        expiresAt, // Client can use this to refresh before expiry
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
