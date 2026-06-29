"use client";

import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const QuillNoSSRWrapper = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div style={{ height: 100, background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 13 }}>Loading editor...</div>,
});

const modules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"],
    ["clean"],
  ],
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

export function RichTextDisplay({ content }: { content: string }) {
  if (!content) return null;
  return (
    <div
      className="ql-editor rich-text-display"
      style={{ padding: 0, fontSize: 13, color: "#ccc", lineHeight: 1.85 }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
