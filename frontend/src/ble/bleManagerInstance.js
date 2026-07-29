import { Platform } from "react-native";
import { BleManager } from "../native/optionalModules";

let bleManagerInstance = null;
if (Platform.OS !== 'web') {
  try { bleManagerInstance = new BleManager(); }
  catch (e) { console.log("BLE Manager init failed:", e); }
}

export default bleManagerInstance;
