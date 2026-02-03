import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert PEM private key to CryptoKey for signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Handle both literal newlines and escaped \n in the private key
  const normalizedPem = pem.replace(/\\n/g, "\n");

  const pemContents = normalizedPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

// Base64URL encode
function base64UrlEncode(data: Uint8Array | string): string {
  let base64: string;
  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...data));
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Create and sign JWT for Google OAuth2
async function createSignedJwt(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoder.encode(signatureInput));

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

// Get OAuth2 access token from Google
async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createSignedJwt(serviceAccount);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send FCM notification using v1 API
async function sendFcmNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message: {
    message: {
      token: string;
      notification: { title: string; body: string };
      data?: Record<string, string>;
      android?: { priority: string };
    };
  } = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      android: {
        priority: "high",
      },
    },
  };

  if (data) {
    message.message.data = data;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`FCM send failed: ${error}`);
    return false;
  }

  console.log("FCM notification sent successfully");
  return true;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse service account from environment
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;

    if (!projectId) {
      throw new Error("project_id not found in service account");
    }

    // Parse request body
    const { title, body, data, fcmTokens } = await req.json();

    if (!title || !body) {
      throw new Error("title and body are required");
    }

    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount);

    // If specific tokens provided, use those. Otherwise, fetch admin tokens from database
    let tokens: string[] = fcmTokens || [];

    if (tokens.length === 0) {
      // Fetch admin FCM tokens from database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: admins, error } = await supabase
        .from("profiles")
        .select("fcm_token")
        .eq("role", "admin")
        .not("fcm_token", "is", null);

      if (error) {
        throw new Error(`Failed to fetch admin tokens: ${error.message}`);
      }

      tokens = admins?.map((a) => a.fcm_token).filter(Boolean) || [];
    }

    if (tokens.length === 0) {
      console.log("No FCM tokens found to send notifications");
      return new Response(JSON.stringify({ success: true, message: "No tokens to send to" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notifications to all tokens
    const results = await Promise.all(
      tokens.map((token) => sendFcmNotification(accessToken, projectId, token, title, body, data)),
    );

    const successCount = results.filter(Boolean).length;
    console.log(`Sent ${successCount}/${tokens.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: tokens.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Push notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
