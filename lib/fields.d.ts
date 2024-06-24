export declare const type_pg_map: {
    [key: string]: string;
};
export declare class FieldDef {
    type: string;
    references_table?: string;
    unique?: boolean;
    optional?: boolean;
    secret?: boolean;
    default?: string;
    constructor(type: string, options?: {
        [key: string]: any;
    });
}
export type FieldDefs = {
    [key: string]: FieldDef;
};
export declare function make_field_defs_sql(fields: FieldDefs): string;
