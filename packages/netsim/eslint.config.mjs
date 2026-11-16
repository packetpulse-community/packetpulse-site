import { baseConfig } from "@packetpulse/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["node_modules/**"],
  },
];
