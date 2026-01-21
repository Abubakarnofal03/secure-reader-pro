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

    // Parse request body
    const { content_id, segment_index, device_id } = await req.json();

    if (!content_id || segment_index === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing content_id or segment_index" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate device ID matches the one in profile
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("active_device_id, role")
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

    // Check if user has access to this content
    const isAdmin = profile.role === 'admin';

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
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get segment details
    const { data: segment, error: segmentError } = await adminClient
      .from("content_segments")
      .select("file_path, start_page, end_page")
      .eq("content_id", content_id)
      .eq("segment_index", segment_index)
      .single();

    if (segmentError || !segment) {
      console.error("Segment not found:", segmentError);
      return new Response(
        JSON.stringify({ error: "Segment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate short-lived signed URL (60 seconds for security)
    const urlExpirySeconds = 60;
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from("content-files")
      .createSignedUrl(segment.file_path, urlExpirySeconds);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Failed to create signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate segment access URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expiresAt = Date.now() + (urlExpirySeconds * 1000);

    console.log(`[get-segment-url] Generated URL for content ${content_id}, segment ${segment_index}`);

    return new Response(
      JSON.stringify({
        success: true,
        signedUrl: signedUrlData.signedUrl,
        expiresAt,
        segmentIndex: segment_index,
        startPage: segment.start_page,
        endPage: segment.end_page,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in get-segment-url:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
