import 'expo-dev-client';
import { useAssets } from 'expo-asset';
import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  View,
  Alert,
  ActivityIndicator,
  Text,
} from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { RNFS } from './src/native/optionalModules';
import { APP_BACKEND_URL } from './src/constants/app'; // Used for both local testing and production
import { TRAINING_SCREENS } from './src/constants/trainingScreens';
import { buildPycodeMessage, sendToBoardUSB } from './src/usb/usbSerialService';
import useAndroidStaticServer from './src/hooks/useAndroidStaticServer';
import useBluetoothBridge from './src/hooks/useBluetoothBridge';
import useWebMessageBridge from './src/hooks/useWebMessageBridge';
import useAppLifecycle from './src/hooks/useAppLifecycle';
import OverlayWebView from './src/components/OverlayWebView';
import OverlayIframe from './src/components/OverlayIframe';

export default function App() {
  const blocklyRef = React.useRef(null);
  const trainRef = React.useRef(null);   // image training WebView
  const voiceRef = React.useRef(null);   // voice training WebView
  const pickerRef = React.useRef(null);   // picker WebView
  const poseRef = React.useRef(null);   // pose training WebView
  const gestureRef = React.useRef(null);   // gesture training WebView
  const boardRef = React.useRef(null);   // board picker WebView
  const s3PickerRef = React.useRef(null);   // S3 picker WebView
  const boardContextRef = React.useRef('k230');   // which board the current training session belongs to

  const [showAIScreen, setShowAIScreen] = useState(false); // image training
  const [showVoiceScreen, setShowVoiceScreen] = useState(false); // voice training
  const [showPickerScreen, setShowPickerScreen] = useState(false); // picker (choose type)
  const [showPoseScreen, setShowPoseScreen] = useState(false); // pose training
  const [showGestureScreen, setShowGestureScreen] = useState(false); // gesture training
  const [showBoardScreen, setShowBoardScreen] = useState(false); // board picker (choose board)
  const [showS3PickerScreen, setShowS3PickerScreen] = useState(false); // S3 picker (choose type)
  const [webViewReady, setWebViewReady] = useState(false);

  const { serverUrl, serverError } = useAndroidStaticServer();

  const documentPickerActiveRef = useRef(false);

  const injectJS = useCallback((jsCode) => {
    blocklyRef.current?.injectJavaScript(jsCode + '; true;');
  }, []);

  const {
    bleManager,
    connectedDeviceRef,
    scanAndConnectBLE,
    connectToSpecificDevice,
    sendToBoardBLE,
    sendCommandBLE,
    disconnectBLE,
  } = useBluetoothBridge(injectJS);

  // Web platform: listen for postMessage from iframes
  useWebMessageBridge({
    boardContextRef,
    setShowBoardScreen,
    setShowPickerScreen,
    setShowS3PickerScreen,
    setShowAIScreen,
    setShowVoiceScreen,
    setShowPoseScreen,
    setShowGestureScreen,
  });

  // Permissions & lifecycle
  useAppLifecycle(bleManager);

  const handleBlocklyMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); }
    catch (e) { console.warn("Bridge parse error:", e); return; }

    switch (msg.type) {
      case "CONNECT_BLE": scanAndConnectBLE(); break;
      case "SELECT_DEVICE": connectToSpecificDevice(msg.deviceId); break;
      case "SEND_DATA": sendToBoardBLE(msg.data); break;
      case "COMMAND": sendCommandBLE(msg.command); break;
      case "DISCONNECT_SAFE":
        if (connectedDeviceRef.current) { disconnectBLE().catch(e => console.error(e)); }
        else { injectJS(`handleBoardMessage("Already disconnected", "SYS");`); }
        break;
      case "python_upload": sendToBoardUSB(buildPycodeMessage(msg.code)); break;
      case "OPEN_BOARD_PICKER": setShowBoardScreen(true); break;
      case "CLOSE_BOARD": setShowBoardScreen(false); break;
      case "OPEN_AI_TRAIN_PICKER": boardContextRef.current = 'k230'; setShowBoardScreen(false); setShowPickerScreen(true); break;
      case "OPEN_S3_PICKER": boardContextRef.current = 's3'; setShowBoardScreen(false); setShowS3PickerScreen(true); break;
      case "CLOSE_PICKER": setShowPickerScreen(false); break;
      case "OPEN_AI_TRAIN": setShowPickerScreen(false); setShowAIScreen(true); break;
      case "OPEN_VOICE_TRAIN": setShowPickerScreen(false); setShowVoiceScreen(true); break;
      case "OPEN_POSE_TRAIN": setShowPickerScreen(false); setShowPoseScreen(true); break;
      case "OPEN_GESTURE_TRAIN": setShowPickerScreen(false); setShowGestureScreen(true); break;
      case "AI_MODEL_TRAINED":
      case "VOICE_MODEL_TRAINED":
      case "POSE_MODEL_TRAINED":
      case "GESTURE_MODEL_TRAINED":
        blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}}));true;`);
        break;
      case "SAVE_FILE":
        (async () => {
          try {
            const file = new File(Paths.cache, msg.fileName || 'program.xml');
            await file.write(msg.content);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(file.uri, { mimeType: 'text/xml', dialogTitle: 'Save Blockly Program', UTI: 'public.xml' });
            } else { Alert.alert("Saved", `File saved to: ${file.uri}`); }
            injectJS(`handleBoardMessage("File saved ✅", "SYS");`);
          } catch (e) { injectJS(`handleBoardMessage("Save failed: ${String(e.message || e).replace(/"/g, "'")}", "SYS");`); }
        })(); break;
      case "SAVE_CLOUD":
        injectJS(`handleBoardMessage("Cloud sync coming soon ☁️", "SYS");`); break;
      case "LOAD_FILE":
        (async () => {
          if (documentPickerActiveRef.current) return;
          try {
            documentPickerActiveRef.current = true;
            const result = await DocumentPicker.getDocumentAsync({ type: ['text/xml', 'application/xml'], copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.length) return;
            const content = await new File(result.assets[0].uri).text();
            const safe = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            injectJS(`loadXml(\`${safe}\`);`);
            injectJS(`handleBoardMessage("File loaded ✅", "SYS");`);
          } catch (e) { injectJS(`handleBoardMessage("Load failed: ${String(e.message || e).replace(/"/g, "'")}", "SYS");`); }
          finally { documentPickerActiveRef.current = false; }
        })(); break;
      default: console.warn("Unknown bridge message type:", msg.type);
    }
  }, [scanAndConnectBLE, connectToSpecificDevice, sendToBoardBLE, sendCommandBLE, disconnectBLE, injectJS]);

  // Screens keep their WebViews mounted in the background to preserve JS state,
  // so a camera/mic stream left open on one screen holds the hardware lock and
  // starves getUserMedia on whichever screen is opened next (surfaces as
  // "AbortError: Timeout starting video source"). Release all of them whenever
  // a screen is closed or a different screen is opened.
  const stopBackgroundCameras = useCallback(() => {
    trainRef.current?.injectJavaScript('if (typeof stopCapture === "function") { try { stopCapture(); } catch(e){} } true;');
    voiceRef.current?.injectJavaScript('if (typeof stopMic === "function") { try { stopMic(); } catch(e){} } if (typeof stopInference === "function") { try { stopInference(); } catch(e){} } true;');
    poseRef.current?.injectJavaScript('if (typeof stopCamCapture === "function") { try { stopCamCapture(); } catch(e){} } true;');
    gestureRef.current?.injectJavaScript('if (typeof stopCamCapture === "function") { try { stopCamCapture(); } catch(e){} } if (typeof stopLivePreview === "function") { try { stopLivePreview(); } catch(e){} } true;');
  }, []);

  const handleTrainMessage = useCallback((event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch (e) { return; }
    // Image training messages — "back" returns to whichever picker (K230/S3)
    // this training session was opened from, not straight to the workspace
    if (msg.type === "CLOSE_AI_TRAIN") {
      setShowAIScreen(false); stopBackgroundCameras();
      if (boardContextRef.current === 's3') setShowS3PickerScreen(true); else setShowPickerScreen(true);
    }
    if (msg.type === "AI_MODEL_TRAINED") {
      const tagged = { ...msg, board: boardContextRef.current };
      blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(tagged))}}));true;`);
    }
    // Voice training messages
    if (msg.type === "CLOSE_VOICE_TRAIN_V2") {
      setShowVoiceScreen(false); stopBackgroundCameras();
      if (boardContextRef.current === 's3') setShowS3PickerScreen(true); else setShowPickerScreen(true);
    }
    if (msg.type === "VOICE_MODEL_TRAINED") {
      blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}}));true;`);
    }
    // Pose training messages (K230-only — S3 has no pose option)
    if (msg.type === "CLOSE_POSE_TRAIN") { setShowPoseScreen(false); stopBackgroundCameras(); setShowPickerScreen(true); }
    if (msg.type === "POSE_MODEL_TRAINED") {
      blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}}));true;`);
    }
    // Gesture training messages (K230-only — S3 has no gesture option)
    if (msg.type === "CLOSE_GESTURE_TRAIN") { setShowGestureScreen(false); stopBackgroundCameras(); setShowPickerScreen(true); }
    if (msg.type === "GESTURE_MODEL_TRAINED") {
      blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify(msg))}}));true;`);
    }
    // Picker messages
    if (msg.type === "CLOSE_PICKER") setShowPickerScreen(false);
    if (msg.type === "OPEN_AI_TRAIN") { setShowPickerScreen(false); setShowS3PickerScreen(false); stopBackgroundCameras(); setShowAIScreen(true); }
    if (msg.type === "OPEN_VOICE_TRAIN") { setShowPickerScreen(false); setShowS3PickerScreen(false); stopBackgroundCameras(); setShowVoiceScreen(true); }
    if (msg.type === "OPEN_POSE_TRAIN") { setShowPickerScreen(false); stopBackgroundCameras(); setShowPoseScreen(true); }
    if (msg.type === "OPEN_GESTURE_TRAIN") { setShowPickerScreen(false); stopBackgroundCameras(); setShowGestureScreen(true); }
    // Board picker messages — tag the workspace and go straight back to it.
    // No picker screen here; training is launched later from the Train
    // button inside the AI Vision category (see handleBlocklyMessage).
    if (msg.type === "CLOSE_BOARD") setShowBoardScreen(false);
    if (msg.type === "BOARD_SELECTED" && msg.board) {
      boardContextRef.current = msg.board;
      setShowBoardScreen(false);
      blocklyRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(JSON.stringify({ type: 'BOARD_SELECTED', board: msg.board }))}}));true;`);
    }
    // S3 picker messages
    if (msg.type === "CLOSE_S3_PICKER") { setShowS3PickerScreen(false); }
  }, [stopBackgroundCameras]);

  const handleWebViewError = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error("WebView error:", nativeEvent);
    if (nativeEvent.code !== -999) Alert.alert("Load Error", `Failed to load workspace: ${nativeEvent.description}`);
  }, []);

  const handleWebViewHttpError = useCallback((syntheticEvent) => {
    console.error("WebView HTTP error:", syntheticEvent.nativeEvent.statusCode);
  }, []);

  const handleContentProcessTerminate = useCallback(() => {
    console.warn("WebView process terminated — reloading.");
    blocklyRef.current?.reload();
  }, []);

  const [assets] = useAssets([
    require('./assets/blockly/index.html'),         // assets[0] → Blockly workspace
    require('./assets/blockly/train.html'),          // assets[1] → Image training
    require('./assets/blockly/train_voice_v2.html'), // assets[2] → Voice training
    require('./assets/blockly/train_picker.html'),   // assets[3] → Picker screen
    require('./assets/blockly/pose.html'),           // assets[4] → Pose training
    require('./assets/blockly/board.html'),          // assets[5] → Board picker screen
    require('./assets/blockly/s3_picker.html'),      // assets[6] → S3 picker screen
    require('./assets/blockly/gesture.html'),        // assets[7] → Gesture training
  ]);

  if (!assets) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#00b4cc" />
        <Text style={styles.splashText}>Loading workspace…</Text>
      </View>
    );
  }

  // Overlay screens share visibility/ref lookups by key so the JSX below
  // doesn't have to repeat six near-identical WebView/iframe blocks.
  const screenVisibility = {
    board: showBoardScreen,
    picker: showPickerScreen,
    s3Picker: showS3PickerScreen,
    train: showAIScreen,
    voice: showVoiceScreen,
    pose: showPoseScreen,
    gesture: showGestureScreen,
  };
  const screenRefs = {
    board: boardRef,
    picker: pickerRef,
    s3Picker: s3PickerRef,
    train: trainRef,
    voice: voiceRef,
    pose: poseRef,
    gesture: gestureRef,
  };
  const anyOverlayVisible = TRAINING_SCREENS.some(screen => screenVisibility[screen.key]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.flex}>
        <StatusBar hidden />
        {TRAINING_SCREENS.map(screen => (
          <OverlayIframe
            key={screen.key}
            uri={assets[screen.assetIndex].uri}
            visible={screenVisibility[screen.key]}
            zIndex={screen.zIndex}
            title={screen.title}
          />
        ))}
        {/* Blockly workspace */}
        <iframe src={assets[0].uri} allow="camera; microphone"
          style={{
            width: '100%', height: '100%', border: 'none',
            visibility: anyOverlayVisible ? 'hidden' : 'visible'
          }}
          title="Blockly Workspace" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <StatusBar hidden />

      {!webViewReady && (
        <View style={styles.splashOverlay}>
          {serverError ? (
            <>
              <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>Server Error:</Text>
              <Text style={{ color: 'red', padding: 20, textAlign: 'center' }}>{serverError}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#00b4cc" />
              <Text style={styles.splashText}>Preparing Blockly…</Text>
            </>
          )}
        </View>
      )}

      {TRAINING_SCREENS.map(screen => (
        <OverlayWebView
          key={screen.key}
          innerRef={screenRefs[screen.key]}
          visible={screenVisibility[screen.key]}
          zIndex={screen.zIndex}
          serverUrl={serverUrl}
          htmlFile={screen.htmlFile}
          webUri={assets[screen.assetIndex].uri}
          withMedia={screen.withMedia}
          onMessage={handleTrainMessage}
        />
      ))}

      {/* Blockly WebView — always mounted */}
      <View
        pointerEvents={anyOverlayVisible ? 'none' : 'auto'}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: anyOverlayVisible ? 'none' : 'flex',
        }}
      >
        {(!Platform.OS || Platform.OS !== 'android' || serverUrl) && (
          <WebView
            ref={blocklyRef}
            originWhitelist={["*"]}
            source={{ uri: Platform.OS === 'android' ? 'file://' + RNFS.DocumentDirectoryPath + '/www/blockly/index.html?v=' + Date.now() : assets[0].uri }}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            scalesPageToFit={true}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            bounces={false}
            overScrollMode="never"
            androidLayerType="hardware"
            style={styles.flex}
            onMessage={handleBlocklyMessage}
            onError={handleWebViewError}
            onHttpError={handleWebViewHttpError}
            onContentProcessDidTerminate={handleContentProcessTerminate}
            onLoadEnd={() => setWebViewReady(true)}
          />
        )}
      </View>
    </View>
  );
}

const styles = {
  flex: { flex: 1 },
  splash: { flex: 1, backgroundColor: '#cfeff2', justifyContent: 'center', alignItems: 'center', gap: 12 },
  splashOverlay: { position: 'absolute', inset: 0, zIndex: 10, backgroundColor: '#cfeff2', justifyContent: 'center', alignItems: 'center', gap: 12 },
  splashText: { fontSize: 14, color: '#2b3c47', fontWeight: '600', letterSpacing: 0.5 },
};
