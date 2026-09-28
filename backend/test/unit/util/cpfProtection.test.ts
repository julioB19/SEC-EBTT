import { describe, expect, test } from "@jest/globals";
import {
  decryptCpf,
  encryptCpf,
  hashCpf,
  normalizeCpf,
  readProtectedCpf,
} from "../../../src/util/cpfProtection";

describe("cpfProtection", () => {
  test("normaliza, criptografa e recupera o CPF", () => {
    const encrypted = encryptCpf("529.982.247-25");

    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(encrypted).not.toContain("52998224725");
    expect(decryptCpf(encrypted)).toBe("52998224725");
  });

  test("gera hash determinístico sem expor o CPF", () => {
    const first = hashCpf("52998224725");
    const second = hashCpf("529.982.247-25");

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("52998224725");
  });

  test("mantém leitura temporária do campo legado", () => {
    expect(
      readProtectedCpf({ cpf: "529.982.247-25", cpfEncrypted: null }),
    ).toBe("52998224725");
  });

  test("detecta adulteração do conteúdo criptografado", () => {
    const encrypted = encryptCpf("52998224725");
    const replacement = encrypted.endsWith("A") ? "B" : "A";
    const tampered = `${encrypted.slice(0, -1)}${replacement}`;

    expect(() => decryptCpf(tampered)).toThrow();
  });
});
