import { Query } from 'react-native-appwrite';

import { tablesDB } from './client';
import { appwriteConfig, type TableId } from './config';
import { toAppError } from './errors';

export { Query };

export interface RowList<T> {
  rows: T[];
  total: number;
}

/** Typed read helpers. Writes go through the API function (see api.ts). */
export async function getRow<T>(tableId: TableId, rowId: string): Promise<T> {
  try {
    return (await tablesDB.getRow({ databaseId: appwriteConfig.databaseId, tableId, rowId })) as unknown as T;
  } catch (error) {
    throw toAppError(error);
  }
}

/** Returns null when the row does not exist (or is not visible to the user). */
export async function findRow<T>(tableId: TableId, rowId: string): Promise<T | null> {
  try {
    return await getRow<T>(tableId, rowId);
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === 'not_found' || appError.code === 'document_not_found' || appError.code === 'row_not_found') return null;
    throw appError;
  }
}

export async function listRows<T>(tableId: TableId, queries: string[] = []): Promise<RowList<T>> {
  try {
    const result = await tablesDB.listRows({ databaseId: appwriteConfig.databaseId, tableId, queries });
    return { rows: result.rows as unknown as T[], total: result.total };
  } catch (error) {
    throw toAppError(error);
  }
}
