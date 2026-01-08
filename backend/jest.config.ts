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
  resetModules: true,
}
