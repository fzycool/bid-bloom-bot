import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  Star,
  StarOff,
  Download,
  Plus,
  LayoutTemplate,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResumeTemplate {
  id: string;
  template_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string | null;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export default function ResumeTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("resume_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error) setTemplates((data as ResumeTemplate[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    if (!templateName.trim()) {
      toast({ title: "请输入模板名称", variant: "destructive" });
      return;
    }

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["docx", "doc"].includes(ext || "")) {
      toast({ title: "仅支持DOCX格式", description: "请上传Word文档模板", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${user.id}/${Date.now()}_template.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("resume-templates")
        .upload(storagePath, selectedFile);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("resume_templates").insert({
        user_id: user.id,
        template_name: templateName.trim(),
        file_name: selectedFile.name,
        file_path: storagePath,
        file_size: selectedFile.size,
        file_type: selectedFile.type || null,
        description: description.trim() || null,
        is_default: templates.length === 0,
      });
      if (insertErr) throw insertErr;

      toast({ title: "模板上传成功" });
      setShowAdd(false);
      setTemplateName("");
      setDescription("");
      setSelectedFile(null);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (t: ResumeTemplate) => {
    await supabase.storage.from("resume-templates").remove([t.file_path]);
    const { error } = await supabase.from("resume_templates").delete().eq("id", t.id);
    if (error) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    } else {
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      toast({ title: "已删除" });
    }
  };

  const handleSetDefault = async (t: ResumeTemplate) => {
    // Unset all defaults first, then set the selected one
    await supabase.from("resume_templates").update({ is_default: false }).eq("user_id", user!.id);
    await supabase.from("resume_templates").update({ is_default: true }).eq("id", t.id);
    fetchTemplates();
    toast({ title: `已设为默认模板: ${t.template_name}` });
  };

  const handleDownload = async (t: ResumeTemplate) => {
    const { data, error } = await supabase.storage
      .from("resume-templates")
      .createSignedUrl(t.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "下载失败", variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = t.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-accent" />
            简历模板库
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            管理投标简历的Word模板，不同项目可选用不同模板
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          上传模板
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <LayoutTemplate className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无模板</p>
            <p className="text-sm">点击「上传模板」添加Word简历模板（.docx格式）</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="overflow-hidden hover:shadow-card-hover transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground truncate">{t.template_name}</p>
                      {t.is_default && (
                        <Badge variant="secondary" className="text-xs shrink-0">默认</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.file_name}</p>
                  </div>
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}

                <p className="text-xs text-muted-foreground">
                  {formatSize(t.file_size)} · {new Date(t.created_at).toLocaleDateString("zh-CN")}
                </p>

                <div className="flex items-center gap-1 pt-1 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleDownload(t)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleSetDefault(t)}
                    disabled={t.is_default}
                  >
                    {t.is_default ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
                    {t.is_default ? "默认" : "设为默认"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => handleDelete(t)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>上传简历模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>模板名称 *</Label>
              <Input
                placeholder="如：XX项目简历模板"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>备注说明</Label>
              <Textarea
                placeholder="描述该模板的适用场景，如：适用于信息化项目投标"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>模板文件（.docx）*</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      if (!templateName) setTemplateName(f.name.replace(/\.[^.]+$/, ""));
                    }
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-5 h-5 text-accent" />
                    <span className="text-foreground font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({formatSize(selectedFile.size)})</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">点击选择或拖拽DOCX文件</p>
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !templateName.trim()}
              className="w-full gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              上传模板
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
