#!/usr/bin/env python3
"""Zostaví samostatnú verziu webu pre Cloudflare z /home/claude/splatkuj/index.html (artefakt bez <head>)."""
import sys, pathlib
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/home/claude/splatkuj/index.html').read_text()
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/home/claude/cf-site/public/index.html')
head = ('<!doctype html><html lang="sk"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>')
i = src.find('<style')  # title, favicon a fonty idú do <head>
out.write_text(head + src[:i] + '</head><body>' + src[i:] + '</body></html>')
print('ok', out)
