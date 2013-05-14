import os
import webapp2
import requests
import json
import logging
import pprint

api_key = os.environ.get('ASANA_API_KEY')

session = requests.Session()

mapping = {'users': 'user'}

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
    webapp2.Route('/asana/<url:.*>', Asana),
])


if __name__ == "__main__":
    from paste.cascade import Cascade
    from gevent import wsgi
    from paste.fileapp import FileApp
    from paste.urlparser import StaticURLParser
    index_app = FileApp("index.html")
    static_app = StaticURLParser("static")
    app = Cascade([static_app, application, index_app])
    wsgi.WSGIServer(('localhost', 8000), app, spawn=None).serve_forever()
