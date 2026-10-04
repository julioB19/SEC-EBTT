module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  collectCoverage: true,
  coverageProvider: "v8",
  coverageReporters: ["json", "text", "lcov", "clover"],
  resetMocks: true,
  resetModules: false,
  testTimeout: 30000,
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 60,
    },
  },
}
