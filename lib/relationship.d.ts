import * as pg from 'pg';
import { FieldDefs } from './fields';
export declare function make_foreign_keys_str(fields: FieldDefs): string;
export declare class Relationship {
    from_model_name: string;
    to_model_name: string;
    relationship_name: string;
    relationship_extra?: any;
    static _registered: {
        [key: string]: Relationship;
    };
    readonly kind = "forward";
    readonly singular: boolean;
    reverse?: ReverseRelationship;
    constructor(from_model_name: string, to_model_name: string, relationship_name: string, relationship_extra?: any);
    create_table_sql(drop: boolean): string;
    create_table(pool: pg.Pool, drop?: boolean): Promise<void>;
    get_details(): [any, any, string, string, string, boolean];
}
export declare class ToManyRelationship extends Relationship {
    singular: boolean;
}
export declare class ToOneRelationship extends Relationship {
    singular: boolean;
}
export declare class ReverseRelationship {
    reverse_model_name: string;
    reverse_relationship_name: string;
    singular: boolean;
    readonly kind = "reverse";
    constructor(reverse_model_name: string, reverse_relationship_name: string, singular?: boolean);
    update_forward(): void;
    get_details(): [any, any, string, string, string, boolean];
}
export type AnyRelationship = ToManyRelationship | ToOneRelationship | ReverseRelationship;
