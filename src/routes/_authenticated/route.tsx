import {createFileRoute,Outlet,redirect} from '@tanstack/react-router';
import {getCurrentUser} from '@/lib/auth.functions';
export const Route=createFileRoute('/_authenticated')({ssr:false,beforeLoad:async({location})=>{const user=await getCurrentUser().catch(()=>null);if(!user)throw redirect({to:'/auth',search:{mode:'login',redirect:location.href}});},component:Outlet});
