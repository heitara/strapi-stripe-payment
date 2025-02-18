import { StatusCodes } from 'http-status-codes'

/**
 * Interface for HTTP errors.
 * @interface
 */
interface IHttpError extends Error {
    statusCode?: number
}

/**
 * Base class for HTTP errors.
 * @abstract
 * @class
 * @implements {IHttpError}
 */
abstract class HttpErrorBase extends Error implements IHttpError {
    statusCode: number

    /**
     * Creates an instance of HttpErrorBase.
     * @constructor
     * @param {string} message - The error message.
     * @param {number} [statusCode=StatusCodes.INTERNAL_SERVER_ERROR] - The HTTP status code.
     */
    constructor(message: string, statusCode?: number) {
        super(message)
        this.statusCode = statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR
        Object.setPrototypeOf(this, HttpErrorBase.prototype)
    }
}

/**
 * Error class for validation issues.
 * @class
 * @extends {HttpErrorBase}
 */
export class ValidationError extends HttpErrorBase {
    constructor(message: string) {
        super(message, StatusCodes.UNPROCESSABLE_ENTITY)
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}
