import * as pg from 'pg';
import { AnyDict } from './helpers';
import { Model } from './model';
import { FieldDef } from './fields';
import { Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship } from './relationship';
export { Model, FieldDef, Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship };
declare let conn: pg.PoolClient;
export { conn };
export declare function connect(connection_options?: AnyDict): Promise<pg.PoolClient>;
export declare function create_sql(drop?: boolean): void;
export declare function release(): Promise<void>;
