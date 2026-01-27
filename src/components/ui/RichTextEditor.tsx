import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Quote, Heading1, Heading2 } from './Icons';

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    label?: string;
    error?: string;
    className?: string;
    editable?: boolean;
    readOnly?: boolean;
}

const ToolbarButton = ({ onClick, isActive, disabled, children, title }: { onClick: () => void, isActive?: boolean, disabled?: boolean, children: React.ReactNode, title?: string }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-pressed={isActive}
        className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive
            ? 'bg-brand-500 text-white'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-white/10'
            } disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600`}
    >
        {children}
    </button>
);

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 rounded-t-xl">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1 self-center" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                title="Bold"
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                title="Italic"
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                title="Underline"
            >
                <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1 self-center" />

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Align Left"
            >
                <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Align Center"
            >
                <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Align Right"
            >
                <AlignRight className="h-4 w-4" />
            </ToolbarButton>

            <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1 self-center" />

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Ordered List"
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    label,
    error,
    className = '',
    editable = true,
    readOnly = false
}) => {
    const isEditable = editable && !readOnly;

    const extensions = React.useMemo(() => [
        StarterKit.configure({

            link: {
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-brand-500 hover:text-brand-700 underline',
                },
            },
        }),
        // Link extension removed to avoid duplicate
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
    ], []);

    const editor = useEditor({
        extensions,
        content: value,
        editable: isEditable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `prose dark:prose-invert max-w-none p-4 min-h-[150px] focus:outline-none text-slate-700 dark:text-slate-300 text-sm ${!isEditable ? 'opacity-70 cursor-not-allowed bg-slate-50 dark:bg-black/10' : ''}`,
            },
        },
    });

    // Update content if value changes from outside (e.g. initial load or reset)
    React.useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if difference is significant to avoid cursor jumps
            // A simple comparison is risky, but for reset usage it's fine.
            if (value === '' || value === '<p></p>') {
                editor.commands.setContent(value);
            }
        }
    }, [value, editor]);

    // Update editable state when props change
    React.useEffect(() => {
        if (editor) {
            editor.setEditable(isEditable);
        }
    }, [isEditable, editor]);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && <label className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{label}</label>}
            <div className={`
                border rounded-xl bg-white dark:bg-slate-800 transition-all overflow-hidden
                ${error
                    ? 'border-error-500 ring-1 ring-error-500/20'
                    : 'border-slate-200 dark:border-white/10 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-300'
                }
            `}>
                {isEditable && <MenuBar editor={editor} />}
                <EditorContent editor={editor} />
            </div>
            {error && <span className="text-xs text-error-500 font-medium">{error}</span>}
        </div>
    );
};
