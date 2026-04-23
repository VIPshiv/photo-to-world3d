export class CreateProductDto {
  title: string;
  price: number;
  description?: string;
  category?: string; // used for auto-tagging later
  externalLink?: string; // external link for the explore button
  sceneId?: string; // tie product to specific scene
}
