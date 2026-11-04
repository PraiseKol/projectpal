import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText, Pencil, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  meta_description: string | null;
  keywords: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string;
}

const EMPTY_FORM = {
  id: "",
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  meta_description: "",
  keywords: "",
  published: false,
};

const slugify = (text: string) =>
  text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);

export const BlogManagement = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, content, meta_description, keywords, published, published_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setPosts((data as BlogPost[]) || []);
    } catch (error) {
      toast.error("Could not load blog posts. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? "",
      content: post.content,
      meta_description: post.meta_description ?? "",
      keywords: post.keywords ?? "",
      published: post.published,
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setIsSaving(true);
    try {
      const slug = form.slug.trim() ? slugify(form.slug) : slugify(form.title);
      const publishedAt = form.published && !isEditing ? new Date().toISOString() : undefined;
      const payload: Record<string, any> = {
        slug,
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        meta_description: form.meta_description.trim() || null,
        keywords: form.keywords.trim() || null,
        published: form.published,
      };
      if (publishedAt) payload.published_at = publishedAt;

      let error;
      if (isEditing && form.id) {
        ({ error } = await supabase.from("blog_posts").update(payload).eq("id", form.id));
      } else {
        ({ error } = await supabase.from("blog_posts").insert(payload));
      }
      if (error) {
        if (String(error.message).includes("duplicate")) {
          toast.error("That URL slug is already in use. Pick a different one.");
        } else {
          toast.error("Could not save the post. Try again.");
        }
        return;
      }
      toast.success(isEditing ? "Post updated" : "Post created");
      setDialogOpen(false);
      load();
    } catch {
      toast.error("Could not save the post. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublished = async (post: BlogPost) => {
    try {
      const patch: Record<string, any> = { published: !post.published };
      if (!post.published) patch.published_at = new Date().toISOString();
      const { error } = await supabase.from("blog_posts").update(patch).eq("id", post.id);
      if (error) throw error;
      toast.success(!post.published ? "Post is now live" : "Post moved to drafts");
      load();
    } catch {
      toast.error("Could not update the post. Try again.");
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
      if (error) throw error;
      toast.success("Post deleted");
      load();
    } catch {
      toast.error("Could not delete the post. Try again.");
    }
  };

  const previewUrl = (slug: string) => `${window.location.origin}/blog/${slug}`;

  return (
    <Card className="shadow-md rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Blog Management</CardTitle>
          <CardDescription>Draft, publish and edit SEO articles shown on the public blog</CardDescription>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Post
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading posts…
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No posts yet. Create your first article.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{post.title}</span>
                    <Badge variant={post.published ? "default" : "secondary"}>
                      {post.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">/blog/{post.slug}</p>
                  {post.excerpt && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{post.excerpt}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={post.published} onCheckedChange={() => togglePublished(post)} aria-label={`Publish toggle: ${post.title}`} />
                  {post.published && (
                    <Button variant="ghost" size="icon" asChild aria-label={`Preview: ${post.title}`}>
                      <a href={previewUrl(post.slug)} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(post)} aria-label={`Edit: ${post.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(post)} aria-label={`Delete: ${post.title}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Post" : "New Blog Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: isEditing ? f.slug : slugify(e.target.value) }))}
                placeholder="How to Write Chapter 3 of Your Project"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL slug</label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="how-to-write-chapter-3" />
            </div>
            <div>
              <label className="text-sm font-medium">Excerpt</label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                className="min-h-[60px]"
                placeholder="One or two sentences shown on the blog list page"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Content *</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="min-h-[260px] font-mono text-sm"
                placeholder="Write the article body here. Headings as numbered lines (e.g. 1. Introduction)."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Meta description (SEO)</label>
              <Input
                value={form.meta_description}
                onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
                placeholder="Up to 160 characters for search results"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Keywords (SEO)</label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder="chapter 3, methodology, research design"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} id="publish-toggle" />
              <label htmlFor="publish-toggle" className="text-sm font-medium cursor-pointer">
                Publish immediately
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save Changes" : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
