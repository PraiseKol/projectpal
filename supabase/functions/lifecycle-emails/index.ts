import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
}

const FROM_EMAIL = "ProjectPal <hello@projectpal.site>";

const welcomeEmail = (firstName: string | null, code: string | null) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h1 style="color: #0d9488;">Welcome${firstName ? `, ${firstName}` : ""}! 🎓</h1>
    <p>You just joined <strong>ProjectPal</strong> — your AI assistant for final year projects.</p>
    <p>Here's how to get the most out of your free credits:</p>
    <ul>
      <li><strong>Start a chat</strong> and generate your project topic or Chapter 1</li>
      <li><strong>Explore the tools</strong> — Data Analysis, Questionnaire Builder, AI Humanizer</li>
      <li><strong>Watch your credits</strong> — free plans get daily and monthly credits</li>
    </ul>
    <p>Need help? Just reply to this email.</p>
    <p style="text-align: center; margin-top: 32px;">
      <a href="https://projectpal.site/dashboard" style="background: linear-gradient(135deg, #0d9488, #059669); color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Open ProjectPal</a>
    </p>
  </div>`;

const inactivityEmail = (firstName: string | null, code: string | null) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h1 style="color: #0d9488;">Still working on your project${firstName ? `, ${firstName}` : ""}?</h1>
    <p>It's been a few days since you visited ProjectPal. Your chapters won't write themselves! 😄</p>
    <p>Pick up where you left off — your chat history and documents are waiting.</p>
    ${code ? `<p>Know a classmate who's stuck on their project? Share your code <strong>${code}</strong> — they get 10% off their first purchases, you earn credits.</p>` : ""}
    <p style="text-align: center; margin-top: 32px;">
      <a href="https://projectpal.site/dashboard" style="background: linear-gradient(135deg, #0d9488, #059669); color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Continue My Project</a>
    </p>
  </div>`;

const lowCreditEmail = (firstName: string | null, available: number) => `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h1 style="color: #0d9488;">You're running low on credits${firstName ? `, ${firstName}` : ""}</h1>
    <p>You have <strong>${available} credits</strong> left. Bigger jobs like Chapter 3, Data Analysis or a full PowerPoint deck use more credits — top up before you start so your work isn't interrupted.</p>
    <p style="text-align: center; margin-top: 32px;">
      <a href="https://projectpal.site/pricing" style="background: linear-gradient(135deg, #0d9488, #059669); color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold;">Top Up Credits</a>
    </p>
  </div>`;

const htmlify = (html: string) => html;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

    // Collect all auth users once
    const authUsers: AuthUser[] = [];
    let page = 1;
    const perPage = 500;
    for (;;) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      authUsers.push(...(data?.users ?? []));
      if (!data?.users || data.users.length < perPage) break;
      page += 1;
    }

    // Preferences and referral codes
    const [{ data: preferences }, { data: profiles }, { data: refCodes }] = await Promise.all([
      supabaseAdmin.from("email_preferences").select("*"),
      supabaseAdmin.from("profiles").select("id, plan_type, daily_credits, monthly_credits, paid_credits, credits_expiry_date, first_name, created_at, welcome_email_sent_at, inactivity_email_sent_at, low_credit_email_sent_at"),
      supabaseAdmin.from("referral_codes").select("user_id, code").eq("is_active", true),
    ]);
    const prefMap = new Map((preferences ?? []).map((p: any) => [p.user_id, p]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const codeMap = new Map((refCodes ?? []).map((c: any) => [c.user_id, c.code]));

    // Last chat activity per user
    const { data: lastChats } = await supabaseAdmin
      .from("chat_sessions")
      .select("user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20000);
    const lastChatMap = new Map<string, string>();
    (lastChats ?? []).forEach((s: any) => {
      if (!lastChatMap.has(s.user_id)) lastChatMap.set(s.user_id, s.created_at);
    });

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const logs: any[] = [];

    const send = async (user: AuthUser, type: "welcome" | "inactivity" | "low_credit", html: string) => {
      if (!user.email) return false;
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: [user.email],
          subject: type === "welcome"
            ? "Welcome to ProjectPal — start your project today"
            : type === "inactivity"
              ? "Your project is waiting for you"
              : "You're running low on credits",
          html: htmlify(html),
        });
        if (error) {
          logs.push({ user_id: user.id, email: user.email, status: "failed", email_type: type, error_message: String(error) });
          return false;
        }
        logs.push({ user_id: user.id, email: user.email, status: "sent", email_type: type });
        return true;
      } catch (e) {
        logs.push({ user_id: user.id, email: user.email, status: "failed", email_type: type, error_message: String(e) });
        return false;
      }
    };

    const updates: { id: string; patch: Record<string, string> }[] = [];

    for (const user of authUsers) {
      const profile = profileMap.get(user.id) as any;
      if (!profile) continue;
      const pref = prefMap.get(user.id) as any;
      if (pref?.unsubscribed_all) continue;
      const firstName: string | null = profile.first_name ?? null;
      const code: string | null = codeMap.get(user.id) ?? null;

      // 1. Welcome email — new users within the last 48h, once ever
      const createdAt = user.created_at ? Date.parse(user.created_at) : Date.parse(profile.created_at ?? "");
      if (
        !profile.welcome_email_sent_at &&
        createdAt && now - createdAt < 48 * DAY &&
        (pref?.activity_reminders ?? true)
      ) {
        if (await send(user, "welcome", welcomeEmail(firstName, code))) {
          updates.push({ id: user.id, patch: { welcome_email_sent_at: new Date().toISOString() } });
        }
        continue; // one lifecycle email per user per run
      }

      // 2. Inactivity check-in — no visit for 3+ days, at most once every 30 days
      const lastActive = Math.max(
        user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0,
        lastChatMap.get(user.id) ? Date.parse(lastChatMap.get(user.id)!) : 0,
        createdAt || 0
      );
      const lastInactivity = profile.inactivity_email_sent_at ? Date.parse(profile.inactivity_email_sent_at) : 0;
      if (
        createdAt && now - createdAt > 3 * DAY &&
        now - lastActive > 3 * DAY &&
        now - lastInactivity > 30 * DAY &&
        (pref?.reengagement_emails ?? true)
      ) {
        if (await send(user, "inactivity", inactivityEmail(firstName, code))) {
          updates.push({ id: user.id, patch: { inactivity_email_sent_at: new Date().toISOString() } });
        }
        continue;
      }

      // 3. Low-credit alert — active paid plan under 10 credits, at most once every 7 days
      const expired = profile.credits_expiry_date ? Date.parse(profile.credits_expiry_date) < now : true;
      const available = (profile.daily_credits ?? 0) + ((profile.plan_type !== "free" && !expired) ? profile.paid_credits ?? 0 : 0);
      const lastLowCredit = profile.low_credit_email_sent_at ? Date.parse(profile.low_credit_email_sent_at) : 0;
      if (
        profile.plan_type !== "free" && !expired &&
        available < 10 &&
        now - lastLowCredit > 7 * DAY &&
        (pref?.usage_reports ?? true)
      ) {
        if (await send(user, "low_credit", lowCreditEmail(firstName, available))) {
          updates.push({ id: user.id, patch: { low_credit_email_sent_at: new Date().toISOString() } });
        }
      }
    }

    // Persist sent markers in batches
    for (const u of updates) {
      await supabaseAdmin.from("profiles").update(u.patch).eq("id", u.id);
    }
    if (logs.length > 0) {
      await supabaseAdmin.from("email_logs").insert(logs);
    }

    return new Response(
      JSON.stringify({ ok: true, sent: logs.filter((l) => l.status === "sent").length, failed: logs.filter((l) => l.status === "failed").length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
