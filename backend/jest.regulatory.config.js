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
  coverageDirectory: "coverage/regulatory-core",
  collectCoverageFrom: [
    "src/service/fullProfessorProcedureService.ts",
    "src/service/individualEvaluationService.ts",
    "src/service/specialCommissionService.ts",
    "src/util/individualEvaluationPdf.ts",
    "src/util/proceduralDeadline.ts",
    "src/util/rscScoring.ts",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/src/(?!service/(?:fullProfessorProcedureService|individualEvaluationService|specialCommissionService)\\.ts$|util/(?:individualEvaluationPdf|proceduralDeadline|rscScoring)\\.ts$)",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 60,
    },
  },
}
