// src/components/admin/RichTextEditor.js — formatted product descriptions
// (Aurora's "Name and description" editor, built on Tiptap): undo/redo,
// bold, italic, underline, alignment, lists and links. Emits HTML.
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FiAlignCenter,
  FiAlignJustify,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiItalic,
  FiLink,
  FiList,
  FiUnderline,
} from 'react-icons/fi';
import { richTextSx } from '../common/RichText';
import { isBlankHtml, isHtml, textToHtml } from '../../utils/richText';

const NumberedIcon = () => (
  <Box component="span" sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
    1.
  </Box>
);

const ToolButton = ({ label, active, disabled, onClick, children }) => {
  const theme = useTheme();
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} // keep the selection
          onClick={onClick}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '6px',
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active
              ? alpha(theme.palette.primary.main, 0.12)
              : 'transparent',
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
};
ToolButton.propTypes = {
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

const RichTextEditor = ({ value, onChange, placeholder, label, disabled }) => {
  const [linkAnchor, setLinkAnchor] = useState(null);
  const [href, setHref] = useState('');
  const emitted = useRef(value);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: isHtml(value) ? value : textToHtml(value || ''),
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      emitted.current = isBlankHtml(html) ? '' : html;
      onChange(emitted.current);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // A value we didn't emit (another product loaded) replaces the content.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(
      isHtml(value) ? value : textToHtml(value || ''),
      false
    );
  }, [editor, value]);

  if (!editor) return null;
  const cmd = () => editor.chain().focus();

  const openLink = (e) => {
    setHref(editor.getAttributes('link').href || 'https://');
    setLinkAnchor(e.currentTarget);
  };
  const removeLink = () => {
    cmd().extendMarkRange('link').unsetLink().run();
    setLinkAnchor(null);
  };
  const applyLink = () => {
    const url = href.trim();
    if (!url || url === 'https://')
      cmd().extendMarkRange('link').unsetLink().run();
    else cmd().extendMarkRange('link').setLink({ href: url }).run();
    setLinkAnchor(null);
  };

  const sep = (
    <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 0.75 }} />
  );

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          borderRadius: '8px',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          '&:focus-within': { borderColor: 'primary.main' },
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          role="toolbar"
          aria-label="Text formatting"
          sx={{ px: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <ToolButton
            label="Undo"
            disabled={disabled || !editor.can().undo()}
            onClick={() => cmd().undo().run()}
          >
            <FiCornerUpLeft />
          </ToolButton>
          <ToolButton
            label="Redo"
            disabled={disabled || !editor.can().redo()}
            onClick={() => cmd().redo().run()}
          >
            <FiCornerUpRight />
          </ToolButton>
          {sep}
          <ToolButton
            label="Bold"
            active={editor.isActive('bold')}
            disabled={disabled}
            onClick={() => cmd().toggleBold().run()}
          >
            <FiBold />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={editor.isActive('italic')}
            disabled={disabled}
            onClick={() => cmd().toggleItalic().run()}
          >
            <FiItalic />
          </ToolButton>
          <ToolButton
            label="Underline"
            active={editor.isActive('underline')}
            disabled={disabled}
            onClick={() => cmd().toggleUnderline().run()}
          >
            <FiUnderline />
          </ToolButton>
          {sep}
          {[
            ['left', 'Align left', <FiAlignLeft key="l" />],
            ['center', 'Centre', <FiAlignCenter key="c" />],
            ['right', 'Align right', <FiAlignRight key="r" />],
            ['justify', 'Justify', <FiAlignJustify key="j" />],
          ].map(([align, text, icon]) => (
            <ToolButton
              key={align}
              label={text}
              active={editor.isActive({ textAlign: align })}
              disabled={disabled}
              onClick={() => cmd().setTextAlign(align).run()}
            >
              {icon}
            </ToolButton>
          ))}
          {sep}
          <ToolButton
            label="Bulleted list"
            active={editor.isActive('bulletList')}
            disabled={disabled}
            onClick={() => cmd().toggleBulletList().run()}
          >
            <FiList />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={editor.isActive('orderedList')}
            disabled={disabled}
            onClick={() => cmd().toggleOrderedList().run()}
          >
            <NumberedIcon />
          </ToolButton>
          {sep}
          <ToolButton
            label="Link"
            active={editor.isActive('link')}
            disabled={disabled}
            onClick={openLink}
          >
            <FiLink />
          </ToolButton>
        </Stack>
        <Box
          sx={{
            ...richTextSx,
            color: 'text.primary',
            px: 2,
            py: 1.5,
            '& .tiptap': { minHeight: 200, outline: 'none' },
            '& .tiptap p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              color: 'text.disabled',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
          }}
        >
          <EditorContent editor={editor} aria-label={label || 'Description'} />
        </Box>
      </Box>
      <Popover
        open={Boolean(linkAnchor)}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, width: 340, borderRadius: 1 } } }}
      >
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Link address"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.preventDefault(), applyLink())
            }
            autoFocus
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" onClick={removeLink}>
              Remove link
            </Button>
            <Button size="small" variant="contained" onClick={applyLink}>
              Apply
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </Box>
  );
};

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  disabled: PropTypes.bool,
};

export default RichTextEditor;
