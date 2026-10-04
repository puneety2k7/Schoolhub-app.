import argparse
import json
import logging
from logging.handlers import RotatingFileHandler
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import signal
import sys
import time

parser=argparse.ArgumentParser(description="SchoolHub loopback-only static server")
parser.add_argument("--root",required=True)
parser.add_argument("--port",type=int,default=8080)
parser.add_argument("--host",default="127.0.0.1")
parser.add_argument("--runtime-config")
parser.add_argument("--log-directory",required=True)
parser.add_argument("--pid-file",required=True)
args=parser.parse_args()
root=Path(args.root).resolve()
app=root/"SchoolHub_School_Management_App_Complete.html"
if not app.is_file():
    raise SystemExit(f"SchoolHub application file not found: {app}")
logs=Path(args.log_directory).resolve()
logs.mkdir(parents=True,exist_ok=True)
cutoff=time.time()-(30*86400)
for old in logs.glob("schoolhub-static*.log*"):
    try:
        if old.stat().st_mtime<cutoff: old.unlink()
    except OSError:
        pass
logger=logging.getLogger("schoolhub.static")
logger.setLevel(logging.INFO)
handler=RotatingFileHandler(logs/"schoolhub-static.log",maxBytes=5*1024*1024,backupCount=5,encoding="utf-8")
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(handler)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*values,**kwargs):
        super().__init__(*values,directory=str(root),**kwargs)
    def log_message(self,format,*values):
        logger.info("%s %s",self.client_address[0],format%values)
    def log_error(self,format,*values):
        logger.error("%s %s",self.client_address[0],format%values)
    def do_GET(self):
        if self.path.split("?",1)[0] in ("/", "/SchoolHub_School_Management_App_Complete.html"):
            page=app.read_text(encoding="utf-8")
            runtime={"managed":False,"apiBaseUrl":"http://127.0.0.1:4010","schoolSlug":"","applicationVersion":"14.0.0-wm2"}
            if args.runtime_config:
                candidate=Path(args.runtime_config).resolve()
                if candidate.is_file(): runtime=json.loads(candidate.read_text(encoding="utf-8"))
            public={key:runtime.get(key) for key in ("managed","apiBaseUrl","schoolSlug","applicationVersion")}
            injected="<script>window.SCHOOLHUB_CONFIG="+json.dumps(public,separators=(",",":"),ensure_ascii=True).replace("<","\\u003c")+";</script>"
            page=page.replace("</head>",injected+"</head>",1)
            body=page.encode("utf-8")
            self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Content-Length",str(len(body)));self.send_header("Cache-Control","no-store");self.end_headers();self.wfile.write(body);return
        return super().do_GET()

server=ThreadingHTTPServer((args.host,args.port),Handler)
pid_file=Path(args.pid_file)
pid_file.write_text(str(os.getpid()),encoding="ascii")
logger.info("SERVER_STARTED pid=%s url=http://%s:%s/SchoolHub_School_Management_App_Complete.html",os.getpid(),args.host,args.port)
def stop(*_):
    logger.info("SERVER_STOPPING pid=%s",os.getpid())
    server.shutdown()
for signame in ("SIGINT","SIGTERM"):
    if hasattr(signal,signame): signal.signal(getattr(signal,signame),stop)
try:
    server.serve_forever()
except Exception:
    logger.exception("SERVER_FAILED")
    raise
finally:
    server.server_close()
    try: pid_file.unlink(missing_ok=True)
    except OSError: pass
    logger.info("SERVER_STOPPED pid=%s",os.getpid())
