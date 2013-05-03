import webapp2
import requests
import redis
import json

api_key = redis.StrictRedis().get('api_key')

session = requests.Session()

mapping = {'users': 'user'}

class Asana(webapp2.RequestHandler):
    def get(self, resource, id):
        print 'GET /%s/%s' % (resource, id)
        r = session.get('https://app.asana.com/api/1.0/%s/%s' % (resource, id),
                        auth=(api_key, ''))
        self.response.status_int = r.status_code
        self.response.content_type = r.headers['content-type']

        if resource == "users":
            raw = r.json()["data"]
            data = {"user": {
                    # "id": raw["id"],
                    "name": raw["name"],
                    "email": raw["email"]},
                    "workspaces": raw["workspaces"]
                    }
        self.response.write(json.dumps(data))


application = webapp2.WSGIApplication([
        webapp2.Route('/asana/<resource>/<id>', Asana),
        ])
