export interface OutlineItem {
  title: string;
  pageNumber: number;
  level?: number;
  items?: OutlineItem[];
  children?: OutlineItem[];
}
