import { Routes } from '@angular/router';
import { CompanyRegisterComponent } from './pages/company-register/company-register.component';
import { CategoryRegisterComponent } from './pages/category-register/category-register.component';
import { BrandRegisterComponent } from './pages/brand-register/brand-register.component';
import { ProductRegisterComponent } from './pages/product-register/product-register.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'companies',
    pathMatch: 'full'
  },
  {
    path: 'companies',
    component: CompanyRegisterComponent,
    title: 'Company Management | CorpRegistry PRO'
  },
  {
    path: 'categories',
    component: CategoryRegisterComponent,
    title: 'Category Management | CategoryRegistry PRO'
  },
  {
    path: 'brands',
    component: BrandRegisterComponent,
    title: 'Brand Management | BrandRegistry PRO'
  },
  {
    path: 'products',
    component: ProductRegisterComponent,
    title: 'Product Management | ProductRegistry PRO'
  },
  {
    path: '**',
    redirectTo: 'companies'
  }
];
