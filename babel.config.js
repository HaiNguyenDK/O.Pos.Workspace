// babel.config.js — BẮT BUỘC cho reanimated 4 + worklets (Sunmi/bottom-sheet dùng reanimated).
// babel-preset-expo tự thêm 'react-native-worklets/plugin' khi react-native-worklets được cài,
// nên KHÔNG add plugin worklets thủ công (sẽ bị trùng). NativeWind v5 không cần babel.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
