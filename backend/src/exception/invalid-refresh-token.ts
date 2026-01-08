export class InvalidRefreshToken extends Error {
    constructor() {
        super("Invalid Refresh Token")
    }
}