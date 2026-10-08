import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { CompanyRegisterComponent } from './pages/company-register/company-register.component';
import { CategoryRegisterComponent } from './pages/category-register/category-register.component';
import { BrandRegisterComponent } from './pages/brand-register/brand-register.component';
import { ProductRegisterComponent } from './pages/product-register/product-register.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'companies',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Sign In | CorpRegistry PRO'
  },
  {
    path: 'companies',
    component: CompanyRegisterComponent,
    canActivate: [authGuard],
    title: 'Company Management | CorpRegistry PRO'
  },
  {
    path: 'categories',
    component: CategoryRegisterComponent,
    canActivate: [authGuard],
    title: 'Category Management | CategoryRegistry PRO'
  },
  {
    path: 'brands',
    component: BrandRegisterComponent,
    canActivate: [authGuard],
    title: 'Brand Management | BrandRegistry PRO'
  },
  {
    path: 'products',
    component: ProductRegisterComponent,
    canActivate: [authGuard],
    title: 'Product Management | ProductRegistry PRO'
  },
  {
    path: '**',
    redirectTo: 'companies'
  }
];

