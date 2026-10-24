import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Sitede Server Action yok; Next-Action basligi tasiyan her istek bot taramasi.
  // Engellenmezse Next.js sayfa render'ina duser ve InvariantError firlatir.
  if (request.headers.has('next-action')) {
    return new NextResponse(null, { status: 400 });
  }

  // / kok URL'i icin public/index.html'i serve et (statik widget)
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/index.html', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
