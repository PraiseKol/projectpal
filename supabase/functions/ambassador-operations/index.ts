import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a unique referral code
function generateReferralCode(firstName: string): string {
  const prefix = (firstName || "AMB").toUpperCase().slice(0, 4);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
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

    const { action, ...params } = await req.json();
    let result;

    switch (action) {
      case "getMyReferralCode": {
        // Check if user is an ambassador
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get existing code or create new one
        let { data: codeData, error: codeError } = await supabaseAdmin
          .from("referral_codes")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!codeData) {
          // Get user's first name for code generation
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("first_name")
            .eq("id", user.id)
            .single();

          const code = generateReferralCode(profile?.first_name || "");

          const { data: newCode, error: insertError } = await supabaseAdmin
            .from("referral_codes")
            .insert({ user_id: user.id, code })
            .select()
            .single();

          if (insertError) throw insertError;
          codeData = newCode;
        }

        result = { referralCode: codeData };
        break;
      }

      case "getMyReferrals": {
        // Verify ambassador role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get referrals
        const { data: referrals, error } = await supabaseAdmin
          .from("referrals")
          .select("*")
          .eq("ambassador_user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get profile info for each referred user
        const referredUserIds = referrals?.map(r => r.referred_user_id) || [];
        let referralDetails: any[] = [];

        if (referredUserIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name, plan_type, created_at")
            .in("id", referredUserIds);

          referralDetails = referrals?.map(ref => {
            const profile = profiles?.find(p => p.id === ref.referred_user_id);
            return {
              ...ref,
              referred_user_name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User" : "User",
              referred_user_plan: profile?.plan_type || "free",
              referred_user_joined: profile?.created_at
            };
          }) || [];
        }

        result = { referrals: referralDetails };
        break;
      }

      case "getMyCommissions": {
        // Verify ambassador role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get all commissions
        const { data: commissions, error } = await supabaseAdmin
          .from("ambassador_commissions")
          .select("*")
          .eq("ambassador_user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get referred user names for each commission
        const referredUserIds = commissions?.map(c => c.referred_user_id) || [];
        let commissionsWithNames = commissions || [];

        if (referredUserIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", referredUserIds);

          commissionsWithNames = commissions?.map(commission => {
            const profile = profiles?.find(p => p.id === commission.referred_user_id);
            const firstName = profile?.first_name || "";
            const lastName = profile?.last_name || "";
            // Mask the name for privacy: "John D***"
            const maskedName = firstName 
              ? `${firstName} ${lastName ? lastName.charAt(0) + "***" : ""}`.trim()
              : "User";
            return {
              ...commission,
              referred_user_name: maskedName
            };
          }) || [];
        }

        // Calculate totals
        const pendingAmount = commissions?.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const claimedAmount = commissions?.filter(c => c.status === "claimed").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const paidAmount = commissions?.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const totalEarnings = pendingAmount + claimedAmount + paidAmount;

        result = {
          commissions: commissionsWithNames,
          summary: {
            pendingAmount,
            claimedAmount,
            paidAmount,
            totalEarnings
          }
        };
        break;
      }

      case "getMyPayouts": {
        // Verify ambassador role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: payouts, error } = await supabaseAdmin
          .from("commission_payouts")
          .select("*")
          .eq("ambassador_user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        result = { payouts };
        break;
      }

      case "requestPayout": {
        // Verify ambassador role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check for existing pending payout request
        const { data: existingPayout } = await supabaseAdmin
          .from("commission_payouts")
          .select("id")
          .eq("ambassador_user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (existingPayout) {
          return new Response(JSON.stringify({ error: "You already have a pending payout request" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get pending commissions
        const { data: pendingCommissions, error: commError } = await supabaseAdmin
          .from("ambassador_commissions")
          .select("id, commission_amount")
          .eq("ambassador_user_id", user.id)
          .eq("status", "pending");

        if (commError) throw commError;

        const totalPending = pendingCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;

        if (totalPending === 0) {
          return new Response(JSON.stringify({ error: "No pending commissions to claim" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update commissions to claimed status
        const commissionIds = pendingCommissions?.map(c => c.id) || [];
        await supabaseAdmin
          .from("ambassador_commissions")
          .update({ status: "claimed", claimed_at: new Date().toISOString() })
          .in("id", commissionIds);

        // Create payout request
        const { data: payout, error: payoutError } = await supabaseAdmin
          .from("commission_payouts")
          .insert({
            ambassador_user_id: user.id,
            amount: totalPending,
            status: "pending"
          })
          .select()
          .single();

        if (payoutError) throw payoutError;

        result = { success: true, payout, amount: totalPending };
        break;
      }

      case "getAmbassadorStats": {
        // Verify ambassador role
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (!roleData) {
          return new Response(JSON.stringify({ error: "Ambassador access required" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Self-performance check: warn if at risk of removal
        let performanceWarning: string | null = null;
        const { data: approvedReq } = await supabaseAdmin
          .from("ambassador_requests")
          .select("reviewed_at")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvedReq?.reviewed_at) {
          const approvalDate = new Date(approvedReq.reviewed_at);
          const now = new Date();
          const daysSinceApproval = Math.floor((now.getTime() - approvalDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceApproval >= 0) {
            // Current window start
            const completePeriods = Math.max(0, Math.floor(daysSinceApproval / 30));
            const windowStart = new Date(approvalDate.getTime() + completePeriods * 30 * 24 * 60 * 60 * 1000);
            
            const { count: windowReferrals } = await supabaseAdmin
              .from("referrals")
              .select("*", { count: "exact", head: true })
              .eq("ambassador_user_id", user.id)
              .gte("created_at", windowStart.toISOString());

            const daysLeft = 30 - (daysSinceApproval % 30);
            if ((windowReferrals ?? 0) < 10 && daysLeft <= 10) {
              performanceWarning = `You need ${10 - (windowReferrals ?? 0)} more referrals in the next ${daysLeft} days to maintain your ambassador status.`;
            }
          }
        }

        // Get referral count
        const { count: totalReferrals } = await supabaseAdmin
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("ambassador_user_id", user.id);

        // Get subscribed referral count (users who have paid)
        const { data: referrals } = await supabaseAdmin
          .from("referrals")
          .select("referred_user_id")
          .eq("ambassador_user_id", user.id);

        const referredUserIds = referrals?.map(r => r.referred_user_id) || [];
        let subscribedCount = 0;

        if (referredUserIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, plan_type")
            .in("id", referredUserIds)
            .neq("plan_type", "free");

          subscribedCount = profiles?.length || 0;
        }

        // Get all commission stats with transaction amounts
        const { data: allCommissions } = await supabaseAdmin
          .from("ambassador_commissions")
          .select("commission_amount, transaction_amount, status, created_at")
          .eq("ambassador_user_id", user.id);

        const pendingAmount = allCommissions?.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const claimedAmount = allCommissions?.filter(c => c.status === "claimed").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const paidAmount = allCommissions?.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
        const totalEarnings = pendingAmount + claimedAmount + paidAmount;
        const totalTransactionValue = allCommissions?.reduce((sum, c) => sum + c.transaction_amount, 0) || 0;
        const commissionCount = allCommissions?.length || 0;

        // Calculate conversion rate
        const conversionRate = (totalReferrals || 0) > 0 
          ? (subscribedCount / (totalReferrals || 1)) * 100 
          : 0;

        // Calculate average commission
        const averageCommission = commissionCount > 0 
          ? totalEarnings / commissionCount 
          : 0;

        // Calculate this month's earnings
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEarnings = allCommissions
          ?.filter(c => new Date(c.created_at) >= startOfMonth)
          .reduce((sum, c) => sum + c.commission_amount, 0) || 0;

        // Generate monthly earnings for the last 6 months
        const monthlyEarnings: { month: string; earnings: number; pending: number; paid: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
          const monthName = monthDate.toLocaleString('default', { month: 'short' });
          
          const monthCommissions = allCommissions?.filter(c => {
            const date = new Date(c.created_at);
            return date >= monthDate && date <= monthEnd;
          }) || [];

          monthlyEarnings.push({
            month: monthName,
            earnings: monthCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
            pending: monthCommissions.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0),
            paid: monthCommissions.filter(c => c.status === "paid" || c.status === "claimed").reduce((sum, c) => sum + c.commission_amount, 0),
          });
        }

        result = {
          totalReferrals: totalReferrals || 0,
          subscribedReferrals: subscribedCount,
          pendingCommission: pendingAmount,
          claimedCommission: claimedAmount,
          paidCommission: paidAmount,
          totalEarnings,
          conversionRate,
          averageCommission,
          thisMonthEarnings,
          totalTransactionValue,
          commissionCount,
          monthlyEarnings,
          performanceWarning
        };
        break;
      }

      case "validateReferralCode": {
        const { code } = params;

        if (!code) {
          result = { valid: false };
          break;
        }

        const { data: codeData, error } = await supabaseAdmin
          .from("referral_codes")
          .select("id, user_id, is_active")
          .eq("code", code.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();

        result = { valid: !!codeData, codeData };
        break;
      }

      case "requestAmbassadorRole": {
        const { phoneNumber, university } = params;

        // Check if already an ambassador
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "ambassador")
          .maybeSingle();

        if (existingRole) {
          return new Response(JSON.stringify({ error: "You are already an ambassador" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check for existing pending request
        const { data: existingReq } = await supabaseAdmin
          .from("ambassador_requests")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        if (existingReq) {
          return new Response(JSON.stringify({ error: "You already have a pending request" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: insertErr } = await supabaseAdmin
          .from("ambassador_requests")
          .insert({
            user_id: user.id,
            status: "pending",
            phone_number: phoneNumber || null,
            university: university || null,
          });

        if (insertErr) throw insertErr;

        result = { success: true };
        break;
      }

      case "getMyAmbassadorRequest": {
        const { data: reqData } = await supabaseAdmin
          .from("ambassador_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        result = { request: reqData };
        break;
      }

      case "setReferralCode": {
        const { code } = params;

        if (!code) {
          return new Response(JSON.stringify({ error: "Referral code is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if user already has a referral set
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("referred_by")
          .eq("id", user.id)
          .single();

        if (profile?.referred_by) {
          return new Response(JSON.stringify({ error: "Referral code already set" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate code
        const { data: codeData } = await supabaseAdmin
          .from("referral_codes")
          .select("user_id, code")
          .eq("code", code.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();

        if (!codeData) {
          return new Response(JSON.stringify({ error: "Invalid or inactive referral code" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Prevent self-referral
        if (codeData.user_id === user.id) {
          return new Response(JSON.stringify({ error: "Cannot use your own referral code" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update profile
        await supabaseAdmin
          .from("profiles")
          .update({ referred_by: codeData.user_id })
          .eq("id", user.id);

        // Create referral record
        await supabaseAdmin
          .from("referrals")
          .insert({
            ambassador_user_id: codeData.user_id,
            referred_user_id: user.id,
            referral_code_used: code.toUpperCase(),
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
    console.error("Ambassador operation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
