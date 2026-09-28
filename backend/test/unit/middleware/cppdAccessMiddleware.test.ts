import { describe, expect, jest, test } from "@jest/globals";
import { RoleName } from "@prisma/client";
import { requireSelectedRole } from "../../../src/middleware/cppdAccessMiddleware";

function responseMock() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("cppdAccessMiddleware", () => {
  test("allows a selected role included in the allowed roles", () => {
    const next = jest.fn();
    const middleware = requireSelectedRole(
      RoleName.ADMIN,
      RoleName.CPPD_CENTRAL,
    );

    middleware(
      { user: { selectedRole: RoleName.ADMIN } } as any,
      responseMock(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("blocks a selected role outside the allowed roles", () => {
    const next = jest.fn();
    const res = responseMock();
    const middleware = requireSelectedRole(RoleName.ADMIN);

    middleware(
      { user: { selectedRole: RoleName.CPPD_MEMBER } } as any,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("blocks requests without a selected role", () => {
    const next = jest.fn();
    const res = responseMock();
    const middleware = requireSelectedRole(RoleName.ADMIN);

    middleware({ user: {} } as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
