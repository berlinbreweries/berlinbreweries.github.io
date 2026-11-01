"""The basic SEO setup must stay consistent: title, description, canonical URL, social card, sitemap, robots."""
import html, json, os, re, struct, unittest
from helpers import ROOT, read


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    assert head[:8] == b'\x89PNG\r\n\x1a\n', path + ' is not a PNG'
    return struct.unpack('>II', head[16:24])


class SeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = read(os.path.join(ROOT, 'index.html'))
        cls.head = cls.page[:cls.page.index('</head>')]

    def meta(self, key, attr='name'):
        m = re.search(r'<meta %s="%s" content="([^"]*)"' % (attr, re.escape(key)), self.head)
        self.assertIsNotNone(m, 'missing <meta %s="%s">' % (attr, key))
        return html.unescape(m.group(1))

    def canonical(self):
        m = re.search(r'<link rel="canonical" href="([^"]+)"', self.head)
        self.assertIsNotNone(m, 'missing canonical link')
        return m.group(1)

    def test_title_is_human_and_not_too_long(self):
        t = html.unescape(re.search(r'<title>(.*?)</title>', self.head).group(1))
        self.assertIn('Tour de Berlin Breweries', t)
        self.assertNotIn('TDBB results', t)
        self.assertLessEqual(len(t), 65, 'search results cut titles at about 60 characters')

    def test_description_has_a_good_length(self):
        d = self.meta('description')
        self.assertTrue(70 <= len(d) <= 160, 'description is %d characters; search results cut it at about 160' % len(d))

    def test_the_script_and_the_html_agree_on_the_main_title(self):
        t = html.unescape(re.search(r'<title>(.*?)</title>', self.head).group(1))
        js = re.search(r"const BASE_TITLE='([^']*)'", self.page)
        self.assertIsNotNone(js)
        self.assertEqual(js.group(1), t)

    def test_canonical_url_is_used_everywhere(self):
        site = self.canonical()
        self.assertTrue(site.startswith('https://') and site.endswith('/'), site)
        self.assertEqual(self.meta('og:url', 'property'), site)
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', self.head, re.S).group(1))
        self.assertEqual((ld['@type'], ld['url']), ('WebSite', site))
        self.assertIn('<loc>%s</loc>' % site, read(os.path.join(ROOT, 'sitemap.xml')))
        self.assertIn('Sitemap: %ssitemap.xml' % site, read(os.path.join(ROOT, 'robots.txt')))

    def test_social_card_image_exists_with_the_declared_size(self):
        site = self.canonical()
        img = self.meta('og:image', 'property')
        self.assertTrue(img.startswith(site), 'the image URL must be absolute')
        path = os.path.join(ROOT, img[len(site):])
        self.assertEqual(png_size(path), (int(self.meta('og:image:width', 'property')), int(self.meta('og:image:height', 'property'))))
        self.assertEqual(png_size(path), (1200, 630))
        self.assertEqual(self.meta('twitter:card'), 'summary_large_image')
        self.assertTrue(self.meta('og:image:alt', 'property'))

    def test_touch_icon_exists_and_is_180px(self):
        href = re.search(r'<link rel="apple-touch-icon" href="([^"]+)"', self.head).group(1)
        self.assertEqual(png_size(os.path.join(ROOT, href)), (180, 180))

    def test_robots_allows_crawling_and_the_page_is_indexable(self):
        robots = read(os.path.join(ROOT, 'robots.txt'))
        self.assertIn('User-agent: *', robots)
        self.assertNotRegex(robots, r'(?m)^Disallow:\s*/\s*$')
        self.assertNotIn('noindex', self.meta('robots'))

    def test_language_viewport_and_a_no_javascript_fallback(self):
        self.assertIn('<html lang="en">', self.page)
        self.assertIn('width=device-width', self.meta('viewport'))
        self.assertRegex(self.page, r'<noscript><h1>Tour de Berlin Breweries</h1>')

    def test_sitemap_is_well_formed(self):
        # a regex check, so it does not depend on the XML library of the machine running the tests
        xml = read(os.path.join(ROOT, 'sitemap.xml'))
        self.assertTrue(xml.startswith('<?xml version="1.0" encoding="UTF-8"?>'))
        self.assertRegex(xml, r'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        self.assertEqual(xml.count('<url>'), xml.count('</url>'))
        self.assertEqual(xml.count('<loc>'), xml.count('</loc>'))
        self.assertTrue(xml.rstrip().endswith('</urlset>'))

    def test_404_page_exists_is_not_indexed_and_links_home(self):
        page = read(os.path.join(ROOT, '404.html'))
        self.assertIn('Page not found', re.search(r'<title>(.*?)</title>', page).group(1))
        self.assertRegex(page, r'<meta name="robots" content="noindex')
        self.assertIn('href="/"', page)          # served at any address, so the link must not be relative
        self.assertIsNone(re.search(r'(?:href|src)="(?!https?://|data:|/")[^"#]', page), 'a 404 page is served at any path: no relative links')
        self.assertNotIn('http-equiv="refresh"', page, 'a missing page should stay a real 404, not a redirect')


if __name__ == '__main__':
    unittest.main()
