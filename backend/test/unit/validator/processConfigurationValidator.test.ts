import { describe, expect, test } from "@jest/globals";
import {
  createProcessTypeSchema,
  createProcessTypeVersionSchema,
} from "../../../src/validator/processConfigurationValidator";

describe("processConfigurationValidator", () => {
  test("normalizes a process type and accepts document requirements", () => {
    const result = createProcessTypeSchema.validate({
      code: "training_leave",
      name: "Licença para capacitação",
      category: "SIMPLE",
      requirements: [
        {
          code: "request_form",
          name: "Requerimento",
          acceptedFormats: "pdf",
          maxSizeMb: 10,
        },
      ],
    });

    expect(result.error).toBeUndefined();
    expect(result.value.code).toBe("TRAINING_LEAVE");
    expect(result.value.requirements[0].code).toBe("REQUEST_FORM");
  });

  test("rejects duplicated document codes in the same version", () => {
    const result = createProcessTypeVersionSchema.validate({
      name: "Licença para capacitação",
      category: "SIMPLE",
      requirements: [
        { code: "REQUEST", name: "Requerimento" },
        { code: "REQUEST", name: "Outro requerimento" },
      ],
    });

    expect(result.error).toBeDefined();
  });

  test("rejects invalid codes and file size limits", () => {
    const result = createProcessTypeSchema.validate({
      code: "tipo com espaço",
      name: "Tipo inválido",
      category: "SIMPLE",
      requirements: [{ code: "FILE", name: "Arquivo", maxSizeMb: 0 }],
    });

    expect(result.error).toBeDefined();
  });
});
