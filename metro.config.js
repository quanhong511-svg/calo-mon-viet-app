// Ổ ExFAT khiến macOS tạo file "._*" (AppleDouble) cạnh mỗi file.
// Bỏ qua chúng để Metro / Expo Router không cố biên dịch.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const appleDouble = /(^|[\/\\])\._[^\/\\]*$/;
const existing = config.resolver.blockList;
config.resolver.blockList = existing
  ? [].concat(existing, appleDouble)
  : appleDouble;

// Mô hình nhận diện món ăn (assets/models/foodnet.bin) được đóng gói như một file tài nguyên
if (!config.resolver.assetExts.includes('bin')) config.resolver.assetExts.push('bin');

module.exports = config;
