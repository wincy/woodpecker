import os
import json
import logging
import pprint
import mimetypes

import webapp2
import requests

api_key = os.environ.get('ASANA_API_KEY')

session = requests.Session()

mapping = {'users': 'user'}


class Static(webapp2.RequestHandler):
    def get(self, path):
        self.response.content_type = str(mimetypes.guess_type(path)[0])
        fd = open(path)
        self.response.write(fd.read())
        fd.close()

class Asana(webapp2.RequestHandler):
    def options(self, url):
        logging.info(url);
        pass

    def get(self, url):
        print 'GET /%s' % url
        r = session.get('https://app.asana.com/api/1.0/%s' % url,
                        params=self.request.GET,
                        auth=(api_key, ''))
        self.response.status_int = r.status_code
        self.response.content_type = r.headers['content-type']
        self.response.write(json.dumps(r.json()))
        import pprint
        pprint.pprint(r.json())

    def post(self, url):
        print 'POST /%s' % url
        pprint.pprint(self.request.POST)
        r = session.post('https://app.asana.com/api/1.0/%s' % url,
                         data=dict(self.request.POST),
                         auth=(api_key, ''))
        self.response.status_int = r.status_code
        self.response.content_type = r.headers['content-type']
        self.response.write(json.dumps(r.json()))
        pprint.pprint(r.json())

    def put(self, url):
        print 'PUT /%s' % url
        pprint.pprint(self.request.POST)
        r = session.put('https://app.asana.com/api/1.0/%s' % url,
                        data=dict(self.request.POST),
                        auth=(api_key, ''))
        self.response.status_int = r.status_code
        self.response.content_type = r.headers['content-type']
        self.response.write(json.dumps(r.json()))
        pprint.pprint(r.json())


application = webapp2.WSGIApplication([
    webapp2.Route('/', webapp2.RedirectHandler, defaults={'_uri': '/index.html'}),
    webapp2.Route('/asana/<url:.*>', Asana),
    webapp2.Route('/<path:.*>', Static),
])


if __name__ == "__main__":
    from gevent import wsgi
    wsgi.WSGIServer(('localhost', 8000), application, spawn=None).serve_forever()
