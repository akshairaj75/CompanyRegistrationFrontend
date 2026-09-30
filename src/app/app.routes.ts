import { Routes } from '@angular/router';
import { CompanyRegisterComponent } from './pages/company-register/company-register.component';

export const routes: Routes = [
  {
    path: '',
    component: CompanyRegisterComponent,
    title: 'Company Registration | CorpRegistry PRO'
  },
  {
    path: 'register',
    component: CompanyRegisterComponent,
    title: 'Company Registration | CorpRegistry PRO'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
