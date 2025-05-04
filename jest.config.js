// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom", // For React components
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json)
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"], // Optional: for setup like jest-dom
  transform: {
    // Use ts-jest for ts/tsx files and specify jsx mode
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json", // Or your tsconfig.test.json if you have one
        jsx: "react-jsx", // Or "react" depending on your tsconfig jsx setting
      },
    ],
  },
};
