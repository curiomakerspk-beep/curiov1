import { useCallback, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import base64 from "react-native-base64";
import bleManagerInstance from "../ble/bleManagerInstance";
import { SERVICE_UUID, WRITE_UUID, NOTIFY_UUID } from "../constants/ble";

// Owns the BLE manager instance, the currently connected device, and every
// scan/connect/send/disconnect action the Blockly bridge can trigger.
// `injectJS` pushes status updates into the Blockly WebView (handleBoardMessage/finalizeConnection).
export default function useBluetoothBridge(injectJS) {
  const [bleManager] = useState(bleManagerInstance);
  const [isConnected, setIsConnected] = useState(false);
  const connectedDeviceRef = useRef(null);

  const setConnectedDevice = useCallback((device) => {
    connectedDeviceRef.current = device;
    setIsConnected(!!device);
  }, []);

  const scanAndConnectBLE = useCallback(() => {
    if (!bleManager) { Alert.alert("BLE unavailable", "Bluetooth manager could not start."); return; }
    injectJS(`handleBoardMessage("Scanning…", "SYS");`);
    bleManager.state().then(state => {
      if (state !== 'PoweredOn') {
        Alert.alert("Bluetooth Off", "Please turn on Bluetooth and Location.");
        injectJS(`handleBoardMessage("Bluetooth is OFF", "SYS");`);
        return;
      }
      bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) { injectJS(`handleBoardMessage("Scan Error: ${error.reason || 'Check GPS/BT'}", "SYS");`); return; }
        if (device && device.name) {
          const rssi = device.rssi || -50;
          injectJS(`addDeviceToUI("${device.name}", "${device.id}", ${rssi});`);
        }
      });
      setTimeout(() => { bleManager.stopDeviceScan(); console.log("Scan stopped."); }, 10000);
    }).catch(e => { injectJS(`handleBoardMessage("BLE Error: ${e.message}", "SYS");`); });
  }, [bleManager, injectJS]);

  const connectToSpecificDevice = useCallback((deviceId) => {
    if (!deviceId || !bleManager) return;
    bleManager.stopDeviceScan();
    injectJS(`handleBoardMessage("Connecting…", "SYS");`);
    const previousDevice = connectedDeviceRef.current;
    const doConnect = () => {
      bleManager.connectToDevice(deviceId)
        .then(device => device.discoverAllServicesAndCharacteristics())
        .then(async device => {
          setConnectedDevice(device);
          device._mtu = 20;
          try {
            if (Platform.OS === 'android') {
              const nd = await device.requestMTU(512);
              device._mtu = nd.mtu;
            } else { device._mtu = 185; }
          } catch (e) { device._mtu = 20; }
          await new Promise(r => setTimeout(r, 80));
          injectJS(`window._mobileBLEConnected = true; finalizeConnection("${device.name || 'Robot'}");`);
          let _notifyBuffer = '';
          try {
            device.monitorCharacteristicForService(SERVICE_UUID, NOTIFY_UUID, (error, characteristic) => {
              if (error) { if (error.errorCode !== 2) console.log("Notify error:", error.reason || error); return; }
              if (!characteristic?.value) return;
              _notifyBuffer += base64.decode(characteristic.value);
              const parts = _notifyBuffer.split('\n');
              _notifyBuffer = parts.pop() || '';
              for (const rawLine of parts) {
                const line = rawLine.replace(/\r/g, '').trim();
                if (!line || /^>{2,}/.test(line) || /^\.{3,}/.test(line)) continue;
                if (line.startsWith('@@START') || line.startsWith('@@END')) continue;
                if (line === 'OK' || line === 'MPY: soft reboot') continue;
                if (line.replace(/[\x20-\x7E]/g, '').length > line.length * 0.3) continue;
                const safe = line.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                injectJS(`handleBoardMessage("${safe}", "BLE");`);
              }
            });
          } catch (notifyErr) { console.log("Failed to subscribe to notify:", notifyErr); }
          device.onDisconnected(() => {
            if (connectedDeviceRef.current?.id === device.id) {
              setConnectedDevice(null);
              injectJS(`window._mobileBLEConnected = false; handleBoardMessage("BLE disconnected", "SYS"); var p = document.getElementById('bt-text'); if (p) p.innerText = 'Bluetooth';`);
            }
          });
        })
        .catch(e => { injectJS(`handleBoardMessage("Connection failed: ${e.message.replace(/"/g, "'")}", "SYS");`); });
    };
    if (previousDevice) {
      previousDevice.cancelConnection().catch(() => { }).finally(() => { setConnectedDevice(null); setTimeout(doConnect, 300); });
    } else { doConnect(); }
  }, [bleManager, injectJS, setConnectedDevice]);

  const sendToBoardBLE = useCallback(async (data) => {
    const device = connectedDeviceRef.current;
    if (!device || !bleManager) { Alert.alert("Error", "Please connect via Bluetooth first."); return; }
    try {
      const stillConnected = await bleManager.isDeviceConnected(device.id).catch(() => false);
      if (!stillConnected) {
        setConnectedDevice(null);
        injectJS(`window._mobileBLEConnected = false; handleBoardMessage("BLE lost — please reconnect", "SYS"); var p = document.getElementById('bt-text'); if (p) p.innerText = 'Bluetooth';`);
        return;
      }
      await bleManager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, WRITE_UUID, base64.encode('@@START\n'));
      const chunkSize = Math.max(20, (device._mtu || 20) - 12);
      for (let i = 0; i < data.length; i += chunkSize) {
        await bleManager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, WRITE_UUID, base64.encode(data.substring(i, i + chunkSize)));
      }
      await bleManager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, WRITE_UUID, base64.encode('\n@@END'));
      injectJS(`handleBoardMessage("Upload Done! ✅", "SYS");`);
    } catch (error) {
      const stillUp = await bleManager.isDeviceConnected(device.id).catch(() => false);
      if (!stillUp) { setConnectedDevice(null); injectJS(`window._mobileBLEConnected = false; var p = document.getElementById('bt-text'); if (p) p.innerText = 'Bluetooth';`); }
      injectJS(`handleBoardMessage("Send Failed ❌: ${String(error.message || error).replace(/"/g, "'")}", "SYS");`);
    }
  }, [bleManager, injectJS, setConnectedDevice]);

  const sendCommandBLE = useCallback(async (command) => {
    const device = connectedDeviceRef.current;
    if (!device || !bleManager) { injectJS(`handleBoardMessage("No BLE connection", "SYS");`); return; }
    try {
      const stillConnected = await bleManager.isDeviceConnected(device.id).catch(() => false);
      if (!stillConnected) { setConnectedDevice(null); injectJS(`window._mobileBLEConnected = false; handleBoardMessage("BLE lost — please reconnect", "SYS");`); return; }
      await bleManager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, WRITE_UUID, base64.encode(command + "\n"));
      injectJS(`handleBoardMessage("${command} sent ✅", "SYS");`);
    } catch (e) { injectJS(`handleBoardMessage("Command failed ❌", "SYS");`); }
  }, [bleManager, injectJS, setConnectedDevice]);

  const disconnectBLE = useCallback(async () => {
    const device = connectedDeviceRef.current;
    if (!device || !bleManager) { injectJS(`handleBoardMessage("Not connected to any device", "SYS");`); return; }
    try {
      injectJS(`handleBoardMessage("🔴 Initiating safe disconnect...", "SYS");`);
      let disconnectSent = false;
      try {
        const stillConnected = await bleManager.isDeviceConnected(device.id).catch(() => false);
        if (stillConnected) {
          await bleManager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, WRITE_UUID, base64.encode("DISCONNECT\n"));
          disconnectSent = true;
          injectJS(`handleBoardMessage("  ✓ Disconnect command sent", "SYS");`);
        }
      } catch (e) { injectJS(`handleBoardMessage("  ⚠️ Could not send disconnect", "SYS");`); }
      if (!disconnectSent) { setConnectedDevice(null); return; }
      await new Promise(r => setTimeout(r, 1200));
      setConnectedDevice(null);
      try { await device.cancelConnection(); } catch (e) { }
      await new Promise(r => setTimeout(r, 300));
      injectJS(`window._mobileBLEConnected = false; handleBoardMessage("🟢 [SAFE_DISCONNECT] Complete!", "SYS"); var p = document.getElementById('bt-text'); if (p) p.innerText = 'Bluetooth';`);
    } catch (error) { setConnectedDevice(null); injectJS(`handleBoardMessage("Error: ${error.message}", "SYS");`); }
  }, [bleManager, injectJS, setConnectedDevice]);

  return {
    bleManager,
    isConnected,
    connectedDeviceRef,
    scanAndConnectBLE,
    connectToSpecificDevice,
    sendToBoardBLE,
    sendCommandBLE,
    disconnectBLE,
  };
}
