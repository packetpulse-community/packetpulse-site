import { baseConfig } from "@packetpulse/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
