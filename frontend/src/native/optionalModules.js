import { Platform } from "react-native";

// Optional native modules (avoid web errors)
let RNFS = null;
let StaticServer = null;
let getActiveServerId = null;
let STATES = null;
let BleManager = null;

if (Platform.OS !== 'web') {
  try {
    RNFS = require('@dr.pogodin/react-native-fs');
    const ss = require('@dr.pogodin/react-native-static-server');
    StaticServer = ss.default;
    getActiveServerId = ss.getActiveServerId;
    STATES = ss.STATES;
    BleManager = require('react-native-ble-plx').BleManager;
  } catch (e) {
    console.warn("Failed to load native modules:", e);
  }
}

export { RNFS, StaticServer, getActiveServerId, STATES, BleManager };
