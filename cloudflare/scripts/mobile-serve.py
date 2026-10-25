"""Run the real Flask app locally for browser/layout verification."""
import os,sys,tempfile,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root));os.chdir(root)
cache=root/'output/mobile-runtime-cache';cache.mkdir(parents=True,exist_ok=True);tempfile.tempdir=str(cache)
os.environ.setdefault('SEARXNG_SETTINGS_PATH',str(root/'cloudflare/container/settings.yml'))
os.environ.setdefault('SEARXNG_SECRET','local-mobile-design-fixture-only')
from searx.webapp import app,static_headers,settings
from whitenoise import WhiteNoise
app.jinja_env.auto_reload=True
app.wsgi_app=WhiteNoise(app.wsgi_app,root=settings['ui']['static_path'],prefix='static',autorefresh=True,add_headers_function=static_headers)
spec=importlib.util.spec_from_file_location('mobile_fixtures',Path(__file__).with_name('mobile-fixtures.py'));fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
fixtures.install()
app.run(host='127.0.0.1',port=8795,threaded=True,use_reloader=False)
