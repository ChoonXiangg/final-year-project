const path = require("path");

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  jest: {
    configure: {
      setupFiles: ["<rootDir>/src/setupTests.ts"],
      setupFilesAfterFramework: [],
      moduleNameMapper: {
        "^react-router-dom$": "<rootDir>/node_modules/react-router-dom/dist/index.js",
        "^react-router/dom$": "<rootDir>/node_modules/react-router/dist/development/dom-export.js",
        "^react-router$": "<rootDir>/node_modules/react-router/dist/development/index.js",
      },
    },
  },
};
