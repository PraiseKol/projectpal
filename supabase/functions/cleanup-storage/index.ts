import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      ppt_images_deleted: 0,
      old_documents_deleted: 0,
      errors: [] as string[],
    };

    // 1. Delete all PNG files across all user folders using a DB query to get paths
    // We query storage.objects for all .png files in the documents bucket
    const { data: pngObjects, error: pngQueryError } = await supabaseClient
      .rpc('get_png_storage_paths' as any) // fallback: use direct approach below
      .select('*')
      .limit(1);

    // Since rpc may not exist, use the storage list approach per user folder
    const { data: rootFiles, error: rootError } = await supabaseClient.storage
      .from('documents')
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

    if (rootError) {
      results.errors.push(`Root list error: ${rootError.message}`);
    } else if (rootFiles) {
      // Get all user UUID folders
      const userFolders = rootFiles.filter(f => f.id === null); // folders have no id

      for (const folder of userFolders) {
        try {
          // List ppt-images subfolder
          const { data: pptImages } = await supabaseClient.storage
            .from('documents')
            .list(`${folder.name}/ppt-images`, { limit: 1000 });

          if (pptImages && pptImages.length > 0) {
            const paths = pptImages.map(f => `${folder.name}/ppt-images/${f.name}`);
            const { error: deleteErr } = await supabaseClient.storage
              .from('documents')
              .remove(paths);
            if (deleteErr) {
              results.errors.push(`Delete ppt-images error: ${deleteErr.message}`);
            } else {
              results.ppt_images_deleted += paths.length;
              console.log(`[CLEANUP] Deleted ${paths.length} PNG files from ${folder.name}/ppt-images`);
            }
          }

          // Also check for loose PNG files in the user folder root
          const { data: folderFiles } = await supabaseClient.storage
            .from('documents')
            .list(folder.name, { limit: 1000 });

          if (folderFiles) {
            const loosePngs = folderFiles
              .filter(f => f.name.endsWith('.png'))
              .map(f => `${folder.name}/${f.name}`);

            if (loosePngs.length > 0) {
              const { error: loosePngErr } = await supabaseClient.storage
                .from('documents')
                .remove(loosePngs);
              if (!loosePngErr) {
                results.ppt_images_deleted += loosePngs.length;
              }
            }
          }
        } catch (e) {
          results.errors.push(`Folder ${folder.name} error: ${e}`);
        }
      }
    }

    // 2. Delete documents (PDFs and PPTXs) older than 30 days from DB
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldDocs, error: oldDocsError } = await supabaseClient
      .from('documents')
      .select('id, file_url, file_name')
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (oldDocsError) {
      results.errors.push(`Old docs query error: ${oldDocsError.message}`);
    } else if (oldDocs && oldDocs.length > 0) {
      for (const doc of oldDocs) {
        try {
          // Extract storage path from file_url
          const urlParts = doc.file_url?.split('/documents/');
          if (urlParts && urlParts.length > 1) {
            const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
            await supabaseClient.storage.from('documents').remove([storagePath]);
          }
          await supabaseClient.from('documents').delete().eq('id', doc.id);
          results.old_documents_deleted++;
        } catch (e) {
          results.errors.push(`Doc delete error for ${doc.id}: ${e}`);
        }
      }
      console.log(`[CLEANUP] Deleted ${results.old_documents_deleted} old documents from DB`);
    }

    // 3. Delete old PPTX files from storage older than 30 days
    const { data: rootFiles2 } = await supabaseClient.storage
      .from('documents')
      .list('', { limit: 1000 });

    if (rootFiles2) {
      for (const folder of rootFiles2.filter(f => f.id === null)) {
        const { data: files } = await supabaseClient.storage
          .from('documents')
          .list(folder.name, { limit: 1000 });

        if (files) {
          const oldPptFiles = files.filter(f => {
            if (!f.updated_at) return false;
            const fileDate = new Date(f.updated_at);
            return fileDate < thirtyDaysAgo && (f.name.endsWith('.pptx') || f.name.endsWith('.pdf'));
          }).map(f => `${folder.name}/${f.name}`);

          if (oldPptFiles.length > 0) {
            const { error } = await supabaseClient.storage
              .from('documents')
              .remove(oldPptFiles);
            if (!error) {
              results.old_documents_deleted += oldPptFiles.length;
              console.log(`[CLEANUP] Deleted ${oldPptFiles.length} old files from ${folder.name}`);
            }
          }
        }
      }
    }

    // 4. Delete payment screenshots older than 90 days (3 months)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: screenshotFolders } = await supabaseClient.storage
      .from('payment-screenshots')
      .list('', { limit: 1000 });

    let screenshotsDeleted = 0;
    if (screenshotFolders) {
      for (const folder of screenshotFolders) {
        try {
          // Each folder is a payout ID
          const isFolder = folder.id === null;
          if (isFolder) {
            const { data: files } = await supabaseClient.storage
              .from('payment-screenshots')
              .list(folder.name, { limit: 1000 });

            if (files) {
              const oldFiles = files.filter(f => {
                if (!f.updated_at) return false;
                return new Date(f.updated_at) < ninetyDaysAgo;
              }).map(f => `${folder.name}/${f.name}`);

              if (oldFiles.length > 0) {
                const { error } = await supabaseClient.storage
                  .from('payment-screenshots')
                  .remove(oldFiles);
                if (!error) {
                  screenshotsDeleted += oldFiles.length;
                  // Also clear the URL from commission_payouts
                  // We can't easily match file to payout, so we clear all payouts with screenshots older than 90 days
                }
              }
            }
          } else if (folder.updated_at && new Date(folder.updated_at) < ninetyDaysAgo) {
            // Root-level file
            const { error } = await supabaseClient.storage
              .from('payment-screenshots')
              .remove([folder.name]);
            if (!error) screenshotsDeleted++;
          }
        } catch (e) {
          results.errors.push(`Screenshot cleanup error: ${e}`);
        }
      }
    }

    // Clear payment_screenshot_url for payouts older than 90 days
    await supabaseClient
      .from('commission_payouts')
      .update({ payment_screenshot_url: null })
      .lt('created_at', ninetyDaysAgo.toISOString())
      .not('payment_screenshot_url', 'is', null);

    if (screenshotsDeleted > 0) {
      console.log(`[CLEANUP] Deleted ${screenshotsDeleted} payment screenshots older than 90 days`);
    }

    console.log('[CLEANUP] Completed:', results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CLEANUP] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Cleanup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
