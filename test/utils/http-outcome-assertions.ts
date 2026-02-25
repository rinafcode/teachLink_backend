import { HttpException } from '@nestjs/common';

export async function expectHttpError(callback: () => Promise<unknown>, statusCode: number) {
  await expect(callback()).rejects.toMatchObject({
    status: statusCode,
  });
}

export async function expectSuccess<T>(callback: () => Promise<T>) {
  await expect(callback()).resolves.toBeDefined();
}

export async function expectNotFound(callback: () => Promise<unknown>) {
  await expectHttpError(callback, 404);
}

export async function expectValidationFailure(callback: () => Promise<unknown>) {
  await expectHttpError(callback, 400);
}

export async function expectUnauthorized(callback: () => Promise<unknown>) {
  await expectHttpError(callback, 401);
}

export function expectHttpExceptionWithMessage(error: unknown, message: string) {
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).message).toContain(message);
}
