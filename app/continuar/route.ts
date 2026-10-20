import {NextRequest,NextResponse} from 'next/server';
// "Continuar no navegador" on the landing page: remember the choice and open the catalog.
export function GET(req:NextRequest){
 const response=NextResponse.redirect(new URL('/',req.url),{status:303});
 response.cookies.set('flix-web','1',{path:'/',maxAge:180*86400,sameSite:'lax'});
 return response;
}
