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
        print self.request.GET
        tasks = asana_api.list_workspace_tasks(wid, self.request.GET)
        self.response.content_type = 'application/json'
        self.response.write(json.dumps(tasks))


application = webapp2.WSGIApplication([
        webapp2.Route('/asana/workspaces/<wid>/tasks', WorkspaceTasks),
        ])
