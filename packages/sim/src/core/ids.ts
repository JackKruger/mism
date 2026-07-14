export type PersonId = number & { readonly __brand: "PersonId" };
export type ObjectId = number & { readonly __brand: "ObjectId" };

export const asPersonId = (n: number): PersonId => n as PersonId;
export const asObjectId = (n: number): ObjectId => n as ObjectId;
