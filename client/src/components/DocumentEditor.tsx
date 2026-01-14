import React, { useState, useEffect, useRef } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Bold,
  Essentials,
  Italic,
  Paragraph,
  Undo,
  Alignment,
  BlockQuote,
  Heading,
  Link,
  List,
  Table,
  TableToolbar,
  Indent,
  IndentBlock,
  Underline
} from 'ckeditor5';

import 'ckeditor5/ckeditor5.css';
import { Button, Space, Modal, Input } from 'antd';
import { VariableIcon } from 'lucide-react'; // Placeholder icon if needed

interface DocumentEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  placeholder?: string;
}

export default function DocumentEditor({
  content = '',
  onChange,
  onSave,
  placeholder = 'Nhập nội dung tài liệu...',
}: DocumentEditorProps) {
  const editorRef = useRef<ClassicEditor | null>(null);

  // Custom configuration for a complete Word-like experience
  // Custom configuration for a complete Word-like experience
  const editorConfig = {
    licenseKey: 'GPL', // Required for Open Source usage
    toolbar: {
      items: [
        'undo', 'redo',
        '|',
        'heading',
        '|',
        'bold', 'italic', 'underline',
        '|',
        'alignment',
        '|',
        'bulletedList', 'numberedList', 'outdent', 'indent',
        '|',
        'link', 'insertTable', 'blockQuote',
      ],
      shouldNotGroupWhenFull: false
    },
    plugins: [
      Bold, Essentials, Italic, Paragraph, Undo,
      Alignment, BlockQuote, Heading,
      Link, List, Table, TableToolbar,
      Indent, IndentBlock,
      Underline
    ],
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells'
      ]
    },
    placeholder: placeholder,
  };

  /**
   * Styles for the A4 container
   */
  const a4PageStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    padding: '20mm',
    backgroundColor: '#fff',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
    margin: '24px auto',
    boxSizing: 'border-box'
  };

  const workspaceStyle: React.CSSProperties = {
    backgroundColor: '#ebedf0',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0',
    overflowY: 'auto',
    flex: 1
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar Area (CKEditor puts toolbar inside by default, but we can customize if needed)
                We will let CKEditor render its toolbar in the classic "top" position within the editor container.
                But since we want "A4 Paper" look, we usually put the toolbar outside or attached to the paper.
                ClassicEditor attaches toolbar to the editable area automatically.
                Wait, ClassicEditor puts toolbar on top of content.
                If we wrap it in A4 div, the toolbar will be INSIDE the A4 page? No.
                CKEditor creates a container.
                To simulate Word:
                 - Background Gray
                 - Toolbar (Sticky top)?
                 - Paper in middle.
                
                The `CKEditor` component renders the editor. 
                With `ClassicEditor`, the UI is: Toolbar + Content Area.
                We want Toolbar OUTSIDE the A4 paper (full width) and Content INSIDE A4.
                
                DecoupledEditor (DocumentEditor in CKEditor terms) is best for this, but Classic is easier to setup.
                With ClassicEditor, we might get Toolbar + Editable stuck together.
                
                Actually, let's just render ClassicEditor inside the A4 paper for now?
                No, that looks weird (Toolbar inside the page).
                
                If we want "Word-like", we should use `DecoupledEditor` OR just styling hack.
                Let's stick to ClassicEditor for simplicity first. 
                Users usually accept Toolbar on top of the "Paper" or right above it.
                
                Let's try:
                <GrayBackground>
                   <CKEditor />
                </GrayBackground>
                And we style `.ck-editor__editable` to look like A4?
                
                Yes! We can override CSS.
            */}

      <style>
        {`
                    /* Hide the default border of the editor container to blend with our custom styling if needed */
                    .ck.ck-editor__main > .ck-editor__editable {
                        background: #fff;
                        box-shadow: 0 0 5px rgba(0,0,0,0.1);
                        width: 210mm;
                        min-height: 297mm;
                        padding: 20mm;
                        margin: 20px auto;
                    }
                    
                    /* Center the editor in the available space */
                    .ck.ck-editor__main {
                        display: flex;
                        justify-content: center;
                        background-color: #ebedf0; /* Workspace Gray */
                        overflow-y: auto;
                        padding-bottom: 40px;
                    }

                    /* Sticky Toolbar */
                    .ck.ck-editor__top {
                        position: sticky;
                        top: 0;
                        z-index: 1000;
                        width: 100%;
                    }
                    
                    /* Fix max-height issue if parent has overflow */
                    .ck-editor {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                    }
                `}
      </style>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CKEditor
          editor={ClassicEditor}
          config={editorConfig as any}
          data={content}
          onReady={(editor) => {
            editorRef.current = editor as ClassicEditor;
            // You can store the "editor" and use when it is needed.
            console.log('Editor is ready to use!', editor);
          }}
          onChange={(event, editor) => {
            const data = editor.getData();
            onChange?.(data);
          }}
        />
      </div>

    </div>
  );
}
