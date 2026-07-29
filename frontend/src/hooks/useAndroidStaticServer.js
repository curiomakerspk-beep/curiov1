import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { RNFS, StaticServer, getActiveServerId, STATES } from "../native/optionalModules";

// Extracts the bundled Blockly www assets and serves them over a local
// static server on Android (needed so the WebView training screens can
// load http:// resources; iOS/web use bundled file:// / asset URIs directly).
export default function useAndroidStaticServer() {
  const [serverUrl, setServerUrl] = useState(null);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const dest = RNFS.DocumentDirectoryPath + '/www';
          try {
            if (await RNFS.exists(dest)) {
              await RNFS.unlink(dest);
            }
          } catch (e) { console.error("Failed to wipe www:", e); } // Properly wipe old HTML files!
          await RNFS.mkdir(dest).catch(() => { });
          const { extractBundledAssets } = require('@dr.pogodin/react-native-static-server');
          await extractBundledAssets(dest, 'www');

          // If a server is already running in the native layer (e.g. from hot reload), stop it first
          try {
            const activeId = await getActiveServerId();
            if (activeId) {
              const oldServer = new StaticServer({ id: activeId, state: STATES.ACTIVE, fileDir: dest });
              await oldServer.stop();
              // Give native layer a moment to actually shut down the port
              await new Promise(r => setTimeout(r, 500));
            }
          } catch (e) { console.warn("Failed to stop old server:", e); }

          const server = new StaticServer({ port: 0, fileDir: dest, localOnly: true }); // 0 means pick random available port
          window._activeStaticServer = server; // store globally for hot-reload cleanup
          const url = await server.start();
          setServerUrl(url.replace('127.0.0.1', 'localhost'));
        } catch (e) {
          console.error("StaticServer error:", e);
          setServerError(e.message || String(e));
        }
      })();
    }

    return () => {
      // On hot-reload, try to stop the server before the new one starts
      if (window._activeStaticServer) {
        window._activeStaticServer.stop().catch(() => {});
        window._activeStaticServer = null;
      }
    };
  }, []);

  return { serverUrl, serverError };
}
