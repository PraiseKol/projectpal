import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const token = url.searchParams.get("token");

    // Handle one-click unsubscribe via GET
    if (req.method === "GET" && action === "unsubscribe" && token) {
      const { data: pref, error } = await supabaseAdmin
        .from("email_preferences")
        .update({ unsubscribed_all: true })
        .eq("unsubscribe_token", token)
        .select()
        .single();

      if (error || !pref) {
        return new Response(renderHtmlPage("Error", "Invalid or expired unsubscribe link."), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      return new Response(renderHtmlPage("Unsubscribed", "You have been successfully unsubscribed from all ProjectPal emails."), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Handle authenticated API requests
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestAction = body.action || action;

    switch (requestAction) {
      case "get": {
        // Get user's email preferences
        const { data: preferences, error } = await supabaseAdmin
          .from("email_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        // If no preferences exist, return defaults
        if (!preferences) {
          return new Response(JSON.stringify({
            marketing_emails: true,
            activity_reminders: true,
            usage_reports: true,
            reengagement_emails: true,
            unsubscribed_all: false,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(preferences), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        const updates = {
          marketing_emails: body.marketing_emails,
          activity_reminders: body.activity_reminders,
          usage_reports: body.usage_reports,
          reengagement_emails: body.reengagement_emails,
          unsubscribed_all: body.unsubscribed_all,
        };

        // Remove undefined values
        Object.keys(updates).forEach(key => {
          if ((updates as any)[key] === undefined) {
            delete (updates as any)[key];
          }
        });

        // Upsert preferences
        const { data, error } = await supabaseAdmin
          .from("email_preferences")
          .upsert({
            user_id: user.id,
            ...updates,
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unsubscribe_all": {
        const { data, error } = await supabaseAdmin
          .from("email_preferences")
          .upsert({
            user_id: user.id,
            unsubscribed_all: true,
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resubscribe": {
        const { data, error } = await supabaseAdmin
          .from("email_preferences")
          .upsert({
            user_id: user.id,
            unsubscribed_all: false,
            marketing_emails: true,
            activity_reminders: true,
            usage_reports: true,
            reengagement_emails: true,
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("Error in manage-email-preferences:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function renderHtmlPage(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - ProjectPal</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background-color: #f3f4f6;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }
        h1 { color: #7c3aed; margin-bottom: 16px; }
        p { color: #4b5563; line-height: 1.6; }
        a { color: #7c3aed; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎓 ProjectPal</h1>
        <h2>${title}</h2>
        <p>${message}</p>
        <p><a href="/">Return to ProjectPal</a></p>
      </div>
    </body>
    </html>
  `;
}
