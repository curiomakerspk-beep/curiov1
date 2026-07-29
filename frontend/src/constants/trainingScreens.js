// Config for the overlay screens (board picker, AI/voice/pose training, pickers)
// that sit on top of the Blockly workspace. Order matches original render order.
export const TRAINING_SCREENS = [
  { key: 'board', htmlFile: 'board.html', assetIndex: 5, zIndex: 31, withMedia: false, title: 'Board Picker' },
  { key: 'picker', htmlFile: 'train_picker.html', assetIndex: 3, zIndex: 30, withMedia: false, title: 'AI Train Picker' },
  { key: 's3Picker', htmlFile: 's3_picker.html', assetIndex: 6, zIndex: 30, withMedia: false, title: 'S3 Train Picker' },
  { key: 'train', htmlFile: 'train.html', assetIndex: 1, zIndex: 20, withMedia: true, title: 'Model Training' },
  { key: 'voice', htmlFile: 'train_voice_v2.html', assetIndex: 2, zIndex: 20, withMedia: true, title: 'Voice Training' },
  { key: 'pose', htmlFile: 'pose.html', assetIndex: 4, zIndex: 20, withMedia: true, title: 'Pose Training' },
  { key: 'gesture', htmlFile: 'gesture.html', assetIndex: 7, zIndex: 20, withMedia: true, title: 'Gesture Training' },
];
