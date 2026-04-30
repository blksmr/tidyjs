// Other
import { isWithinInterval }            from 'date-fns';
import {
    find,
    isNaN,
    reduce,
    filter,
    reject,
    orderBy,
    isNumber,
    isString,
    capitalize
}                                      from 'lodash';
import type {
    FieldError,
    FieldErrors,
    RegisterOptions as ValidationRules
}                                      from 'react-hook-form';

// @app/feature
import { ItemTypeEnum }                  from '@app/feature/models/enums/ItemType';
import type ItemModel                    from '@app/feature/models/ItemModel';
import type { HistoryEntry }             from '@app/feature/models/items/HistoryModel';
import type GroupModel                   from '@app/feature/models/GroupModel';
import type SearchResultModel            from '@app/feature/models/SearchResultModel';
import type { ResultDetailModel }        from '@app/feature/models/SearchResultModel';
import type { CatalogModel }             from '@app/feature/providers/catalog/CatalogContextProvider';

// @/lib
import { required }        from '@/lib/form/providers/validation';
import {
    isStringDate,
    getDateFormat
}                          from '@/lib/utils/dates';
import { getRoundedValue } from '@/lib/utils/number';
import type { FieldType }  from '@/lib/form/models/FieldModel';

export const getValuesByCodes = (entries: HistoryEntry[] = [], codes: string[] = []): Record<string, string> =>
    reduce(codes, (result, code) =>
        Object.assign(result, { [code]: find(entries, { property_key: code })?.values?.[0] })
    , {} as Record<string, string>);

export const getValueByPropertyKey = <T extends HistoryEntry[]>(entries: T | undefined, key: string): string => {
    const entry = entries?.find((e) => e.property_key === key);
    return entry ? entry.values[0] : 'No value';
};

export const getIntValueByPropertyKey = <T extends HistoryEntry[]>(entries: T | undefined, key: string): number => {
    const entry = entries?.find((e) => e.property_key === key);
    return entry && !isNaN(Number(entry.values[0])) ? Number(entry.values[0]) : 0;
};

export const buildDataMap = (
    history: HistoryEntry[] = [],
    items: ItemModel[]
): Record<string, string> => reduce(
    reject(history, (entry: HistoryEntry) =>
        filter(history, { property_key: entry.property_key })?.length > 1
            ? entry.scope !== 'user'
            : false
    ), (result, entry) => {
        const item = find(items, { code: entry.property_key });
        const isNumberType = ItemTypeEnum.code(entry.type_id) === 'Numeric';
        const isBooleanType = ItemTypeEnum.code(entry.type_id) === 'Boolean';
        return Object.assign(result, {
            [entry.property_key]: (
                item?.link?.is_multiple
                    ? entry.values
                    : isBooleanType
                        ? !entry.values[0] ? false : entry.values[0]
                        : isNumberType && isNumber(Number(entry.values[0])) && !isNaN(Number(entry.values[0]))
                            ? getRoundedValue(Number(entry.values[0]))
                            : entry.values[0]
            ) ?? null
        });
    }, {}
);

export const getMappedValues = (data: SearchResultModel|ResultDetailModel): Record<string, string> =>
    reduce(data.field_mapping, (result, value, key) =>
        Object.assign(result, { [key]: data[value[0] as keyof (SearchResultModel | ResultDetailModel)] }),
    {});

export const getFormattedValue = (value: string): string => {
    if (isStringDate(value, 'server')) {
        return getDateFormat(`${value}`, 'user');
    } else if (value === 'false') {
        return 'No';
    } else if (value === 'true') {
        return 'Yes';
    } else {
        return value || '-';
    }
};

export const getTypeValue = (type?: number, table_reference_id?: string | null): FieldType => {
    switch(type) {
    case 1:
        return 'toggle';
    case 2:
        return table_reference_id ? 'selectBlueprint' : 'text';
    case 3:
        return 'date';
    case 4:
        return 'number';
    default:
        return 'text';
    }
};

export const isExpired = (
    startDate: string | null | undefined,
    endDate: string | null | undefined,
    referenceDate: string
): boolean => !isWithinInterval(new Date(referenceDate), {
    start: new Date(startDate ?? '0001-01-01'),
    end: new Date(endDate ?? '9999-12-31')
});

export type FieldRules = {
    key: string;
    rules: ValidationRules;
}

export const getListFieldRules = (itemList: ItemModel[]): FieldRules[] =>
    itemList.map((item) => {
        const fieldRules: FieldRules = {
            key: `attributes.${item.code}`,
            rules: {
                required: item.required ? required : false
            }
        };
        if(isString(item.regex_validation)) {
            fieldRules.rules.pattern = {
                value: new RegExp(item.regex_validation),
                message: item.regex_error_message || 'Invalid format'
            };
        }
        return fieldRules;
    });

const getGroupByLabel = (label: string, type: number, catalog?: CatalogModel,): GroupModel | null =>
    find(catalog?.groups?.[type], { label: label }) ?? null;

const getGroupByCode = (code: string, type: number, catalog?: CatalogModel,): GroupModel | null =>
    find(catalog?.groups?.[type], { code: code }) ?? null;

export const getItemsByGroup = <T extends string>(
    label: T,
    type: number,
    catalog?: CatalogModel
): ItemModel[] =>
        orderBy(filter(catalog?.items?.[type], {
            group_id: getGroupByLabel(label, type, catalog)?.id
        }), ['position']);

export const getItemsByGroupCode = <T extends string>(
    code: T,
    type: number,
    catalog?: CatalogModel
): ItemModel[] =>
        orderBy(filter(catalog?.items?.[type], {
            group_id: getGroupByCode(code, type, catalog)?.id
        }), ['position']);

export const startsWithPrefix = (firstItem: string | undefined, prefix: string): boolean => {
    if (firstItem?.startsWith(prefix)) {
        return true;
    } else {
        return false;
    }
};

/**
 *
 * @param prefixA Prefix of master entity
 * @param prefixB Prefix of slave entity
 * @param master Whether the link is master or slave
 * @returns **xxxLinkXxxYyy** - Generates a link name dynamically based on master/slave relationship
 */

export const getLinkName = (prefixA: string, prefixB: string, master: boolean): string =>
    master
        ? `${prefixA}Link${capitalize(prefixA)}${capitalize(prefixB)}`
        : `${prefixB}Link${capitalize(prefixA)}${capitalize(prefixB)}`;
