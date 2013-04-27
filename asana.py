import webapp2
import urllib2
import redis
import json

from lib import asana

api_key = redis.StrictRedis().get('api_key')

asana_api = asana.AsanaAPI(api_key, debug=True)


class WorkspaceTasks(webapp2.RequestHandler):
    def get(self, wid):
        wid = int(wid)
        tasks = asana_api.list_tasks(wid, 'me')
        self.response.content_type = 'application/json'
        self.response.write(json.dumps(tasks))


application = webapp2.WSGIApplication([
        webapp2.Route('/asana/workspaces/<wid>/tasks', WorkspaceTasks),
        ])
