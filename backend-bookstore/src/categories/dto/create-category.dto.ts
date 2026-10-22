export class CreateCategoryDto {
  name: string;
  slug: string;
  level: number;
  parent_id?: string;
  sort_order?: number;
}

