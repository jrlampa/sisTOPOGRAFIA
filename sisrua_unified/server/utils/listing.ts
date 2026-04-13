import type { ListSortOrder } from '../schemas/apiSchemas.js';

export interface ListMeta<
    TSortBy extends string = string,
    TFilters extends Record<string, unknown> = Record<string, unknown>,
> {
    limit: number;
    offset: number;
    total: number;
    returned: number;
    hasMore: boolean;
    sortBy: TSortBy;
    sortOrder: ListSortOrder;
    filters: TFilters;
}

export interface BuildListMetaInput<
    TSortBy extends string,
    TFilters extends Record<string, unknown>,
> {
    limit: number;
    offset: number;
    total: number;
    returned: number;
    sortBy: TSortBy;
    sortOrder: ListSortOrder;
    filters: TFilters;
}

export function buildListMeta<
    TSortBy extends string,
    TFilters extends Record<string, unknown>,
>(input: BuildListMetaInput<TSortBy, TFilters>): ListMeta<TSortBy, TFilters> {
    const { limit, offset, total, returned, sortBy, sortOrder, filters } = input;

    return {
        limit,
        offset,
        total,
        returned,
        hasMore: offset + returned < total,
        sortBy,
        sortOrder,
        filters,
    };
}

export function comparePrimitiveValues(
    left: string | number | boolean | null | undefined,
    right: string | number | boolean | null | undefined,
    sortOrder: ListSortOrder,
): number {
    const direction = sortOrder === 'asc' ? 1 : -1;

    if (left == null && right == null) {
        return 0;
    }

    if (left == null) {
        return 1;
    }

    if (right == null) {
        return -1;
    }

    if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
    }

    if (typeof left === 'boolean' && typeof right === 'boolean') {
        return (Number(left) - Number(right)) * direction;
    }

    return String(left).localeCompare(String(right), 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
    }) * direction;
}
