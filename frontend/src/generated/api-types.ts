/**
 * 자동 생성 파일입니다. 직접 수정하지 마세요.
 * 원본: backend/openapi.json
 * 명령: pnpm gen:api-types
 * 원본이 바뀌면 명령을 다시 실행해 이 파일을 갱신합니다.
 */

export interface paths {
    "/api/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 카테고리 목록 (sortOrder 순, 발행 글 수 포함) */
        get: operations["CategoriesController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
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
    "/api/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 발행된 글 목록 */
        get: operations["PostsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/posts/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 글 상세 (이전·다음 글, 관련 글 포함) */
        get: operations["PostsController_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 글 검색 (백엔드 §5.4) */
        get: operations["SearchController_search"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 태그 목록 (발행 글 수 포함) */
        get: operations["TagsController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/posts/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 글 원문 조회 (내부 전용) */
        get: operations["InternalPostsController_detail"];
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
        CategoryRefDto: {
            /** @example 백엔드 */
            name: string;
            /** @example backend */
            slug: string;
        };
        CategoryWithCountDto: {
            /** @example 백엔드 */
            name: string;
            /**
             * @description 발행된 글 수
             * @example 0
             */
            postCount: number;
            /** @example backend */
            slug: string;
        };
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
        InternalPostDto: {
            category: components["schemas"]["CategoryRefDto"] | null;
            /** @description 마크다운 원문 */
            contentMd: string;
            coverImageUrl: string | null;
            excerpt: string;
            isFeatured: boolean;
            /** @example 0 */
            likeCount: number;
            /**
             * Format: date-time
             * @description 발행 시각 (ISO 8601)
             */
            publishedAt: string;
            /** @example 5 */
            readingMinutes: number;
            seoDescription: string | null;
            seoTitle: string | null;
            /** @example hello-world */
            slug: string;
            tags: components["schemas"]["TagRefDto"][];
            /** @example 첫 번째 글 */
            title: string;
            /** Format: date-time */
            updatedAt: string;
            /** @example 1 */
            version: number;
            /** @example 0 */
            viewCount: number;
        };
        InternalPostRedirectDto: {
            /**
             * @description 새 slug
             * @example hello-world
             */
            redirectTo: string;
        };
        InternalPostResponseDto: {
            next: components["schemas"]["PostLinkDto"] | null;
            post: components["schemas"]["InternalPostDto"];
            prev: components["schemas"]["PostLinkDto"] | null;
            related: components["schemas"]["PostSummaryDto"][];
        };
        PostDetailDto: {
            category: components["schemas"]["CategoryRefDto"] | null;
            coverImageUrl: string | null;
            excerpt: string;
            isFeatured: boolean;
            /** @example 0 */
            likeCount: number;
            /**
             * Format: date-time
             * @description 발행 시각 (ISO 8601)
             */
            publishedAt: string;
            /** @example 5 */
            readingMinutes: number;
            seoDescription: string | null;
            seoTitle: string | null;
            /** @example hello-world */
            slug: string;
            tags: components["schemas"]["TagRefDto"][];
            /** @example 첫 번째 글 */
            title: string;
            /** Format: date-time */
            updatedAt: string;
            /** @example 0 */
            viewCount: number;
        };
        PostDetailResponseDto: {
            next: components["schemas"]["PostLinkDto"] | null;
            post: components["schemas"]["PostDetailDto"];
            prev: components["schemas"]["PostLinkDto"] | null;
            related: components["schemas"]["PostSummaryDto"][];
        };
        PostLinkDto: {
            /** @example hello-world */
            slug: string;
            /** @example 첫 번째 글 */
            title: string;
        };
        PostListResponseDto: {
            items: components["schemas"]["PostSummaryDto"][];
            /** @example 1 */
            page: number;
            /** @example 9 */
            size: number;
            /** @example 0 */
            totalItems: number;
            /** @example 0 */
            totalPages: number;
        };
        PostSummaryDto: {
            category: components["schemas"]["CategoryRefDto"] | null;
            coverImageUrl: string | null;
            excerpt: string;
            /** @example 0 */
            likeCount: number;
            /**
             * Format: date-time
             * @description 발행 시각 (ISO 8601)
             */
            publishedAt: string;
            /** @example 5 */
            readingMinutes: number;
            /** @example hello-world */
            slug: string;
            /** @example 첫 번째 글 */
            title: string;
            /** @example 0 */
            viewCount: number;
        };
        TagRefDto: {
            /** @example NestJS */
            name: string;
            /** @example nestjs */
            slug: string;
        };
        TagWithCountDto: {
            /** @example NestJS */
            name: string;
            /**
             * @description 발행된 글 수
             * @example 0
             */
            postCount: number;
            /** @example nestjs */
            slug: string;
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
    CategoriesController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryWithCountDto"][];
                };
            };
        };
    };
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
    PostsController_list: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                /** @description 카테고리 slug */
                category?: string;
                /** @description 태그 slug */
                tag?: string;
                /** @description 추천 글만 */
                featured?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PostListResponseDto"];
                };
            };
            /** @description 쿼리 검증 실패 (VALIDATION_FAILED) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    PostsController_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 글 slug */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PostDetailResponseDto"];
                };
            };
            /** @description 이전 slug로 요청함. Location 헤더가 새 경로를 가리킨다 */
            301: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 글 없음 (POST_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    SearchController_search: {
        parameters: {
            query: {
                page?: number;
                size?: number;
                /** @description 검색어 (2자 이상) */
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PostListResponseDto"];
                };
            };
            /** @description 쿼리 검증 실패 (VALIDATION_FAILED) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
        };
    };
    TagsController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TagWithCountDto"][];
                };
            };
        };
    };
    InternalPostsController_detail: {
        parameters: {
            query?: never;
            header: {
                /** @description 내부 API 키 */
                "X-Internal-Key": string;
            };
            path: {
                /** @description 글 slug (이전 slug면 redirectTo 응답) */
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InternalPostResponseDto"] | components["schemas"]["InternalPostRedirectDto"];
                };
            };
            /** @description 키 없음·불일치 (UNAUTHORIZED) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponseDto"];
                };
            };
            /** @description 글 없음 (POST_NOT_FOUND) */
            404: {
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
