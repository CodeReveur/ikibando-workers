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
 * Collapse the empty paragraphs Quill leaves behind (each Enter with no text becomes
 * `<p><br></p>`). Two or more in a row render as a big gap the author never intended, so we
 * squash runs of them to a single blank line and trim any at the very start/end.
 */
function tidyHtml(html: string): string {
  const EMPTY = /<p>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>/gi;
  return html
    .replace(new RegExp(`(?:${EMPTY.source}\\s*){2,}`, "gi"), "<p><br></p>")
    .replace(new RegExp(`^(?:\\s*${EMPTY.source}\\s*)+`, "i"), "")
    .replace(new RegExp(`(?:\\s*${EMPTY.source}\\s*)+$`, "i"), "")
    .trim();
}

export function RichTextDisplay({ content }: { content: string }) {
  if (!content) return null;
  return (
    <>
      <style>{`
        .rich-text-display { line-height: 1.55; }
        .rich-text-display p { margin: 0 0 6px; }
        .rich-text-display p:last-child { margin-bottom: 0; }
        .rich-text-display p > br:only-child { line-height: 1; }
        .rich-text-display ul, .rich-text-display ol { margin: 4px 0; padding-left: 1.4em; }
        .rich-text-display li { margin: 1px 0; padding-left: 0; }
        .rich-text-display h1, .rich-text-display h2 { color: #f0f0f0; margin: 10px 0 6px; line-height: 1.3; }
        .rich-text-display blockquote { margin: 6px 0; padding-left: 12px; border-left: 3px solid #333; color: #aaa; }
        .rich-text-display img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
        .rich-text-display a { color: #f97316; }
      `}</style>
      <div
        className="ql-editor rich-text-display"
        style={{ padding: 0, fontSize: 13, color: "#ccc" }}
        dangerouslySetInnerHTML={{ __html: tidyHtml(content) }}
      />
    </>
  );
}
