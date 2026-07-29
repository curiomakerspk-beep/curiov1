import { useEffect } from "react";
import { Platform } from "react-native";

// Web platform only: listens for postMessage from the iframes (board picker,
// AI/voice/pose training, pickers) and drives the screen-visibility state
// that App.js owns, plus relays trained-model messages into the Blockly iframe.
export default function useWebMessageBridge({
  boardContextRef,
  setShowBoardScreen,
  setShowPickerScreen,
  setShowS3PickerScreen,
  setShowAIScreen,
  setShowVoiceScreen,
  setShowPoseScreen,
  setShowGestureScreen,
}) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const webListener = (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // ── Board picker ──
        if (msg.type === "OPEN_BOARD_PICKER") { setShowBoardScreen(true); }
        if (msg.type === "CLOSE_BOARD") { setShowBoardScreen(false); }
        // ── Board selection (from board.html) — tag the workspace and go
        // straight back to it. No picker screen here; training is launched
        // later from the Train button inside that board's AI Vision category,
        // which is what actually decides boardContextRef below (a user can
        // have both K230 and S3 selected at once). ──
        if (msg.type === "BOARD_SELECTED" && msg.board) {
          setShowBoardScreen(false);
          const blocklyIframe = document.querySelector('iframe[title="Blockly Workspace"]');
          blocklyIframe?.contentWindow?.postMessage(JSON.stringify({ type: 'BOARD_SELECTED', board: msg.board }), '*');
        }
        // ── Picker — each board's Train button sends its own message type,
        // so boardContextRef is set per-click, not from the last board picked ──
        if (msg.type === "OPEN_AI_TRAIN_PICKER") { boardContextRef.current = 'k230'; setShowPickerScreen(true); }
        if (msg.type === "CLOSE_PICKER") { setShowPickerScreen(false); }
        // ── S3 picker ──
        if (msg.type === "OPEN_S3_PICKER") { boardContextRef.current = 's3'; setShowS3PickerScreen(true); }
        if (msg.type === "CLOSE_S3_PICKER") { setShowS3PickerScreen(false); }
        // ── Image training — "back" returns to whichever picker (K230/S3)
        // this training session was opened from, not straight to the workspace ──
        if (msg.type === "OPEN_AI_TRAIN") { setShowPickerScreen(false); setShowS3PickerScreen(false); setShowAIScreen(true); }
        if (msg.type === "CLOSE_AI_TRAIN") {
          setShowAIScreen(false);
          if (boardContextRef.current === 's3') setShowS3PickerScreen(true); else setShowPickerScreen(true);
        }
        // ── Voice training ──
        if (msg.type === "OPEN_VOICE_TRAIN") { setShowPickerScreen(false); setShowS3PickerScreen(false); setShowVoiceScreen(true); }
        if (msg.type === "CLOSE_VOICE_TRAIN_V2") {
          setShowVoiceScreen(false);
          if (boardContextRef.current === 's3') setShowS3PickerScreen(true); else setShowPickerScreen(true);
        }
        // ── Pose training (K230-only — S3 has no pose option) ──
        if (msg.type === "OPEN_POSE_TRAIN") { setShowPickerScreen(false); setShowPoseScreen(true); }
        if (msg.type === "CLOSE_POSE_TRAIN") { setShowPoseScreen(false); setShowPickerScreen(true); }
        // ── Gesture training (K230-only — S3 has no gesture option) ──
        if (msg.type === "OPEN_GESTURE_TRAIN") { setShowPickerScreen(false); setShowGestureScreen(true); }
        if (msg.type === "CLOSE_GESTURE_TRAIN") { setShowGestureScreen(false); setShowPickerScreen(true); }
        // ── Relay trained classes to Blockly iframe ──
        if (msg.type === "AI_MODEL_TRAINED" || msg.type === "VOICE_MODEL_TRAINED" || msg.type === "POSE_MODEL_TRAINED" || msg.type === "GESTURE_MODEL_TRAINED") {
          const blocklyIframe = document.querySelector('iframe[title="Blockly Workspace"]');
          const tagged = msg.type === "AI_MODEL_TRAINED" ? { ...msg, board: boardContextRef.current } : msg;
          if (blocklyIframe?.contentWindow) {
            blocklyIframe.contentWindow.postMessage(JSON.stringify(tagged), '*');
          }
        }
      } catch (e) { }
    };
    window.addEventListener("message", webListener);
    return () => window.removeEventListener("message", webListener);
  }, []);
}
