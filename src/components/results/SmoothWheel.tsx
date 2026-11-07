import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Google Maps style wheel handling, replacing Leaflet's scrollWheelZoom (which turns every trackpad
 * scroll into chunky animated zoom steps):
 * - pinch (ctrlKey wheel) zooms continuously around the cursor, applied once per animation frame;
 * - two-finger trackpad scroll pans the map;
 * - a mouse wheel notch (large integer deltaY, no deltaX) zooms one smooth step.
 */
export default function SmoothWheel() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let zoomDelta = 0;
    let pan = { x: 0, y: 0 };
    let anchor: { x: number; y: number } | null = null;
    let frame = 0;

    const flush = () => {
      frame = 0;
      if (zoomDelta !== 0 && anchor) {
        const target = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), map.getZoom() + zoomDelta));
        map.setZoomAround(map.containerPointToLatLng([anchor.x, anchor.y]), target, { animate: false });
      }
      if (pan.x !== 0 || pan.y !== 0) map.panBy([pan.x, pan.y], { animate: false });
      zoomDelta = 0; pan = { x: 0, y: 0 };
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(flush); };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const lineScale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
      const dx = e.deltaX * lineScale, dy = e.deltaY * lineScale;
      if (e.ctrlKey) {
        zoomDelta += -dy * 0.01; // pinch
        schedule();
      } else if (dx === 0 && Math.abs(dy) >= 50 && Number.isInteger(e.deltaY)) {
        // mouse wheel notch: one animated step around the cursor
        const step = dy < 0 ? 1 : -1;
        const target = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), Math.round(map.getZoom()) + step));
        map.setZoomAround(map.containerPointToLatLng([anchor.x, anchor.y]), target);
      } else {
        pan.x += dx; pan.y += dy; // two-finger scroll pans
        schedule();
      }
    };
    // Safari sends trackpad pinch as gesture events (not ctrl+wheel); without this the whole page
    // pinch-zooms and springs back.
    type GestureEv = Event & { scale: number; clientX: number; clientY: number };
    let gestureStartZoom = 0;
    const onGestureStart = (e: Event) => { e.preventDefault(); gestureStartZoom = map.getZoom(); };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEv;
      const rect = el.getBoundingClientRect();
      anchor = { x: g.clientX - rect.left, y: g.clientY - rect.top };
      zoomDelta = gestureStartZoom + Math.log2(g.scale) - map.getZoom();
      schedule();
    };
    const onGestureEnd = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}
