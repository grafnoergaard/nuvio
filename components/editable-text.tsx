'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useUIStrings } from '@/lib/ui-strings-context';
import { useToast } from '@/hooks/use-toast';

interface EditableTextProps {
  textKey: string;
  fallback: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  multiline?: boolean;
}

export function EditableText({
  textKey,
  fallback,
  as: Tag = 'span',
  className = '',
  multiline = false,
}: EditableTextProps) {
  const { isAdmin } = useAuth();
  const { getString, updateString } = useUIStrings();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const currentValue = getString(textKey, fallback);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = editValue.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  function handleEditStart() {
    setEditValue(currentValue);
    setIsEditing(true);
  }

  async function handleSave() {
    if (editValue === currentValue) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateString(textKey, editValue);
      toast({ title: 'Tekst gemt', description: `"${textKey}" er opdateret.` });
    } catch {
      toast({ title: 'Fejl', description: 'Kunne ikke gemme teksten. Prøv igen.', variant: 'destructive' });
    } finally {
      setSaving(false);
      setIsEditing(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setEditValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  if (!isAdmin) {
    return <Tag className={className}>{currentValue}</Tag>;
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-start gap-1 group/edit">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            rows={3}
            className={`${className} border border-blue-400 rounded px-1 py-0.5 bg-blue-50 dark:bg-blue-950 outline-none resize-none min-w-[200px] text-inherit font-inherit leading-inherit`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={`${className} border border-blue-400 rounded px-1 py-0.5 bg-blue-50 dark:bg-blue-950 outline-none min-w-[120px] text-inherit font-inherit leading-inherit`}
          />
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center w-5 h-5 mt-0.5 rounded bg-green-500 hover:bg-green-600 text-white transition-colors flex-shrink-0"
          title="Gem"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex items-center justify-center w-5 h-5 mt-0.5 rounded bg-red-500 hover:bg-red-600 text-white transition-colors flex-shrink-0"
          title="Annuller"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 group/editable cursor-default"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Tag className={className}>{currentValue}</Tag>
      <button
        onClick={handleEditStart}
        className={`inline-flex items-center justify-center w-4 h-4 rounded transition-all duration-150 flex-shrink-0 ${
          isHovered
            ? 'opacity-100 bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-400'
            : 'opacity-0'
        }`}
        title={`Rediger tekst (${textKey})`}
      >
        <Pencil className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
