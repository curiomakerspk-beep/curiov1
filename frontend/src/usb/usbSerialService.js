import { Alert, DeviceEventEmitter, Platform } from "react-native";

let RNSerialport = null;
let SerialActions = null;
const _usbListeners = [];

function ensureSerialModule() {
  if (Platform.OS !== "android") return false;
  if (RNSerialport && SerialActions) return true;
  // try {
  //   const Serial = require("rn-usb-serial");
  //   RNSerialport = Serial.RNSerialport;
  //   SerialActions = Serial.actions;
  //   return true;
  // } catch (e) {
  //   console.warn("Unable to load rn-usb-serial:", e);
  //   return false;
  // }
  return false;
}

export function startUsbService() {
  if (!ensureSerialModule()) return;
  _usbListeners.push(
    DeviceEventEmitter.addListener(SerialActions.ON_CONNECTED, () => console.log("USB: Connected")),
    DeviceEventEmitter.addListener(SerialActions.ON_DISCONNECTED, () => console.log("USB: Disconnected")),
  );
  try {
    RNSerialport.setInterface(-1);
    RNSerialport.setAutoConnectBaudRate(115200);
    RNSerialport.setAutoConnect(true);
    RNSerialport.startUsbService();
  } catch (e) {
    console.warn("Failed to start USB service:", e);
  }
}

export function stopUsbService() {
  if (!RNSerialport || Platform.OS !== "android") return;
  _usbListeners.forEach(sub => sub.remove());
  _usbListeners.length = 0;
  try { RNSerialport.stopUsbService(); } catch (e) { console.warn("Error stopping USB service:", e); }
}

export function buildPycodeMessage(code, entry = "main") {
  return `PYCODE\nENTRY:${entry}\nSIZE:${code.length}\n\n${code}`;
}

export function sendToBoardUSB(message) {
  if (!ensureSerialModule()) return;
  try { RNSerialport.writeString(message); Alert.alert("USB Sent", "Code sent over USB."); }
  catch (e) { Alert.alert("USB Error", "Failed to send."); }
}
