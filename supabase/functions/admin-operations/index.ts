import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Get user's auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      case "getUserEmails": {
        // Fetch user emails from auth.users (requires service role)
        const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000
        });
        
        if (error) throw error;
        
        // Create a map of user_id -> email
        const emailMap: Record<string, string> = {};
        authUsers.users.forEach(u => {
          emailMap[u.id] = u.email || '';
        });
        
        result = { emailMap };
        break;
      }

      case "adjustCredits": {
        const { targetUserId, creditAmount, creditType, reason } = params;
        
        // Get current profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", targetUserId)
          .single();
        
        if (profileError) throw profileError;
        
        // Calculate new credits
        let updateData: Record<string, number> = {};
        if (creditType === "daily") {
          updateData.daily_credits = Math.max(0, (profile.daily_credits || 0) + creditAmount);
        } else if (creditType === "paid") {
          updateData.paid_credits = Math.max(0, (profile.paid_credits || 0) + creditAmount);
        }
        
        // Update profile
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("id", targetUserId);
        
        if (updateError) throw updateError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "adjust_credits",
          target_user_id: targetUserId,
          details: { creditAmount, creditType, reason, previousValue: profile[creditType === "daily" ? "daily_credits" : "paid_credits"] }
        });
        
        result = { success: true, newCredits: updateData };
        break;
      }

      case "updatePlan": {
        const { targetUserId, newPlan, reason } = params;
        
        // Get current plan
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("plan_type")
          .eq("id", targetUserId)
          .single();
        
        if (profileError) throw profileError;
        
        // Update plan
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ plan_type: newPlan })
          .eq("id", targetUserId);
        
        if (updateError) throw updateError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "update_plan",
          target_user_id: targetUserId,
          details: { newPlan, previousPlan: profile.plan_type, reason }
        });
        
        result = { success: true, newPlan };
        break;
      }

      case "toggleUserStatus": {
        const { targetUserId, newStatus, reason } = params;
        
        // Get current status
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("status")
          .eq("id", targetUserId)
          .single();
        
        if (profileError) throw profileError;
        
        // Update status
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ status: newStatus })
          .eq("id", targetUserId);
        
        if (updateError) throw updateError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "toggle_status",
          target_user_id: targetUserId,
          details: { newStatus, previousStatus: profile.status || 'active', reason }
        });
        
        result = { success: true, newStatus };
        break;
      }

      case "assignRole": {
        const { targetUserId, role, reason } = params;
        
        // Check if role already exists
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("*")
          .eq("user_id", targetUserId)
          .eq("role", role)
          .maybeSingle();
        
        if (existingRole) {
          result = { success: false, error: "Role already assigned" };
          break;
        }
        
        // Insert role
        const { error: insertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: targetUserId, role });
        
        if (insertError) throw insertError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "assign_role",
          target_user_id: targetUserId,
          details: { role, reason }
        });
        
        result = { success: true };
        break;
      }

      case "removeRole": {
        const { targetUserId, role, reason } = params;
        
        // Prevent removing own admin role
        if (targetUserId === user.id && role === "admin") {
          result = { success: false, error: "Cannot remove your own admin role" };
          break;
        }
        
        // Delete role
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", role);
        
        if (deleteError) throw deleteError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "remove_role",
          target_user_id: targetUserId,
          details: { role, reason }
        });
        
        result = { success: true };
        break;
      }

      case "getAuditLog": {
        const { limit = 100 } = params;
        
        const { data: logs, error } = await supabaseAdmin
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        
        result = { logs };
        break;
      }

      case "getActivityStats": {
        // Get document count
        const { count: documentCount } = await supabaseAdmin
          .from("documents")
          .select("*", { count: "exact", head: true });
        
        // Get chat session count
        const { count: chatCount } = await supabaseAdmin
          .from("chat_sessions")
          .select("*", { count: "exact", head: true });
        
        // Get message count
        const { count: messageCount } = await supabaseAdmin
          .from("messages")
          .select("*", { count: "exact", head: true });
        
        // Get analysis session count
        const { count: analysisCount } = await supabaseAdmin
          .from("analysis_sessions")
          .select("*", { count: "exact", head: true });
        
        // Get paraphrase count
        const { count: paraphraseCount } = await supabaseAdmin
          .from("paraphrase_logs")
          .select("*", { count: "exact", head: true });
        
        // Get recent signups (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: recentSignups } = await supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo.toISOString());
        
        // Get active users (24h) - users with chat activity
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const { data: activeSessions } = await supabaseAdmin
          .from("chat_sessions")
          .select("user_id")
          .gte("updated_at", oneDayAgo.toISOString());
        
        const activeUsers = new Set(activeSessions?.map(s => s.user_id)).size;
        
        result = {
          documentCount: documentCount || 0,
          chatCount: chatCount || 0,
          messageCount: messageCount || 0,
          analysisCount: analysisCount || 0,
          paraphraseCount: paraphraseCount || 0,
          recentSignups: recentSignups || 0,
          activeUsers24h: activeUsers
        };
        break;
      }

      case "getRecentActivity": {
        const { limit = 50 } = params;
        
        // Get recent documents
        const { data: recentDocs } = await supabaseAdmin
          .from("documents")
          .select("id, user_id, file_name, document_type, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        
        // Get recent chat sessions
        const { data: recentChats } = await supabaseAdmin
          .from("chat_sessions")
          .select("id, user_id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        
        // Get recent analyses
        const { data: recentAnalyses } = await supabaseAdmin
          .from("analysis_sessions")
          .select("id, user_id, file_name, analyses_run, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        
        result = {
          recentDocuments: recentDocs || [],
          recentChats: recentChats || [],
          recentAnalyses: recentAnalyses || []
        };
        break;
      }

      case "getUserGrowthData": {
        // Get user signups by day for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("created_at")
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: true });
        
        // Group by date
        const growthData: Record<string, number> = {};
        profiles?.forEach(p => {
          const date = new Date(p.created_at).toISOString().split('T')[0];
          growthData[date] = (growthData[date] || 0) + 1;
        });
        
        // Convert to array
        const growthArray = Object.entries(growthData).map(([date, count]) => ({
          date,
          signups: count
        }));
        
        result = { growthData: growthArray };
        break;
      }

      case "getRevenueData": {
        // Get revenue by day for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: transactions } = await supabaseAdmin
          .from("transactions")
          .select("amount, created_at")
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: true });
        
        // Group by date
        const revenueData: Record<string, number> = {};
        transactions?.forEach(t => {
          const date = new Date(t.created_at).toISOString().split('T')[0];
          revenueData[date] = (revenueData[date] || 0) + t.amount;
        });
        
        // Convert to array
        const revenueArray = Object.entries(revenueData).map(([date, amount]) => ({
          date,
          revenue: amount
        }));
        
        result = { revenueData: revenueArray };
        break;
      }

      case "updateAppSetting": {
        const { key, value, reason } = params;
        
        // Upsert the setting
        const { error } = await supabaseAdmin
          .from("app_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        
        if (error) throw error;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "update_setting",
          details: { key, value, reason }
        });
        
        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Admin operation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
