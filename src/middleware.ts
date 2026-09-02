import { NextResponse, type NextRequest } from 'next/server';

// / kok URL'i icin public/index.html'i serve et (statik widget)
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/index.html', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
