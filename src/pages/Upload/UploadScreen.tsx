import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as Img, Film, CheckCircle, XCircle, Trash2, Zap, ArrowRight } from 'lucide-react';
import { useUpload } from '../../hooks/useUpload';

interface Props {
  onDone?: () => void;
}

export default function UploadScreen({ onDone }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { queue, addFiles, removeItem, clearDone } = useUpload(() => setRefreshKey(k => k + 1));

  const onDrop = useCallback((accepted: File[]) => {
    const mediaFiles = accepted.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (mediaFiles.length > 0) addFiles(mediaFiles);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    multiple: true,
  });

  const doneCount = queue.filter(i => i.status === 'done').length;
  const hasItems = queue.length > 0;

  return (
    <div className="page-content">
      <div style={{ padding: '24px 20px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Upload</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Add memories to your family vault</p>
      </div>

      {/* Drop zone */}
      <div style={{ padding: '0 20px 20px' }}>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <motion.div animate={{ scale: isDragActive ? 1.04 : 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Upload size={36} style={{ margin: '0 auto 12px', color: isDragActive ? 'var(--accent)' : 'var(--text-muted)' }} />
            <p style={{ fontWeight: 700, marginBottom: 4, color: isDragActive ? 'var(--accent)' : 'var(--text-primary)', fontSize: 15 }}>
              {isDragActive ? 'Drop files here…' : 'Drag & drop photos or videos'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>or tap to browse your device</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              {['JPEG', 'PNG', 'HEIC', 'MP4', 'MOV'].map(fmt => (
                <span key={fmt} className="badge" style={{ fontSize: 10 }}>{fmt}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 20px', flexWrap: 'wrap' }}>
        {[
          { icon: <Zap size={11} />, label: 'Auto compressed' },
          { icon: <CheckCircle size={11} />, label: 'Dedup check' },
          { icon: <Zap size={11} />, label: 'Smart labels' },
        ].map(f => (
          <div key={f.label} className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}>
            {f.icon} {f.label}
          </div>
        ))}
      </div>

      {/* Queue */}
      {hasItems && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              Queue ({queue.length})
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {doneCount > 0 && (
                <button className="btn-ghost" onClick={clearDone} style={{ fontSize: 12 }}>
                  Clear done
                </button>
              )}
              {doneCount > 0 && onDone && (
                <button className="btn-primary" onClick={onDone} style={{ fontSize: 12, padding: '6px 14px' }}>
                  View in Gallery <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
            <AnimatePresence>
              {queue.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  className="glass-card"
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--border)' }}>
                    {item.file.type.startsWith('image/') ? (
                      <img src={item.previewURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Film size={20} color="var(--text-muted)" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                      {item.file.name}
                    </p>
                    <StatusRow item={item} />
                    {(item.status === 'uploading' || item.status === 'compressing') && (
                      <div className="progress-track" style={{ marginTop: 6 }}>
                        <motion.div
                          className="progress-fill"
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Remove */}
                  {(item.status === 'done' || item.status === 'error') && (
                    <button className="btn-icon" onClick={() => removeItem(item.id)} style={{ flexShrink: 0, width: 32, height: 32 }}>
                      <Trash2 size={14} color="var(--text-muted)" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasItems && (
        <div style={{ textAlign: 'center', padding: '16px 40px', color: 'var(--text-secondary)' }}>
          <Img size={32} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
          <p style={{ fontSize: 13 }}>Select files above to start uploading</p>
        </div>
      )}
    </div>
  );
}

function StatusRow({ item }: { item: ReturnType<typeof useUpload>['queue'][0] }) {
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    queued:      { label: 'Waiting…', color: 'var(--text-muted)' },
    compressing: { label: 'Compressing…', color: 'var(--accent)' },
    uploading:   { label: `Uploading ${item.progress}%`, color: 'var(--accent)' },
    processing:  { label: 'Processing…', color: '#f7971e' },
    done:        { label: 'Saved ✓', color: 'var(--success)' },
    error:       { label: item.error ?? 'Failed', color: 'var(--danger)' },
  };
  const s = STATUS_MAP[item.status] ?? STATUS_MAP.error;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {item.status === 'done' && <CheckCircle size={12} color="var(--success)" />}
      {item.status === 'error' && <XCircle size={12} color="var(--danger)" />}
      <span style={{ fontSize: 12, color: s.color }}>{s.label}</span>
    </div>
  );
}
