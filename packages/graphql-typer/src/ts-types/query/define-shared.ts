import {
  GraphQLSchema,
  GraphQLType,
  GraphQLList,
  GraphQLNullableType,
  GraphQLScalarType,
  GraphQLInputType,
  GraphQLInputObjectType,
  isScalarType,
  isNonNullType,
  isListType,
  isEnumType,
  isInputObjectType,
} from 'graphql';

import {defineScalarType} from '../schema/scalar-type';
import {defineEnumType} from '../schema/enum-type';
import {defineInputType} from '../schema/input-type';

import {TextBuilder} from '../utils';
import {
  TypePosition,
  isBuiltin as isBuiltinScalar,
  getBuiltin as getBuiltinScalar,
} from '../builtin-scalars';
import {CommonHeader, IdOfDefinition} from '../shared';

import {ImportedType} from './types';

let writeType: (type: GraphQLType) => string;

const writeScalarType = (type: GraphQLScalarType): string =>
  getBuiltinScalar(type, TypePosition.CLIENT_INPUT) || type.name;

const writeListType = (type: GraphQLList<any>): string => {
  let innerType = writeType(type.ofType);
  if (isNonNullType(type.ofType)) {
    return `${innerType}[]`;
  }
  // innerType is `T | null | undefined`. We need some extra parentheses for precedence.
  return `(${innerType})[]`;
};

const writeNullableType = (type: GraphQLNullableType): string => {
  if (isScalarType(type)) {
    return writeScalarType(type);
  }
  if (isListType(type)) {
    return writeListType(type);
  }
  return type.name;
};

writeType = (type: GraphQLType): string => {
  if (isNonNullType(type)) {
    return writeNullableType(type.ofType);
  }
  const typeText = writeNullableType(type);
  return `${typeText} | null | undefined`;
};

const QueryDefinition =
  `const ArgsSymbol = Symbol();\n` +
  `const ResultSymbol = Symbol();\n` +
  `\n` +
  `// Similar to the IdOf type, this is a hack to attach extra metadata to a query.\n` +
  `// The symbol fields don't actually exist (the value is a string), but allow us\n` +
  `// to extract the argument and result types from the query.\n` +
  `export type Query<A, R> = string & {\n` +
  `  [ArgsSymbol]: A;\n` +
  `  [ResultSymbol]: R;\n` +
  `};\n` +
  `\n` +
  `export type QueryArgs<Q> = Q extends Query<infer A, any> ? A : unknown;\n` +
  `export type QueryResult<Q> = Q extends Query<any, infer R> ? R : unknown;\n`;

const getInnerType = (type: GraphQLInputType): ImportedType =>
  isNonNullType(type) ? getInnerType(type.ofType) :
  isListType(type) ? getInnerType(type.ofType) :
  type;

const collectInputFieldTypes = (
  allUsedTypes: Set<ImportedType>,
  type: GraphQLInputObjectType
) => {
  for (const field of Object.values(type.getFields())) {
    const fieldType = getInnerType(field.type);
    if (isScalarType(fieldType)) {
      if (!isBuiltinScalar(fieldType)) {
        allUsedTypes.add(fieldType);
      }
    } else if (isEnumType(fieldType)) {
      allUsedTypes.add(fieldType);
    } else if (!allUsedTypes.has(fieldType)) {
      allUsedTypes.add(fieldType);
      collectInputFieldTypes(allUsedTypes, fieldType);
    }
  }
};

const defineShared = (
  schema: GraphQLSchema,
  usedTypes: Set<ImportedType>
): string => {
  const result = new TextBuilder();

  result
    .appendLine(CommonHeader)
    .appendLine(QueryDefinition)
    .appendLine(IdOfDefinition);

  // Input type fields can reference other types that aren't mentioned
  // in any operation. We need to include those in the output as well.
  const allUsedTypes = new Set<ImportedType>();
  for (const type of usedTypes) {
    if (isInputObjectType(type)) {
      collectInputFieldTypes(allUsedTypes, type);
    }
    allUsedTypes.add(type);
  }

  for (const type of allUsedTypes) {
    if (isScalarType(type)) {
      defineScalarType(result, type);
    } else if (isEnumType(type)) {
      defineEnumType(result, type);
    } else {
      defineInputType(result, type, writeType);
    }

    result.appendLine('');
  }

  return result.toString();
};

export default defineShared;