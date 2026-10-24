export interface CustomSelectOption<T = any> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string | number;
  icon?: string;
  disabled?: boolean;
}
