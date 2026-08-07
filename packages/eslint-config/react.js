const base = require("./base.js");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  ...base,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
