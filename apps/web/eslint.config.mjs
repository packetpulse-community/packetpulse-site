import { baseConfig } from "@packetpulse/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
