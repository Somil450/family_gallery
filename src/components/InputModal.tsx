import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  title: string;
  placeholder: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export default function InputModal({ title, placeholder, defaultValue = '', confirmLabel = 'Create', onConfirm, onClose }: Props) {
  const [value, setValue] = useState(defaultValue);

  const submit = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 380, background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '24px 20px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontWeight: 800, fontSize: 17 }}>{title}</h3>
          <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={onClose}><X size={16} /></button>
        </div>
        <input
          autoFocus
          className="input"
          placeholder={placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          style={{ marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!value.trim()} style={{ flex: 1 }}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
