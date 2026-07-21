import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  /**
   * Skip API routes, Next internals, and anything with a file extension.
   *
   * /admin is deliberately excluded: it is the operator back office, is not
   * translated, and running it through locale negotiation would only add a
   * redirect hop to pages no customer sees.
   *
   * The file-extension guard matters for robots.txt and sitemap.xml, which are
   * route handlers rather than pages: routing them through locale negotiation
   * would redirect crawlers away from the canonical URLs.
   */
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
