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
        TerminusHealthCheckResult: {
            /**
             * @example {
             *       "database": {
             *         "responseTime": 12,
             *         "status": "up"
             *       }
             *     }
             */
            details: {
                [key: string]: components["schemas"]["TerminusHealthIndicatorResult"] & {
                    [key: string]: unknown;
                };
            };
            /** @example {} */
            error?: {
                [key: string]: components["schemas"]["TerminusHealthIndicatorResult"] & {
                    [key: string]: unknown;
                };
            } | null;
            /**
             * @example {
             *       "database": {
             *         "responseTime": 12,
             *         "status": "up"
             *       }
             *     }
             */
            info?: {
                [key: string]: components["schemas"]["TerminusHealthIndicatorResult"] & {
                    [key: string]: unknown;
                };
            } | null;
            /**
             * @example ok
             * @enum {string}
             */
            status: "error" | "ok" | "degraded" | "shutting_down";
        };
        TerminusHealthIndicatorResult: {
            /** @description Whether this result was served from the cache */
            cachedResponse?: boolean;
            /** @description Time the health indicator took to respond, in ms */
            responseTime?: number;
            /**
             * @description The status of this health indicator
             * @enum {string}
             */
            status: "up" | "degraded" | "down";
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
            /** @description The Health Check is successful */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @example {
                         *       "database": {
                         *         "responseTime": 12,
                         *         "status": "up"
                         *       }
                         *     }
                         */
                        details?: unknown;
                        /** @example {} */
                        error?: unknown;
                        /**
                         * @example ok
                         * @enum {unknown}
                         */
                        status?: "ok" | "degraded";
                    } & components["schemas"]["TerminusHealthCheckResult"];
                };
            };
            /** @description The Health Check is not successful */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * @example {
                         *       "database": {
                         *         "responseTime": 12,
                         *         "status": "up"
                         *       },
                         *       "redis": {
                         *         "message": "Could not connect",
                         *         "responseTime": 3005,
                         *         "status": "down"
                         *       }
                         *     }
                         */
                        details?: unknown;
                        /**
                         * @example {
                         *       "redis": {
                         *         "message": "Could not connect",
                         *         "responseTime": 3005,
                         *         "status": "down"
                         *       }
                         *     }
                         */
                        error?: unknown;
                        /**
                         * @example error
                         * @enum {unknown}
                         */
                        status?: "error" | "shutting_down";
                    } & components["schemas"]["TerminusHealthCheckResult"];
                };
            };
        };
    };
}
