import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRecipient {
  userId: string;
  email: string;
  firstName: string | null;
  preferences: {
    marketing_emails: boolean;
    activity_reminders: boolean;
    usage_reports: boolean;
    reengagement_emails: boolean;
  };
  pendingDocuments: number;
  pendingAnalyses: number;
  creditsUsed: number;
  creditsRemaining: number;
  lastLogin: string | null;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { type, campaignId, testEmail } = await req.json();

    // If test email, send only to that address
    if (testEmail) {
      const result = await sendTestEmail(supabaseAdmin, testEmail, type, campaignId);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with email preferences
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (authError) throw authError;

    // Get profiles and preferences
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    if (profileError) throw profileError;

    // Get email preferences
    const { data: preferences, error: prefError } = await supabaseAdmin
      .from("email_preferences")
      .select("*");

    if (prefError) throw prefError;

    // Build recipient list with personalized data
    const recipients: EmailRecipient[] = [];

    for (const user of authUsers.users) {
      const profile = profiles?.find(p => p.id === user.id);
      const pref = preferences?.find(p => p.user_id === user.id);

      // Skip if globally unsubscribed
      if (pref?.unsubscribed_all) continue;

      // Get pending documents count
      const { count: pendingDocs } = await supabaseAdmin
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("edited_content", null);

      // Get pending analyses count
      const { count: pendingAnalyses } = await supabaseAdmin
        .from("analysis_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      recipients.push({
        userId: user.id,
        email: user.email || "",
        firstName: profile?.first_name || null,
        preferences: {
          marketing_emails: pref?.marketing_emails ?? true,
          activity_reminders: pref?.activity_reminders ?? true,
          usage_reports: pref?.usage_reports ?? true,
          reengagement_emails: pref?.reengagement_emails ?? true,
        },
        pendingDocuments: pendingDocs || 0,
        pendingAnalyses: pendingAnalyses || 0,
        creditsUsed: 40 - (profile?.monthly_credits || 0),
        creditsRemaining: (profile?.daily_credits || 0) + (profile?.paid_credits || 0),
        lastLogin: user.last_sign_in_at || null,
      });
    }

    // Filter recipients based on email type
    const filteredRecipients = recipients.filter(r => {
      if (type === "marketing") return r.preferences.marketing_emails;
      if (type === "activity") return r.preferences.activity_reminders;
      if (type === "usage") return r.preferences.usage_reports;
      if (type === "reengagement") return r.preferences.reengagement_emails;
      return true; // For weekly digest, check all types
    });

    // Get campaign content if campaignId provided
    let campaignContent = null;
    if (campaignId) {
      const { data: campaign } = await supabaseAdmin
        .from("email_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      campaignContent = campaign;
    }

    // Send emails
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const recipient of filteredRecipients) {
      try {
        const emailContent = generateEmailContent(recipient, type, campaignContent);
        
        await resend.emails.send({
          from: "ProjectPal <noreply@projectpal.site>",
          to: [recipient.email],
          subject: emailContent.subject,
          html: emailContent.html,
        });

        // Log the email
        await supabaseAdmin.from("email_logs").insert({
          campaign_id: campaignId || null,
          user_id: recipient.userId,
          email: recipient.email,
          status: "sent",
        });

        results.sent++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${recipient.email}: ${error.message}`);

        await supabaseAdmin.from("email_logs").insert({
          campaign_id: campaignId || null,
          user_id: recipient.userId,
          email: recipient.email,
          status: "failed",
          error_message: error.message,
        });
      }
    }

    // Update campaign status if campaignId
    if (campaignId) {
      await supabaseAdmin
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipients_count: results.sent,
        })
        .eq("id", campaignId);
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-newsletter:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTestEmail(supabaseAdmin: any, email: string, type: string, campaignId?: string) {
  // Look up campaign content if campaignId provided
  let campaignContent = null;
  if (campaignId) {
    const { data: campaign, error } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    
    if (!error && campaign) {
      campaignContent = campaign;
    }
  }

  const testRecipient: EmailRecipient = {
    userId: "test",
    email,
    firstName: "Test User",
    preferences: {
      marketing_emails: true,
      activity_reminders: true,
      usage_reports: true,
      reengagement_emails: true,
    },
    pendingDocuments: 3,
    pendingAnalyses: 2,
    creditsUsed: 15,
    creditsRemaining: 25,
    lastLogin: new Date().toISOString(),
  };

  const emailContent = generateEmailContent(testRecipient, type, campaignContent);
  
  const result = await resend.emails.send({
    from: "ProjectPal <noreply@projectpal.site>",
    to: [email],
    subject: `[TEST] ${emailContent.subject}`,
    html: emailContent.html,
  });

  return { success: true, result };
}

function generateEmailContent(
  recipient: EmailRecipient,
  type: string,
  campaignContent: any
): { subject: string; html: string } {
  const firstName = recipient.firstName || "there";
  const baseUrl = "https://projectpal.site";

  if (campaignContent) {
    return {
      subject: campaignContent.subject,
      html: wrapInTemplate(campaignContent.content, firstName, baseUrl),
    };
  }

  // Generate content based on type
  switch (type) {
    case "marketing":
      return {
        subject: "🎉 New Features & Tips from ProjectPal",
        html: wrapInTemplate(`
          <h2>What's New at ProjectPal</h2>
          <p>We've been busy making ProjectPal even better for you!</p>
          <ul>
            <li>📊 Enhanced Data Analysis with more statistical tests</li>
            <li>📝 Improved Document Editor with AI suggestions</li>
            <li>💬 Smarter AI Chat for research questions</li>
          </ul>
          <p>Ready to explore?</p>
          <a href="${baseUrl}/dashboard" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Visit Dashboard</a>
        `, firstName, baseUrl),
      };

    case "activity":
      return {
        subject: `📝 You have ${recipient.pendingDocuments} pending project(s)`,
        html: wrapInTemplate(`
          <h2>Your Pending Projects</h2>
          <p>Don't leave your work unfinished! Here's what's waiting for you:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📄 Documents:</strong> ${recipient.pendingDocuments} awaiting edits</p>
            <p style="margin: 10px 0 0 0;"><strong>📊 Analyses:</strong> ${recipient.pendingAnalyses} in progress</p>
          </div>
          <p>Complete your projects to get the most out of your credits!</p>
          <a href="${baseUrl}/documents" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Continue Working</a>
        `, firstName, baseUrl),
      };

    case "usage":
      return {
        subject: "📊 Your Weekly Usage Report",
        html: wrapInTemplate(`
          <h2>Your Weekly Summary</h2>
          <p>Here's how you've been using ProjectPal this week:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Credits Used:</strong> ${recipient.creditsUsed}</p>
            <p style="margin: 10px 0;"><strong>Credits Remaining:</strong> ${recipient.creditsRemaining}</p>
            <p style="margin: 10px 0 0 0;"><strong>Projects Created:</strong> ${recipient.pendingDocuments + recipient.pendingAnalyses}</p>
          </div>
          <p>Keep up the great work on your research!</p>
          <a href="${baseUrl}/dashboard" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Full Stats</a>
        `, firstName, baseUrl),
      };

    case "reengagement":
      return {
        subject: "👋 We miss you at ProjectPal!",
        html: wrapInTemplate(`
          <h2>It's Been a While!</h2>
          <p>We noticed you haven't logged in recently. Here's what you might have missed:</p>
          <ul>
            <li>🆕 New AI-powered features for faster research</li>
            <li>📊 Enhanced data analysis capabilities</li>
            <li>🎁 Your credits are waiting to be used!</li>
          </ul>
          <p>Come back and see what's new!</p>
          <a href="${baseUrl}/dashboard" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Return to ProjectPal</a>
        `, firstName, baseUrl),
      };

    default: // weekly_digest
      return {
        subject: "📬 Your Weekly ProjectPal Update",
        html: wrapInTemplate(`
          <h2>Weekly Digest</h2>
          
          <h3>📊 Your Activity</h3>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">Documents: ${recipient.pendingDocuments} | Analyses: ${recipient.pendingAnalyses}</p>
            <p style="margin: 10px 0 0 0;">Credits: ${recipient.creditsRemaining} remaining</p>
          </div>
          
          ${recipient.pendingDocuments > 0 ? `
          <h3>📝 Pending Projects</h3>
          <p>You have ${recipient.pendingDocuments} document(s) that need your attention.</p>
          ` : ''}
          
          <h3>✨ Pro Tip</h3>
          <p>Use the AI Chat feature to get instant answers to your research questions!</p>
          
          <a href="${baseUrl}/dashboard" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Dashboard</a>
        `, firstName, baseUrl),
      };
  }
}

function wrapInTemplate(content: string, firstName: string, baseUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7c3aed; margin: 0;">🎓 ProjectPal</h1>
      </div>
      
      <p>Hi ${firstName},</p>
      
      ${content}
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="font-size: 12px; color: #6b7280; text-align: center;">
        You're receiving this email because you're a ProjectPal user.<br>
        <a href="${baseUrl}/settings" style="color: #7c3aed;">Manage Preferences</a> | 
        <a href="${baseUrl}/functions/v1/manage-email-preferences?action=unsubscribe" style="color: #7c3aed;">Unsubscribe</a>
      </p>
    </body>
    </html>
  `;
}
