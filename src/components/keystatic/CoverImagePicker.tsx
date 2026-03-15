import React, { useState, useEffect, useCallback } from 'react';

interface ManifestEntry {
  filename: string;
  width: number;
  height: number;
  fullUrl: string;
  thumbUrl: string;
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function CoverImagePicker({ value, onChange }: Props) {
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);

  const findManifest = useCallback(() => {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      try {
        const parsed = JSON.parse(ta.value);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.thumbUrl) {
          setManifest(parsed);
          return;
        }
      } catch {
        // not the manifest textarea
      }
    }
  }, []);

  useEffect(() => {
    findManifest();
    const observer = new MutationObserver(findManifest);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [findManifest]);

  if (manifest.length === 0) {
    return (
      <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
        <p style={{ margin: 0, color: '#666' }}>
          No photos available yet. Run the gallery pipeline first to populate the photo manifest.
        </p>
        {value && (
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#999' }}>
            Current: <code>{value}</code>
          </p>
        )}
      </div>
    );
  }

  const selectedFilename = value ? value.split('/').pop() : null;

  return (
    <div>
      {value && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={value}
            alt="Current cover"
            style={{
              width: '80px',
              height: '54px',
              objectFit: 'cover',
              borderRadius: '6px',
              border: '2px solid #0070f3',
            }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Current cover</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{selectedFilename}</div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
        Click a thumbnail to set it as cover ({manifest.length} photos)
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: '6px',
          maxHeight: '360px',
          overflowY: 'auto',
          padding: '4px',
        }}
      >
        {manifest.map((photo) => {
          const isSelected = value === photo.fullUrl;
          return (
            <div
              key={photo.filename}
              onClick={() => onChange(photo.fullUrl)}
              title={photo.filename}
              style={{
                cursor: 'pointer',
                borderRadius: '6px',
                overflow: 'hidden',
                outline: isSelected ? '3px solid #0070f3' : '2px solid transparent',
                outlineOffset: '-2px',
                opacity: isSelected ? 1 : 0.8,
                transition: 'opacity 0.15s, outline 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                }
              }}
            >
              <img
                src={photo.thumbUrl}
                alt={photo.filename}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
