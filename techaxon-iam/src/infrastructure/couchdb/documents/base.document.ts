export interface BaseDocument {
  _id?: string;
  _rev?: string;

  type: string;

  createdAt: string;
  updatedAt: string;
}
