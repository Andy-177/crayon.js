# -*- coding: utf-8 -*-
import os
import sys
import argparse
import mimetypes
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HTML_HEAD = b'<!DOCTYPE html><html><body></body>'
HTML_SCRIPT_BEGIN = b'<script>\n'
HTML_SCRIPT_END = b'\n</script>'
HTML_TAIL = b'</html>'
JS_EXTS = ('.js', '.mjs')


def esc_script(data):
    return data.replace(b'</script', b'<\\/script')


class Site:
    def __init__(self, root):
        self.root = os.path.realpath(root)
        if os.path.isfile(self.root):
            if not self.root.endswith(JS_EXTS):
                raise SystemExit('jserver 只加载 js 文件: %s' % root)
            self.mode = 'file'
            self.target = self.root
            self.base = os.path.dirname(self.root)
        elif os.path.isdir(self.root):
            self.mode = 'dir'
            self.base = self.root
        else:
            raise SystemExit('路径不存在: %s' % root)

    @staticmethod
    def is_page(name):
        return '.' not in name or name.endswith(JS_EXTS)

    def _join(self, base, rel):
        full = os.path.realpath(os.path.join(base, rel))
        if os.path.commonpath([full, self.base]) != self.base:
            return None
        return full

    def resolve(self, url):
        p = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
        parts = [s for s in p.replace('\\', '/').split('/') if s and s not in ('.', '..')]
        p = '/'.join(parts)

        if self.mode == 'file':
            if not parts or self.is_page(parts[-1]):
                return self.target, True
            return self._join(self.base, p), False

        if not parts:
            return self._join(self.base, 'index.js'), True

        last = parts[-1]
        if not self.is_page(last):
            return self._join(self.base, p), False

        dir_candidate = self._join(self.base, p)
        if dir_candidate and os.path.isdir(dir_candidate):
            return self._join(dir_candidate, 'index.js'), True

        rel = p if p.endswith(JS_EXTS) else p + '.js'
        return self._join(self.base, rel), True


def load_extensions():
    ext_dir = os.path.join(os.path.expanduser('~'), 'jserver', 'extensions')
    try:
        os.makedirs(ext_dir, exist_ok=True)
    except OSError:
        return ext_dir, []
    files = []
    for base, dirs, names in os.walk(ext_dir):
        for n in sorted(names):
            if n.endswith(JS_EXTS):
                files.append(os.path.join(base, n))
    files.sort()
    chunks = []
    for f in files:
        try:
            with open(f, 'rb') as fh:
                content = fh.read()
        except OSError:
            continue
        chunks.append(HTML_SCRIPT_BEGIN + esc_script(content) + HTML_SCRIPT_END)
    return ext_dir, chunks


def make_handler(site, ext_chunks):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'jserver'
        protocol_version = 'HTTP/1.1'

        def do_GET(self):
            self._serve()

        def do_HEAD(self):
            self._serve(head=True)

        def _respond(self, code, body, ctype, head):
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if not head:
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass

        def _serve(self, head=False):
            resolved = self.site.resolve(self.path)
            code, ctype, body = 404, 'text/plain; charset=utf-8', b'404 Not Found'
            if resolved is not None:
                full, is_page = resolved
                if full and os.path.isfile(full):
                    with open(full, 'rb') as f:
                        data = f.read()
                    code = 200
                    if is_page:
                        body = HTML_HEAD + b''.join(ext_chunks) + HTML_SCRIPT_BEGIN + esc_script(data) + HTML_SCRIPT_END + HTML_TAIL
                        ctype = 'text/html; charset=utf-8'
                    else:
                        body = data
                        ctype, enc = mimetypes.guess_type(full)
                        if ctype is None:
                            ctype = 'application/octet-stream'
                        elif ctype.startswith('text/') or ctype == 'image/svg+xml' or 'javascript' in ctype or ctype == 'application/json':
                            ctype += '; charset=utf-8'
            self._respond(code, body, ctype, head)

    Handler.site = site
    return Handler


def main(argv=None):
    ap = argparse.ArgumentParser(prog='jserver', description='静态 JS 服务器：把 .js 合成最小 HTML 提供访问，其它静态资源按原样返回。')
    ap.add_argument('addr', help='监听地址:端口，如 0.0.0.0:8080')
    ap.add_argument('path', help='网站根目录，或单个 js 文件')
    args = ap.parse_args(argv)

    host, sep, port = args.addr.rpartition(':')
    if not sep:
        ap.error('地址格式应为 地址:端口，如 0.0.0.0:8080')
    try:
        port = int(port)
    except ValueError:
        ap.error('端口必须是数字: %s' % port)

    site = Site(args.path)
    ext_dir, ext_chunks = load_extensions()
    httpd = ThreadingHTTPServer((host or '0.0.0.0', port), make_handler(site, ext_chunks))
    httpd.daemon_threads = True
    httpd.allow_reuse_address = True

    mode = 'file(%s)' % site.target if site.mode == 'file' else 'dir'
    print('jserver: %s 模式，root=%s' % (mode, site.root))
    if ext_chunks:
        print('extensions: %d 个脚本，来自 %s' % (len(ext_chunks), ext_dir))
    else:
        print('extensions: %s (无扩展脚本)' % ext_dir)
    print('listening on %s:%d (Ctrl+C 退出)' % (host or '0.0.0.0', port))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nshutdown')
        httpd.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()