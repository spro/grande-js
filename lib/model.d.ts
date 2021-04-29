import * as pg from 'pg';
import { AnyDict } from './helpers';
import { FieldDefs } from './fields';
import { AnyRelationship } from './relationship';
declare type Query = AnyDict;
declare type QueryOptions = AnyDict;
declare type SetOptions = {
    replace?: boolean;
};
declare type ModelRef = typeof Model;
export declare class Model {
    static _conn: pg.PoolClient;
    static _registered: {
        [key: string]: ModelRef;
    };
    static _table: string;
    static _fields: FieldDefs;
    static _relationships: {
        [key: string]: AnyRelationship;
    };
    id: number;
    constructor(data: any);
    publicFieldData(data: any): {};
    static register(constructor: ModelRef): void;
    static table_exists(): Promise<boolean>;
    static create_table_sql(drop: boolean): string;
    static create_table(drop: boolean): Promise<void>;
    static ensure_relationships(): void;
    static create_relationship_tables(): Promise<void>;
    static create_relationship_tables_sql(drop: boolean): string;
    static create<T extends Model>(create_obj: AnyDict): Promise<T>;
    static get<T extends Model>(id: number): Promise<T | null>;
    static find<T extends Model>(query: Query, options?: QueryOptions): Promise<T[]>;
    static find_one<T extends Model>(query: Query): Promise<T>;
    static update<T extends Model>(id: number, update_obj: AnyDict): Promise<T>;
    update<T extends Model>(update_obj: AnyDict): Promise<T>;
    static delete<T extends Model>(id: number): Promise<{
        success: boolean;
    }>;
    delete<T extends Model>(): Promise<{
        success: boolean;
    }>;
    set_related<T extends Model>(relationship_name: string, item: T, options?: SetOptions): Promise<void>;
    add_related<T extends Model>(relationship_name: string, items: T[]): Promise<any[]>;
    get_relationship<T extends Model>(relationship_name: string): Promise<T | null>;
    get_related<T extends Model>(relationship_name: string): Promise<T | null>;
    find_related<T extends Model>(relationship_name: string, options?: AnyDict): Promise<T[]>;
    unset_related<T extends Model>(relationship_name: string, item: T): Promise<void>;
    remove_related<T extends Model>(relationship_name: string, items: T[]): Promise<void>;
}
export {};
