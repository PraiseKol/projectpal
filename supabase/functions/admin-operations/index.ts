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

    // Verify admin or super_admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"]);

    if (roleError || !roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRoles = roleData.map((r: any) => r.role);
    const isSuperAdmin = userRoles.includes("super_admin");

    // Role hierarchy for permission checks
    const roleHierarchy: Record<string, number> = {
      user: 0,
      ambassador: 1,
      moderator: 2,
      admin: 3,
      super_admin: 4
    };

    function canAssignRole(targetRole: string): boolean {
      if (isSuperAdmin) return true;
      // Admin can assign moderator, ambassador, user
      return ["moderator", "ambassador", "user"].includes(targetRole);
    }

    function canRemoveRole(targetRole: string, targetUserId: string): boolean {
      if (isSuperAdmin) return true;
      // Prevent removing own admin role
      if (user && targetUserId === user.id && targetRole === "admin") return false;
      // Admin can remove moderator, ambassador roles
      return ["moderator", "ambassador"].includes(targetRole);
    }

    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      case "getAllProfiles": {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = { profiles: data };
        break;
      }

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
        } else if (creditType === "monthly") {
          updateData.monthly_credits = Math.max(0, (profile.monthly_credits || 0) + creditAmount);
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
        const { targetUserId, newPlan, expiryDate, reason } = params;
        
        // Get current plan
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("plan_type")
          .eq("id", targetUserId)
          .single();
        
        if (profileError) throw profileError;
        
        // Calculate expiry date
        let creditsExpiryDate: string | null = null;
        if (newPlan !== "free") {
          if (expiryDate) {
            creditsExpiryDate = new Date(expiryDate).toISOString();
          } else {
            const defaultExpiry = new Date();
            defaultExpiry.setDate(defaultExpiry.getDate() + 30);
            creditsExpiryDate = defaultExpiry.toISOString();
          }
        }
        
        // Update plan and expiry
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ plan_type: newPlan, credits_expiry_date: creditsExpiryDate })
          .eq("id", targetUserId);
        
        if (updateError) throw updateError;
        
        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "update_plan",
          target_user_id: targetUserId,
          details: { newPlan, previousPlan: profile.plan_type, creditsExpiryDate, reason }
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
        
        // Check permissions
        if (!canAssignRole(role)) {
          result = { success: false, error: `You don't have permission to assign the ${role} role` };
          break;
        }
        
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

        // If assigning ambassador role, generate referral code
        if (role === "ambassador") {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("first_name")
            .eq("id", targetUserId)
            .single();
          
          const prefix = ((profile?.first_name || "AMB") as string).toUpperCase().slice(0, 4);
          const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const code = `${prefix}${suffix}`;

          await supabaseAdmin
            .from("referral_codes")
            .upsert({ user_id: targetUserId, code }, { onConflict: "user_id" });
        }
        
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
        
        // Check permissions
        if (!canRemoveRole(role, targetUserId)) {
          result = { success: false, error: `You don't have permission to remove the ${role} role` };
          break;
        }
        
        // Delete role
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", role);
        
        if (deleteError) throw deleteError;

        // If removing ambassador role, deactivate referral code
        if (role === "ambassador") {
          await supabaseAdmin
            .from("referral_codes")
            .update({ is_active: false })
            .eq("user_id", targetUserId);
        }
        
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

      case "getAmbassadorOverview": {
        // Get all ambassadors
        const { data: ambassadorRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "ambassador");

        const ambassadorIds = ambassadorRoles?.map(r => r.user_id) || [];
        
        // Get ambassador profiles
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", ambassadorIds);

        // Get referral codes
        const { data: codes } = await supabaseAdmin
          .from("referral_codes")
          .select("*")
          .in("user_id", ambassadorIds);

        // Get referral counts
        const { data: referrals } = await supabaseAdmin
          .from("referrals")
          .select("ambassador_user_id");

        const referralCounts: Record<string, number> = {};
        referrals?.forEach(r => {
          referralCounts[r.ambassador_user_id] = (referralCounts[r.ambassador_user_id] || 0) + 1;
        });

        // Get commission totals
        const { data: commissions } = await supabaseAdmin
          .from("ambassador_commissions")
          .select("ambassador_user_id, commission_amount, status");

        const commissionStats: Record<string, { pending: number; claimed: number; paid: number }> = {};
        commissions?.forEach(c => {
          if (!commissionStats[c.ambassador_user_id]) {
            commissionStats[c.ambassador_user_id] = { pending: 0, claimed: 0, paid: 0 };
          }
          commissionStats[c.ambassador_user_id][c.status as "pending" | "claimed" | "paid"] += c.commission_amount;
        });

        // Build ambassador list
        const ambassadors = ambassadorIds.map(id => {
          const profile = profiles?.find(p => p.id === id);
          const code = codes?.find(c => c.user_id === id);
          const stats = commissionStats[id] || { pending: 0, claimed: 0, paid: 0 };
          
          return {
            id,
            name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown",
            email: "",
            referralCode: code?.code || "",
            isActive: code?.is_active ?? true,
            totalReferrals: referralCounts[id] || 0,
            pendingCommission: stats.pending,
            claimedCommission: stats.claimed,
            paidCommission: stats.paid,
            totalEarnings: stats.pending + stats.claimed + stats.paid
          };
        });

        // Get totals
        const totalAmbassadors = ambassadorIds.length;
        const totalReferrals = Object.values(referralCounts).reduce((sum, c) => sum + c, 0);
        const totalCommissions = commissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const pendingPayouts = commissions?.filter(c => c.status === "claimed").reduce((sum, c) => sum + c.commission_amount, 0) || 0;

        result = {
          ambassadors,
          summary: {
            totalAmbassadors,
            totalReferrals,
            totalCommissions,
            pendingPayouts
          }
        };
        break;
      }

      case "getPayoutRequests": {
        const { status = "pending" } = params;

        const query = supabaseAdmin
          .from("commission_payouts")
          .select("*")
          .order("created_at", { ascending: false });

        if (status !== "all") {
          query.eq("status", status);
        }

        const { data: payouts, error } = await query;
        if (error) throw error;

        // Get ambassador names
        const ambassadorIds = [...new Set(payouts?.map(p => p.ambassador_user_id) || [])];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", ambassadorIds);

        const payoutsWithNames = payouts?.map(p => {
          const profile = profiles?.find(pr => pr.id === p.ambassador_user_id);
          return {
            ...p,
            ambassador_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown"
          };
        });

        result = { payouts: payoutsWithNames };
        break;
      }

      case "processPayoutRequest": {
        const { payoutId, newStatus, notes, paymentMethod, paymentReference } = params;

        if (!isSuperAdmin && newStatus === "paid") {
          result = { success: false, error: "Only super admins can mark payouts as paid" };
          break;
        }

        const updateData: Record<string, any> = {
          status: newStatus,
          admin_user_id: user.id,
          processed_at: new Date().toISOString()
        };

        if (notes) updateData.admin_notes = notes;
        if (paymentMethod) updateData.payment_method = paymentMethod;
        if (paymentReference) updateData.payment_reference = paymentReference;

        const { data: payout, error } = await supabaseAdmin
          .from("commission_payouts")
          .update(updateData)
          .eq("id", payoutId)
          .select()
          .single();

        if (error) throw error;

        // If paid, update commission status
        if (newStatus === "paid") {
          await supabaseAdmin
            .from("ambassador_commissions")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("ambassador_user_id", payout.ambassador_user_id)
            .eq("status", "claimed");
        }

        // If rejected, revert commissions to pending
        if (newStatus === "rejected") {
          await supabaseAdmin
            .from("ambassador_commissions")
            .update({ status: "pending", claimed_at: null })
            .eq("ambassador_user_id", payout.ambassador_user_id)
            .eq("status", "claimed");
        }

        // Log the action
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "process_payout",
          target_user_id: payout.ambassador_user_id,
          details: { payoutId, newStatus, amount: payout.amount, notes }
        });

        result = { success: true, payout };
        break;
      }

      case "getAmbassadorRequests": {
        const { status: reqStatus = "pending" } = params;

        const query = supabaseAdmin
          .from("ambassador_requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (reqStatus !== "all") {
          query.eq("status", reqStatus);
        }

        const { data: requests, error: reqErr } = await query;
        if (reqErr) throw reqErr;

        // Get user profiles
        const userIds = [...new Set(requests?.map(r => r.user_id) || [])];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);

        // Get emails
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const emailMap: Record<string, string> = {};
        authUsers?.users?.forEach(u => { emailMap[u.id] = u.email || ''; });

        const requestsWithInfo = requests?.map(r => {
          const profile = profiles?.find(p => p.id === r.user_id);
          return {
            ...r,
            user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown",
            user_email: emailMap[r.user_id] || "",
          };
        });

        result = { requests: requestsWithInfo };
        break;
      }

      case "approveAmbassadorRequest": {
        const { requestId } = params;

        // Get the request
        const { data: request, error: getErr } = await supabaseAdmin
          .from("ambassador_requests")
          .select("*")
          .eq("id", requestId)
          .single();

        if (getErr || !request) throw getErr || new Error("Request not found");

        // Update request status
        await supabaseAdmin
          .from("ambassador_requests")
          .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .eq("id", requestId);

        // Add ambassador role
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: request.user_id, role: "ambassador" });

        // Generate referral code
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("first_name")
          .eq("id", request.user_id)
          .single();

        const prefix = ((profile?.first_name || "AMB") as string).toUpperCase().slice(0, 4);
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `${prefix}${suffix}`;

        await supabaseAdmin
          .from("referral_codes")
          .upsert({ user_id: request.user_id, code }, { onConflict: "user_id" });

        // Log
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "approve_ambassador_request",
          target_user_id: request.user_id,
          details: { requestId }
        });

        result = { success: true };
        break;
      }

      case "declineAmbassadorRequest": {
        const { requestId, notes } = params;

        await supabaseAdmin
          .from("ambassador_requests")
          .update({ 
            status: "declined", 
            reviewed_by: user.id, 
            reviewed_at: new Date().toISOString(),
            admin_notes: notes || null
          })
          .eq("id", requestId);

        // Log
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action_type: "decline_ambassador_request",
          details: { requestId, notes }
        });

        result = { success: true };
        break;
      }

      case "getRoleHierarchy": {
        result = {
          hierarchy: roleHierarchy,
          currentUserRoles: userRoles,
          isSuperAdmin
        };
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
