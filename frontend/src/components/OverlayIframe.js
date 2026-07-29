import React from "react";

// Web-platform counterpart of OverlayWebView: a full-screen iframe faded
// in/out (rather than mounted/unmounted) so the overlay screen keeps its JS state.
export default function OverlayIframe({ uri, visible, zIndex, title }) {
  return (
    <iframe
      src={uri}
      allow="camera; microphone"
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', zIndex,
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
      }}
      title={title} />
  );
}
