import { useEffect, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export interface ZillowPreview {
  pageUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  status: 'ok' | 'no_image' | 'error';
}

/** Listing ids we already asked the server to fetch this session (one call per listing). */
const requested = new Set<string>();
const VIEWER_KEY_STORAGE = 'redo.zillow-preview-viewer';

function viewerKey() {
  const existing = localStorage.getItem(VIEWER_KEY_STORAGE);
  if (existing) return existing;
  const key = crypto.randomUUID();
  localStorage.setItem(VIEWER_KEY_STORAGE, key);
  return key;
}

/**
 * Reads the cached Zillow preview. When there is none and the element attached to `ref`
 * is on screen, asks the server to fetch it once. Only 'ok' previews expose an image.
 */
export function useZillowPreview<T extends Element = HTMLElement>(listingId: string, enabled = true) {
  const preview = useQuery(api.zillowPreviews.get, enabled ? { listingId } : 'skip') as ZillowPreview | null | undefined;
  const fetchPreview = useAction(api.zillowPreviews.fetch);
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !visible || preview !== null || requested.has(listingId)) return;
    requested.add(listingId);
    fetchPreview({ listingId, viewerKey: viewerKey() }).catch(() => { /* the query stays null; the card keeps its aerial photo */ });
  }, [enabled, visible, preview, listingId, fetchPreview]);

  return { preview: preview ?? null, ref };
}
