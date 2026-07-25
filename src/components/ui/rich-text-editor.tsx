"use client";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import { uploadFile } from "@/lib/api";

const QuillNoSSRWrapper = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div style={{ height: 100, background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 13 }}>Loading editor...</div>,
});

/**
 * Upload the picked image to Cloudflare R2 and insert its URL — instead of Quill's default, which
 * embeds a huge base64 blob straight into the HTML. `this` is the Quill toolbar module, so
 * `this.quill` is the editor. Runs only in the browser (the toolbar button is a user action).
 */
async function imageHandler(this: { quill: { getSelection: (f?: boolean) => { index: number } | null; insertEmbed: (i: number, t: string, v: string, s: string) => void; setSelection: (i: number) => void } }) {
  const quill = this.quill;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
    try {
      const url = await uploadFile(file, token);
      const range = quill.getSelection(true);
      const index = range ? range.index : 0;
      quill.insertEmbed(index, "image", url, "user");
      quill.setSelection(index + 1);
    } catch {
      alert("Couldn't upload the image. Please try again.");
    }
  };
  input.click();
}

const modules = {
  toolbar: {
    container: [
      [{ header: [1, 2, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image"],
      ["clean"],
    ],
    handlers: { image: imageHandler },
  },
};

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "link",
  "image",
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rich-text-container">
      <style>{`
        .rich-text-container .quill {
          background: #111;
          border-radius: 10px;
          border: 1px solid #2a2a2a;
          color: #f0f0f0;
          overflow: hidden;
        }
        .rich-text-container .ql-toolbar {
          background: #1a1a1a;
          border: none;
          border-bottom: 1px solid #2a2a2a;
        }
        .rich-text-container .ql-container {
          border: none;
          font-family: inherit;
          font-size: 13px;
        }
        .rich-text-container .ql-editor {
          min-height: 100px;
          line-height: 1.65;
        }
        .rich-text-container .ql-editor.ql-blank::before {
          color: #555;
          font-style: normal;
        }
        .rich-text-container .ql-stroke {
          stroke: #ccc !important;
        }
        .rich-text-container .ql-fill {
          fill: #ccc !important;
        }
        .rich-text-container .ql-picker {
          color: #ccc !important;
        }
      `}</style>
      <QuillNoSSRWrapper
        theme="snow"
        modules={modules}
        formats={formats}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Quill emits `<p><br></p>` for every blank line, and the server sanitizer pretty-prints the HTML
 * with newlines between tags. Under Quill's `white-space: pre-wrap` those both render as large empty
 * gaps. We drop the blank paragraphs here (spacing then comes from CSS), and the display forces
 * `white-space: normal` so the pretty-print newlines collapse like ordinary HTML.
 */
function tidyHtml(html: string): string {
  if (!html) return html;
  return html.replace(/<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim();
}

/** Plain-text preview of rich HTML: tags stripped and common entities decoded (SSR-safe). */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function RichTextDisplay({ content }: { content: string }) {
  if (!content) return null;
  return (
    <>
      <style>{`
        .rich-text-display { line-height: 1.6; max-width: 100%; overflow-wrap: break-word; word-break: break-word; }
        .rich-text-display p { margin: 0 0 8px; }
        .rich-text-display p:last-child { margin-bottom: 0; }
        .rich-text-display h1, .rich-text-display h2, .rich-text-display h3 { color: #f0f0f0; margin: 12px 0 6px; line-height: 1.3; }
        .rich-text-display strong, .rich-text-display b { color: #eaeaea; }
        .rich-text-display blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #333; color: #aaa; }
        .rich-text-display img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
        .rich-text-display a { color: #f97316; }
        /* Lists: draw NATIVE markers so bullets survive even when the server-side sanitizer strips
           Quill's data-list attribute. Quill 2 puts both bullet and numbered items in <ol>, flagged
           by data-list; we hide Quill's ::before marker, default every item to a bullet (requirement
           lists are almost always bullets), and only switch to numbers when data-list says ordered. */
        .rich-text-display ul, .rich-text-display ol { margin: 6px 0; padding-left: 1.5em; }
        .rich-text-display li { margin: 3px 0; padding-left: 0; list-style-position: outside; list-style-type: disc; }
        .rich-text-display li::before { content: none !important; }
        .rich-text-display li[data-list="ordered"] { list-style-type: decimal; }
        .rich-text-display ol.no-bullet > li, .rich-text-display ul.no-bullet > li { list-style-type: none; }
      `}</style>
      <div
        className="ql-editor rich-text-display"
        style={{ padding: 0, fontSize: 13, color: "#ccc", whiteSpace: "normal" }}
        dangerouslySetInnerHTML={{ __html: tidyHtml(content) }}
      />
    </>
  );
}
