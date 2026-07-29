import React from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";

const flexStyle = { flex: 1 };

const mediaWebViewProps = {
  mediaCapturePermissionGrantType: "grant",
  onPermissionRequest: (event) => event.request.grant(),
  allowsInlineMediaPlayback: true,
  mediaPlaybackRequiresUserAction: false,
};

// One of the overlay screens (board picker, AI/voice/pose training, pickers)
// that sit above the Blockly workspace WebView. On Android it loads from the
// local static server; elsewhere it loads the bundled asset URI directly.
export default function OverlayWebView({ innerRef, visible, zIndex, serverUrl, htmlFile, webUri, withMedia, onMessage }) {
  const canRender = !Platform.OS || Platform.OS !== 'android' || serverUrl;
  const source = {
    uri: Platform.OS === 'android'
      ? serverUrl + '/blockly/' + htmlFile + '?v=' + Date.now()
      : webUri,
  };

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex,
        display: visible ? 'flex' : 'none',
      }}
    >
      {canRender && (
        <WebView
          ref={innerRef}
          source={source}
          originWhitelist={["*"]}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          {...(withMedia ? mediaWebViewProps : null)}
          javaScriptEnabled
          scalesPageToFit={false}
          bounces={false}
          overScrollMode="never"
          androidLayerType="hardware"
          onMessage={onMessage}
          style={flexStyle}
        />
      )}
    </View>
  );
}
