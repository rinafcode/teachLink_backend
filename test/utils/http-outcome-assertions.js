"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expectHttpError = expectHttpError;
exports.expectSuccess = expectSuccess;
exports.expectNotFound = expectNotFound;
exports.expectValidationFailure = expectValidationFailure;
exports.expectUnauthorized = expectUnauthorized;
exports.expectHttpExceptionWithMessage = expectHttpExceptionWithMessage;
const common_1 = require("@nestjs/common");
async function expectHttpError(callback, statusCode) {
    await expect(callback()).rejects.toMatchObject({
        status: statusCode,
    });
}
async function expectSuccess(callback) {
    await expect(callback()).resolves.toBeDefined();
}
async function expectNotFound(callback) {
    await expectHttpError(callback, 404);
}
async function expectValidationFailure(callback) {
    await expectHttpError(callback, 400);
}
async function expectUnauthorized(callback) {
    await expectHttpError(callback, 401);
}
function expectHttpExceptionWithMessage(error, message) {
    expect(error).toBeInstanceOf(common_1.HttpException);
    expect(error.message).toContain(message);
}
//# sourceMappingURL=http-outcome-assertions.js.map