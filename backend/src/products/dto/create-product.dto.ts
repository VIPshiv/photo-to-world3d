export class CreateProductDto {
  title: string;
  price: number;
  description?: string;
  category?: string; // used for auto-tagging later
}
