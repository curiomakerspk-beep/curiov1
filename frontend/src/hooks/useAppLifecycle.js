import { useEffect } from "react";
import { Alert, Platform, PermissionsAndroid } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { startUsbService, stopUsbService } from "../usb/usbSerialService";

// Requests Android permissions, locks orientation, and starts/stops the USB
// serial + BLE scan on mount/unmount. `bleManager` is a dependency so the
// cleanup can stop any in-progress scan if it ever changes.
export default function useAppLifecycle(bleManager) {
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const allGranted =
          granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
          granted['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
          granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted' &&
          granted['android.permission.CAMERA'] === 'granted' &&
          granted['android.permission.RECORD_AUDIO'] === 'granted';
        if (!allGranted) {
          Alert.alert("Permission Required", "Go to Settings and allow Bluetooth, Location, Camera, and Microphone.");
        }
        NavigationBar.setVisibilityAsync("hidden").catch(() => { });
      }
      if (Platform.OS !== "web") {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => { });
        startUsbService();
      }
    })();
    return () => {
      if (bleManager) bleManager.stopDeviceScan();
      if (Platform.OS === "android") stopUsbService();
    };
  }, [bleManager]);
}
