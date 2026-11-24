export interface DlcItem {id:number;name:string;image:string;fallbackImage:string;url:string;upcoming:boolean;releaseDate:string|null;price:string|null;currency:string|null;discount:number}
export interface DlcCatalog {items:DlcItem[];checkedAt:number;region:string;cached:boolean}
