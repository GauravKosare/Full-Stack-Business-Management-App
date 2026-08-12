/// <reference types="nativewind/types" />

// This NativeWind version's types don't declare a *.css module — needed for the
// side-effect `import "./global.css"` in App.tsx (metro.config.js handles it at
// bundle time via withNativeWind; this is purely to satisfy tsc).
declare module "*.css";
