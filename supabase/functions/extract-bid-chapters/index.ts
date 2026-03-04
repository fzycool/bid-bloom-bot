import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Chapter {
  section_number: string;
  title: string;
  level: number;
  content?: string;
}

function extractDocxText(data: Uint8Array): string {
  const files = unzipSync(data);
  const xmlBytes = files["word/document.xml"];
  if (!xmlBytes) throw new Error("Invalid DOCX: missing document.xml");
  const xml = new TextDecoder().decode(xmlBytes);
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitTextByChapters(fullText: string, chapters: Chapter[]): Chapter[] {
  if (!chapters.length) return [];

  const located = chapters.map((ch) => {
    // Try multiple patterns to find the chapter title in text
    const patterns = [
      `${ch.section_number} ${ch.title}`,
      `${ch.section_number}  ${ch.title}`,
      `${ch.section_number}\t${ch.title}`,
      `${ch.section_number}、${ch.title}`,
      `${ch.section_number}.${ch.title}`,
      `${ch.section_number} `,
      ch.title,
    ];
    let pos = -1;
    for (const p of patterns) {
      const idx = fullText.indexOf(p);
      if (idx >= 0) {
        pos = idx;
        break;
      }
    }
    return { ...ch, position: pos };
  });

  // Keep only found chapters, sorted by position
  const found = located
    .filter((ch) => ch.position >= 0)
    .sort((a, b) => a.position - b.position);

  // Remove duplicates at same position
  const unique: typeof found = [];
  for (const ch of found) {
    if (!unique.length || ch.position !== unique[unique.length - 1].position) {
      unique.push(ch);
    }
  }

  // Extract content between consecutive chapter positions
  return unique.map((ch, i) => {
    const start = ch.position;
    const end = i + 1 < unique.length ? unique[i + 1].position : fullText.length;
    return {
      section_number: ch.section_number,
      title: ch.title,
      level: ch.level,
      content: fullText.substring(start, end).trim(),
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();
    if (!filePath) throw new Error("filePath is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("company-materials")
      .download(filePath);
    if (dlErr) throw new Error(`下载文件失败: ${dlErr.message}`);

    const buf = await fileData.arrayBuffer();
    let fullText = "";

    if (filePath.toLowerCase().endsWith(".docx")) {
      fullText = extractDocxText(new Uint8Array(buf));
    } else {
      throw new Error("目前仅支持DOCX格式文件");
    }

    if (fullText.length < 50) {
      throw new Error("文档内容过少，无法提取章节结构");
    }

    // Truncate for AI
    const forAI = fullText.length > 80000 ? fullText.substring(0, 80000) : fullText;

    const systemPrompt = `你是专业的文档结构分析师。请分析以下文档内容，提取完整的章节目录结构。
只提取标题结构，不需要内容。注意识别所有层级的标题（一级、二级、三级等）。
要求：按照文档中实际编号和顺序列出，section_number使用文档原始编号。`;

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "extract_chapters",
          description: "提取文档的章节目录结构",
          parameters: {
            type: "object",
            properties: {
              chapters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    section_number: {
                      type: "string",
                      description: "章节编号，如 1, 1.1, 2.3.1, 第一章",
                    },
                    title: {
                      type: "string",
                      description: "章节标题（不含编号）",
                    },
                    level: {
                      type: "integer",
                      description: "标题层级，1为一级标题，2为二级，以此类推",
                    },
                  },
                  required: ["section_number", "title", "level"],
                  additionalProperties: false,
                },
              },
            },
            required: ["chapters"],
            additionalProperties: false,
          },
        },
      },
    ];

    let chapters: Chapter[] = [];

    // Try Lovable AI first
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);

        const resp = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: forAI },
              ],
              tools,
              tool_choice: {
                type: "function",
                function: { name: "extract_chapters" },
              },
              max_tokens: 8192,
              temperature: 0.1,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timer);

        if (resp.status === 429)
          throw new Error("Rate limited, please try again later.");
        if (resp.status === 402)
          throw new Error("Payment required, please add credits.");

        if (resp.ok) {
          const data = await resp.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const args = JSON.parse(toolCall.function.arguments);
            chapters = args.chapters || [];
          } else {
            // Fallback: try parsing content as JSON
            const content = data.choices?.[0]?.message?.content || "";
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              chapters = parsed.chapters || [];
            }
          }
        }
      } catch (e: any) {
        console.error("Lovable AI error:", e.message);
      }
    }

    // Fallback to configured model
    if (!chapters.length) {
      const { data: mc } = await supabase
        .from("model_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (mc?.api_key && mc?.base_url) {
        const resp = await fetch(`${mc.base_url}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mc.api_key}`,
          },
          body: JSON.stringify({
            model: mc.model_name,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: forAI },
            ],
            tools,
            tool_choice: {
              type: "function",
              function: { name: "extract_chapters" },
            },
            max_tokens: mc.max_tokens || 8192,
            temperature: 0.1,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const args = JSON.parse(toolCall.function.arguments);
            chapters = args.chapters || [];
          }
        }
      }
    }

    if (!chapters.length) {
      throw new Error("AI未能识别文档章节结构，请确认文档包含清晰的章节标题");
    }

    // Split original text by chapter titles to get content
    const result = splitTextByChapters(fullText, chapters);

    return new Response(
      JSON.stringify({ chapters: result, totalChapters: result.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
