/**
 * 자동 생성 파일입니다. 직접 수정하지 마세요.
 * 원본: backend/openapi.json
 * 명령: pnpm gen:api-types
 * 원본이 바뀌면 명령을 다시 실행해 이 파일을 갱신합니다.
 */

export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ErrorResponseDto: {
            /** @example SERVICE_UNAVAILABLE */
            code: string;
            message: string;
            /** @example /api/health */
            path: string;
            /** @example 503 */
            statusCode: number;
            /** Format: date-time */
            timestamp: string;
        };
        HealthResponseDto: {
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            details: {
                [key: string]: {
                    [key: string]: unknown;
                };
            };
            /** @example {} */
            error: {
                [key: string]: {
                    [key: string]: unknown;
                };
            };
            /**
             * @example {
             *       "database": {
             *         "status": "up"
             *       }
             *     }
             */
            info: {
                [key: string]: {
                    [key: string]: unknown;
                };
            };
            /** @example ok */
            status: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_check: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description DB 연결 정상 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponseDto"];
                };
            };
            /** @description DB 연결 실패 */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
}
